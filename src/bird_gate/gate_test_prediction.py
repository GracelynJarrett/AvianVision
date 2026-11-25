# test.py (bird gate)
#
# Purpose: Tests the bird gate on its own with a single photo. Loads the photo,
# runs it through the registered gate model (avianvision-bird-gate, version 1),
# and prints whether the gate thinks it is a bird or not, using gate_threshold
# from configs/api_config.yaml. Works the same way as
# src/species_classifier/test_prediction.py, but only for the gate.
#
# This script only reads. It does not log to MLflow or write any files.
# Run it in WSL, because the model was saved from WSL.
#
# Usage (from the project root in WSL2 with avian-venv active):
#   python -m src.bird_gate.test --image data/test_images/Abbotts_Booby.jpg

import argparse
from pathlib import Path

import mlflow.tensorflow
import numpy as np
import tensorflow as tf
import yaml
from PIL import Image

from src.mlflow_setup import setup_mlflow

# ---- Fixed settings ----

# The project's root folder (this file lives in src/bird_gate/)
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# The MLflow experiment for the gate, and where the final gate model is registered
GATE_EXPERIMENT = "avianvision-bird-gate"
GATE_MODEL_URI = "models:/avianvision-bird-gate/1"


# ---- Helper functions ----

def load_config():
    """Reads the image size and the gate cut-off from the project's YAML config files."""

    # image_config.yaml says how many pixels wide/tall each image should be (224 for EfficientNetB0)
    with open(PROJECT_ROOT / "configs" / "image_config.yaml") as f:
        image_cfg = yaml.safe_load(f)
    image_size = image_cfg["image_size"]

    # api_config.yaml holds the gate cut-off. A bird score under it means "not a bird"
    with open(PROJECT_ROOT / "configs" / "api_config.yaml") as f:
        api_cfg = yaml.safe_load(f)
    gate_threshold = api_cfg["gate_threshold"]

    return image_size, gate_threshold


def preprocess_image(image_path, image_size):
    """Loads a photo from disk and prepares it for the gate, the same way test_prediction.py does.

    Forces RGB colour, resizes to the model's size, and adds a batch dimension.
    Pixel values are NOT rescaled, because EfficientNetB0 does that itself
    (the gate was trained the same way)."""

    # Open the image and convert to three-channel RGB (handles greyscale and transparent images)
    img = Image.open(image_path).convert("RGB")

    # Turn it into a float tensor and resize it. Values stay in the 0-255 range
    img_tensor = tf.cast(np.array(img), tf.float32)
    img_tensor = tf.image.resize(img_tensor, [image_size, image_size])

    # Add a batch dimension: (224, 224, 3) becomes (1, 224, 224, 3)
    img_tensor = tf.expand_dims(img_tensor, axis=0)

    return img_tensor


def run_test(image_path):
    """Runs one photo through the bird gate and prints the result."""

    # --- Step 1: Read config values ---
    print("Loading config...")
    image_size, gate_threshold = load_config()
    print(f"  Image size     : {image_size}px")
    print(f"  Gate threshold : {gate_threshold}")

    # --- Step 2: Load the gate model from the MLflow registry ---
    print("\nLoading bird gate model from MLflow registry...")
    setup_mlflow(GATE_EXPERIMENT)
    model = mlflow.tensorflow.load_model(GATE_MODEL_URI)
    print("  Model loaded.")

    # --- Step 3: Load and resize the photo ---
    print(f"\nProcessing image: {image_path}")
    img_tensor = preprocess_image(image_path, image_size)
    print(f"  Input tensor shape : {img_tensor.shape}")

    # --- Step 4: Run the gate ---
    # The gate gives one number from 0 to 1: how likely the photo is a bird
    print("Running bird gate...")
    bird_score = float(model.predict(img_tensor, verbose=0)[0][0])

    # --- Step 5: Compare the score to the cut-off and print the result ---
    print("\n--- Bird Gate Result ---")
    print(f"Bird score     : {bird_score:.4f}")
    print(f"Gate threshold : {gate_threshold}")
    if bird_score >= gate_threshold:
        print("Result         : BIRD (would go on to the species classifier)")
    else:
        print("Result         : NOT A BIRD (would be stopped before the species classifier)")


# ---- Entry point ----

if __name__ == "__main__":
    # Set up the command-line argument so the user can pass in the image path
    parser = argparse.ArgumentParser(description="Test the bird gate on a single image.")
    parser.add_argument(
        "--image",
        type=str,
        required=True,
        help="Relative or absolute path to the test image (e.g. data/test_images/Abbotts_Booby.jpg)",
    )
    parsed = parser.parse_args()

    # Run the test with the image the user provided
    run_test(image_path=Path(parsed.image))