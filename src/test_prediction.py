# test_prediction.py
#
# Purpose: Tests the full end-to-end integration between the trained model and
# MongoDB. Loads a bird photo, runs it through the EfficientNetB0 model, checks
# whether the confidence is high enough to trust, and then fetches enrichment
# data (taxonomy, conservation, diet) from MongoDB Atlas for the predicted species.
#
# Usage (run from the project root in WSL2 with avian-venv active):
#   python src/test_prediction.py --image data/test_images/Abbotts_Booby.jpg

import argparse
import sys
from pathlib import Path

import mlflow.tensorflow
import numpy as np
import tensorflow as tf
import yaml
from dotenv import load_dotenv
from PIL import Image

# Add the src/ folder to the Python path so we can import our sibling modules
# (mlflow_setup, mongodb_client, preprocessing) without installing the project as a package.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from datasets import load_dataset_builder
from mlflow_setup import setup_mlflow
from mongodb_client import get_species_info_collection
from preprocessing import build_label_remap

# ---- Fixed settings ----

# The Hugging Face dataset name — needed to fetch the label list.
DATASET_NAME = "yashikota/birds-525-species-image-classification"

# The project's root folder, calculated from where this file lives (inside src/).
PROJECT_ROOT = Path(__file__).resolve().parent.parent


# ---- Helper functions ----

def load_config():
    """Reads image size and confidence threshold from the project's YAML config files.
    Returns both values so the rest of the script knows how big to resize images
    and how confident the model must be before we trust its answer."""

    # Open image_config.yaml to find out how many pixels wide/tall each image should be.
    # EfficientNetB0 was trained on 224x224, so this will almost always be 224.
    with open(PROJECT_ROOT / "configs" / "image_config.yaml") as f:
        image_cfg = yaml.safe_load(f)
    image_size = image_cfg["image_size"]

    # Open api_config.yaml to find the confidence cutoff.
    # If the model's top guess scores below this number, we return "Unknown" instead.
    with open(PROJECT_ROOT / "configs" / "api_config.yaml") as f:
        api_cfg = yaml.safe_load(f)
    threshold = api_cfg["unknown_threshold"]

    return image_size, threshold


def load_class_names():
    """Gets the ordered list of 525 bird species labels the model was trained on.

    Downloads only the dataset's metadata (not the actual images) from Hugging Face
    so we can read the label names quickly. Then applies the same label-merging step
    that training used, which collapses the Parakeet Auklet typo-duplicate from 526
    raw labels down to 525 true species."""

    # load_dataset_builder fetches only the dataset card and schema — no images are
    # downloaded. If the dataset is already cached from training, this is instant.
    builder = load_dataset_builder(DATASET_NAME)
    raw_names = builder.info.features["label"].names

    # build_label_remap normalises whitespace and merges labels that refer to the same
    # species. The second return value (merged_names) is the final 525-class list,
    # in the same order that training used — so index 0 in predictions = merged_names[0].
    _, class_names = build_label_remap(raw_names)

    return class_names


def preprocess_image(image_path, image_size):
    """Loads a bird photo from disk and prepares it for the model.

    Opens the file, forces it to RGB colour (in case the photo is greyscale or has
    a transparency channel), resizes it to the model's expected dimensions, and adds
    a batch dimension so the model receives exactly the shape it expects.

    Note: pixel values are NOT rescaled to [-1, 1]. EfficientNetB0 does that
    normalisation internally — the training pipeline intentionally left values in
    the 0-255 range for this reason."""

    # Open the image file and convert to standard three-channel RGB colour.
    # This matches what the training pipeline did: example["image"].convert("RGB").
    img = Image.open(image_path).convert("RGB")

    # Convert the PIL image to a numpy array, then to a TensorFlow float tensor.
    # tf.image.resize requires float input and returns values in the same 0-255 range.
    img_array = np.array(img)
    img_tensor = tf.cast(img_array, tf.float32)
    img_tensor = tf.image.resize(img_tensor, [image_size, image_size])

    # Add a batch dimension at position 0.
    # Without this the model would see shape (224, 224, 3) instead of (1, 224, 224, 3)
    # and would raise a shape error.
    img_tensor = tf.expand_dims(img_tensor, axis=0)

    return img_tensor


def run_test(image_path):
    """Runs the full prediction and enrichment lookup for a single test image.

    Steps: load the trained model → preprocess the image → predict the species →
    check confidence → fetch enrichment data from MongoDB → print the result."""

    # Load environment variables from .env (MongoDB URI, etc.).
    load_dotenv()

    # --- Step 1: Read config values ---
    # We need the image size before we can resize the photo, and the threshold
    # before we can decide whether to trust the prediction.
    print("Loading config...")
    image_size, threshold = load_config()
    print(f"  Image size : {image_size}px")
    print(f"  Threshold  : {threshold:.0%}")

    # --- Step 2: Get the 525 class names ---
    # These must exactly match the classes the model was trained on, including
    # the Parakeet Auklet merge, otherwise the index-to-name mapping will be wrong.
    print("\nLoading class names from dataset metadata...")
    class_names = load_class_names()
    print(f"  {len(class_names)} classes loaded.")

    # --- Step 3: Load the trained model from the MLflow registry ---
    # setup_mlflow() points MLflow at the project's local SQLite database.
    # Version 1 of "avianvision-bird-classifier" is the baseline EfficientNetB0 model.
    print("\nLoading model from MLflow registry...")
    setup_mlflow()
    model = mlflow.tensorflow.load_model("models:/avianvision-bird-classifier/1")
    print("  Model loaded.")

    # --- Step 4: Load and resize the test image ---
    print(f"\nProcessing image: {image_path}")
    img_tensor = preprocess_image(image_path, image_size)
    print(f"  Input tensor shape : {img_tensor.shape}")

    # --- Step 5: Run the model and find the top prediction ---
    # model.predict() returns an array of 525 probability scores for this image.
    # We find the index with the highest score and look up the matching class name.
    print("Running prediction...")
    predictions = model.predict(img_tensor, verbose=0)
    top_index = int(np.argmax(predictions[0]))
    confidence = float(predictions[0][top_index])
    predicted_label = class_names[top_index]

    print(f"\n--- Prediction Result ---")
    print(f"Predicted species : {predicted_label}")
    print(f"Confidence        : {confidence:.2%}")
    print(f"Threshold         : {threshold:.0%}")

    # --- Step 6: Check the confidence threshold ---
    # If the model is not confident enough, we do not trust the prediction and stop.
    if confidence < threshold:
        print(f"\nResult: UNKNOWN — confidence is below the {threshold:.0%} threshold.")
        return

    # --- Step 7: Look up enrichment data in MongoDB ---
    # We search for the species by its dataset label (e.g. "ABBOTTS BOOBY").
    print("\nLooking up enrichment data in MongoDB...")
    collection = get_species_info_collection()
    doc = collection.find_one({"species_label": predicted_label})

    if doc is None:
        print(f"  No enrichment record found for '{predicted_label}' in MongoDB.")
        print("  (The pipeline may not have loaded data for this species yet.)")
        return

    # --- Step 8: Print the enrichment data ---
    # Pull each nested section out of the MongoDB document and display it.
    print("\n--- Enrichment Data ---")
    print(f"Scientific name   : {doc.get('scientific_name')}")
    print(f"GBIF key          : {doc.get('gbif_key')}")

    # Taxonomy: the bird's biological classification from GBIF.
    taxonomy = doc.get("taxonomy") or {}
    print(f"Taxonomy          : {taxonomy.get('order')} → "
          f"{taxonomy.get('family')} → {taxonomy.get('genus')}")

    # Conservation: status and population trend from IUCN Red List.
    conservation = doc.get("conservation") or {}
    status_label = conservation.get("status_label") or "Not available"
    trend = conservation.get("population_trend") or "Not available"
    print(f"Conservation      : {status_label}  (trend: {trend})")

    # Diet: what the bird eats, sourced from the Avian Diet Database.
    diet = doc.get("diet") or {}
    top_prey = diet.get("top_prey") or "Not available"
    prey_classes = diet.get("prey_classes") or "Not available"
    print(f"Top prey          : {top_prey}")
    print(f"Prey classes      : {prey_classes}")


# ---- Entry point ----

if __name__ == "__main__":
    # Set up the command-line argument so the user can pass in the image path.
    parser = argparse.ArgumentParser(
        description="Test bird species prediction and MongoDB enrichment lookup."
    )
    parser.add_argument(
        "--image",
        type=str,
        required=True,
        help="Relative or absolute path to the test image "
             "(e.g. data/test_images/Abbotts_Booby.jpg)",
    )
    parsed = parser.parse_args()

    # Run the test with the image the user provided.
    run_test(image_path=Path(parsed.image))
