# Standard Library
import json
import random
from datetime import datetime
from io import BytesIO
import pandas as pd


# Third-Party Libraries
import mlflow
import numpy as np
import tensorflow as tf
from PIL import Image
from datasets import load_dataset, load_dataset_builder

# FastAPI
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Project Files
from src.model_loader import get_model
from src.mongodb_client import (
    get_predictions_collection,
    get_species_info_collection,
    get_species_observations_collection,
)
from src.preprocessing import build_label_remap
from src.test_prediction import(
    load_class_names,
    load_config

)


common_name = "BirdName"

# ---- Dataset image cache ----

# These two variables hold the loaded HF dataset and a pre-built lookup table.
# They start as None and are filled in the first time someone requests a bird image.
# After that first call, every image request reuses the cached values instantly.
_hf_dataset = None
_merged_id_to_row = None  # maps merged label ID (0-524) → first row index in the dataset


def _build_image_index():
    """Loads the Hugging Face dataset and builds a label-to-row lookup table.

    On the first call this scans the label column of the training split to find
    the first row that belongs to each of the 525 species. No images are loaded
    during this scan — only the integer label values. The result is cached so
    every future image request skips this work entirely.

    Returns the dataset object and the lookup dict so the caller can load a
    specific row by index."""

    global _hf_dataset, _merged_id_to_row

    # If we already did this work, return the cached result immediately.
    if _merged_id_to_row is not None:
        return _hf_dataset, _merged_id_to_row

    # Pull the raw label names and the remap table from the dataset metadata.
    # load_dataset_builder only downloads the schema, not any images.
    builder = load_dataset_builder(
        "yashikota/birds-525-species-image-classification"
    )
    raw_names = builder.info.features["label"].names
    old_to_new, _ = build_label_remap(raw_names)

    # Load the training split. If the dataset is already cached on disk from
    # training, this is instant — it just memory-maps the Arrow files.
    _hf_dataset = load_dataset(
        "yashikota/birds-525-species-image-classification",
        split="train"
    )

    # Walk through every label value in the training split.
    # We only read the label column here — no image data is loaded into memory.
    # For each merged species ID we record the first row index we encounter.
    index = {}
    for row_idx, raw_label_id in enumerate(_hf_dataset["label"]):
        merged_id = old_to_new[raw_label_id]
        if merged_id not in index:
            index[merged_id] = row_idx

    _merged_id_to_row = index
    return _hf_dataset, _merged_id_to_row


# App is creating the API application
app = FastAPI( # creat a new FastAPI server
    title="AvianVision Backend", 
    description="Backend API for bird prediction and species information",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helper files ---

# Helpe to load json file for /stats
def load_json(filepath):
    with open(filepath, "r", encoding="utf-8") as file:
        return json.load(file)


## help to talks to mlflow
from src.mlflow_setup import(
    setup_mlflow,
    EXPERIMENT_NAME
)

# help to talk to mlflow
def get_mlflow_status():
    setup_mlflow()

    experiment = mlflow.get_experiment_by_name(
        EXPERIMENT_NAME
    )

    if experiment:
        return {
            "status": "connected",
            "experiment": experiment.name
        }

    return {
        "status": "not connected"
    }

# help see the runs in mlflow
def get_mlflow_runs():
    setup_mlflow()

    experiment = mlflow.get_experiment_by_name(
        EXPERIMENT_NAME
    )

    runs = mlflow.search_runs(
        experiment_ids=[experiment.experiment_id]
    )

    base_model = None
    aggregation_models = []
    hyperparameter_models = []
    best_model = None 
       
    for _, run in runs.iterrows():

        run_data = extract_run_metrics(run)

        run_name = run_data["run_name"].strip()

        print("RUN:", run_name)

        if run_name.endswith("-DA"):
            print("FOUND DA")
            aggregation_models.append(run_data)

        elif run_name.endswith("-HT"):
            print("FOUND HT")
            hyperparameter_models.append(run_data)

        elif run_name.endswith("-final"):
             print("FOUND Final")
             best_model = run_data

        else:
            print("FOUND BASE")
            base_model = run_data 
     
     # sorts the top 5 best Hyperuning model
    hyperparameter_models.sort(
        key=hyperparameter_sort_key,
        reverse=True)
     
    top_5_hyperparameter_models = hyperparameter_models[:5]
    
    return {
    "base_model": base_model,
    "aggregation_models": aggregation_models,
    "top_hyperparameter_models": top_5_hyperparameter_models,

    "best_hyperparameter_model": top_5_hyperparameter_models[0],

    "best_model": best_model
    }

# help inspetes the modles metrics - Debugging
def get_first_run_metrics():
    setup_mlflow()

    experiment = mlflow.get_experiment_by_name(
        EXPERIMENT_NAME
    )

    runs = mlflow.search_runs(
        experiment_ids=[experiment.experiment_id]
    )

    first_run = runs.iloc[0]

    metrics = {}

    # NAN Valuse will not be returned at all
    for key, value in first_run.items():
        if not key.startswith("metrics."):
            continue

        if pd.isna(value):
            continue

        metrics[key] = value

    return {
        "run_name": first_run["tags.mlflow.runName"],
        "metrics": metrics
    }

# Helps handle nan in mlflow
def safe_metric(value):
    if pd.isna(value):
        return None
    return value

# help extract only the metrics we acculay wnat
def extract_run_metrics(run):
    return {
        "run_name": run["tags.mlflow.runName"],

        "train": {
            "accuracy": safe_metric(
                run.get("metrics.train_accuracy")
            ),
            "loss": safe_metric(
                run.get("metrics.train_loss")
            )
        },

        "validation": {
            "accuracy": safe_metric(
                run.get("metrics.val_accuracy")
            ),
            "f1_score": safe_metric(
                run.get("metrics.val_macro_f1")
            ),
            "loss": safe_metric(
                run.get("metrics.val_loss")
            ),
            "precision": safe_metric(
                run.get("metrics.val_macro_precision")
            ),
            "recall": safe_metric(
                run.get("metrics.val_macro_recall")
            )
        },

        "test": {
            "accuracy": safe_metric(
                run.get("metrics.test_accuracy")
            ),
            "f1_score": safe_metric(
                run.get("metrics.test_macro_f1")
            ),
            "loss": safe_metric(
                run.get("metrics.test_loss")
            )
        }
    }

# sort key for hyperparameter
def hyperparameter_sort_key(model):
    return (
        model["validation"]["accuracy"] or 0,
        model["validation"]["f1_score"] or 0,
        # the - make it where the small number wins
        -(model["validation"]["loss"] or 999) 
    )


#------ Health cheeker funtions --------------

# check if conneted to mongoDB
def check_mongodb():

    try:
        collection = get_species_info_collection()

        collection.find_one()

        return True

    except Exception:
        return False
    
# Check if the model is conneted
def check_model():

    try:
        model = get_model()

        return model is not None

    except Exception:
        return False

# Check if mlflow is conneted
def check_mlflow():

    try:
        setup_mlflow()

        experiment = mlflow.get_experiment_by_name(
            EXPERIMENT_NAME
        )

        return experiment is not None

    except Exception:
        return False
    


# ------- Home ---------

def _build_fun_fact(doc: dict) -> str | None:
    """Builds a single fun-fact sentence from a species_info MongoDB document.

    Tries two sources — diet and Wikipedia — and picks one at random from
    whichever sources actually have data. Returns None if neither has anything."""

    possible_facts = []

    # Diet fact — if the top prey item is known, turn it into a short sentence.
    top_prey = (doc.get("diet") or {}).get("top_prey") or []
    if top_prey:
        prey_name = top_prey[0].get("prey", "")
        if prey_name:
            possible_facts.append(
                f"This species primarily feeds on {prey_name.lower()}."
            )

    # Wikipedia fact — the description field is already a short one-liner.
    wiki_desc = (doc.get("wikipedia") or {}).get("description", "")
    if wiki_desc:
        possible_facts.append(wiki_desc)

    return random.choice(possible_facts) if possible_facts else None


# calulating/ gathering data for the home endpoint
def get_home_data():

    species_collection = get_species_info_collection()

    observation_collection = (
        get_species_observations_collection()
    )

    prediction_collection = (
        get_predictions_collection()
    )

    mlflow_data = get_mlflow_runs()

    best_model = mlflow_data["best_model"]

    species_count = (
        species_collection.count_documents({})
    )

    observation_count = (
        observation_collection.count_documents({})
    )

    prediction_count = (
        prediction_collection.count_documents({})
    )

    countries = (
        observation_collection.distinct("country")
    )

    years = (
        observation_collection.distinct("year")
    )

    # ----- Featured Bird -----

    # Pick one random species document from the collection using MongoDB's $sample.
    # This returns a different bird every time the home page loads.
    sample = list(
        species_collection.aggregate([{"$sample": {"size": 1}}])
    )

    featured_bird = None

    if sample:
        doc = sample[0]

        # Build a fun fact from whichever data sources have content for this bird.
        fun_fact = _build_fun_fact(doc)

        featured_bird = {
            "species_label": doc.get("species_label"),
            "scientific_name": doc.get("scientific_name"),
            "fun_fact": fun_fact
        }

    return {
        "project": {
            "name": "AvianVision"
        },

        "dataset": {
            "species_count": species_count,
            "observation_count": observation_count
        },

        "coverage": {
            "country_count": len(countries),

            "year_range": {
                "min": min(years) if years else None,
                "max": max(years) if years else None
                }

        },

        "model": {
            "accuracy":
                best_model["test"]["accuracy"],

            "f1_score":
                best_model["test"]["f1_score"],

            "loss":
                best_model["test"]["loss"]
        },

        "predictions": {
            "total_predictions":
                prediction_count,

            "top_predicted_species": None
        },

        "featured_bird": featured_bird
    }





# ---  Endpoints  ---

# /health Endpoint retunes a message talking about if all the projects parts are conneted and online
@app.get("/health") 
def health():

        # Sends data back to the user
    mongodb_ok = check_mongodb()
    mlflow_ok = check_mlflow()
    model_ok = check_model()

    overall_ok = (
        mongodb_ok and
        mlflow_ok and
        model_ok
    )

    return {
        "status": (
            "healthy"
            if overall_ok
            else "unhealthy"
        ),

        "services": {
            "application": "AvianVision",
            "api": True,
            "mongodb": mongodb_ok,
            "mlflow": mlflow_ok,
            "model": model_ok
        }
    }
    

# /home Endpoint returns the project home page, this is where users starts
@app.get("/home")
def home():
    return get_home_data()


# /stats Endpoint returns the model stats and model metrics
@app.get("/stats")
def model_stats():
    return {
        "defintions": {
            "metrics": load_json("api/data/metrics.json"),
            "aggregations": load_json("api/data/aggregations.json"),
            "hyperparameters": load_json("api/data/hyperparameters.json"),
            "model_types": load_json("api/data/model_types.json")
        },
         "mlflow": get_mlflow_runs()
         
            
    }


# /species Endpoint returns graphs/tables/maps about different birds
@app.get("/species")
def species():
    collection = get_species_info_collection()

    species = list(
        collection.find(
            {},
            {
                "_id": 0,
                "species_label": 1,
                "scientific_name": 1,
                "conservation.status_label": 1,
                "migration.total_sightings": 1
            }
        )
    )

    return {
        "species_count": len(species),
        "species": species
    }


# /predict Endpoint returns the model prediction
@app.post("/predict")
def predict(file: UploadFile = File(...)):

    # ----- Validate File -----

    if file.content_type not in [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ]:
        return {
            "error": "Only JPG, PNG, and WEBP images are supported."
        }

    # ----- Load Config -----

    image_size, threshold, spread_threshold = load_config()

    # ----- Preprocess Image -----

    image = Image.open(file.file).convert("RGB")

    img_array = np.array(image)

    img_tensor = tf.cast(
        img_array,
        tf.float32
    )

    img_tensor = tf.image.resize(
        img_tensor,
        [image_size, image_size]
    )

    img_tensor = tf.expand_dims(
        img_tensor,
        axis=0
    )

    # ----- Run Prediction -----

    model = get_model()

    predictions = model.predict(
        img_tensor,
        verbose=0
    )

    top_index = int(
        np.argmax(predictions[0])
    )

    confidence = float(
        predictions[0][top_index]
    )

    # ----- Convert Prediction To Species -----
    current_time = datetime.now()

    class_names = load_class_names()

    predicted_label = class_names[top_index]
    
    top_5_indices = np.argsort(
        predictions[0]
    )[-5:][::-1]

    top_5_predictions = []

    for index in top_5_indices:
        top_5_predictions.append({
            "species_label": class_names[index],
            "confidence": float(
                predictions[0][index]
            )
        })

    # ----- Spread Check -----

    # Add up the confidence scores for predictions #2 through #5.
    # If the total is above the spread threshold, the model's confidence is too
    # scattered across different species — this usually means the image is not a bird.
    # NOTE: This check catches uncertain OOD images (spread predictions) but cannot
    # catch falsely confident OOD images where one wrong class dominates (e.g., an
    # airplane predicted as a specific bird at 95%+). That case requires a future
    # binary pre-classifier gate.
    spread = sum(p["confidence"] for p in top_5_predictions[1:])

    if spread > spread_threshold:
        return {
            "prediction": {
                "species_label": "UNKNOWN",
                "confidence": confidence,
                "accepted": False
            },
            "bird": None
        }

    # ----- Confidence Check -----

    if confidence < threshold:
        return {
            "prediction": {
                "species_label": "UNKNOWN",
                "confidence": confidence,
                "accepted": False
            },
            "bird": None
        }

    # ----- Lookup Bird Information -----

    collection = get_species_info_collection()

    bird_info = collection.find_one(
        {"species_label": predicted_label}
    )

    if bird_info:
        bird_info.pop("_id", None)

    # ----- Save Prediction -----

    predictions_collection = (
        get_predictions_collection()
    )

    predictions_collection.insert_one({
    "species_label": predicted_label,

    "scientific_name":
        bird_info.get("scientific_name"),

    "confidence":
        confidence,

    "top_5_predictions":
        top_5_predictions,

    "month":
        current_time.month,

    "year":
        current_time.year,

    "country":
        None,

    "timestamp":
        current_time
})

    # ----- Return Result -----

    return {
        "prediction": {
            "species_label": predicted_label,
            "confidence": confidence,
            "accepted": True
        },
        "bird": bird_info
    }





# /birds/random returns N randomly selected birds for use in slideshows
@app.get("/birds/random")
def get_random_birds(count: int = Query(default=6, ge=1, le=10)):
    """Returns a list of randomly selected bird species for the slideshow.

    The count parameter controls how many birds are returned (1–10, default 6).
    Each bird includes its species label, scientific name, and a one-sentence fun fact.
    Call this endpoint once — do not call it once per bird."""

    # ----- Sample Random Birds -----

    # MongoDB's $sample stage picks the requested number of documents at random.
    # Each call to this endpoint returns a different set of birds.
    species_collection = get_species_info_collection()

    sample = list(
        species_collection.aggregate([{"$sample": {"size": count}}])
    )

    # ----- Build Response -----

    # For each sampled document, pull out the three fields the slideshow needs.
    birds = []
    for doc in sample:
        birds.append({
            "species_label": doc.get("species_label"),
            "scientific_name": doc.get("scientific_name"),
            "fun_fact": _build_fun_fact(doc)
        })

    return {"birds": birds}


# /bird/common_name returns info for one bird
@app.get("/bird/{species_label}")
def get_bird(species_label: str):
    info_collection = get_species_info_collection()
    observation_collection = get_species_observations_collection()

    bird_info = info_collection.find_one(
        {"species_label": species_label.upper()}
    )

    if bird_info is None:
        return {
            "error": "Bird not found"
        }

    bird_info.pop("_id", None)


    observations = list(
        observation_collection.find(
            {"species_label": species_label},
            {"_id": 0}
        )
    )

    return {
        "bird": bird_info,
        "observation_count": len(observations),
        "observations": observations
    }


# /bird/{species_label}/image returns a representative photo for one species
@app.get("/bird/{species_label}/image")
def get_bird_image(species_label: str):
    """Streams a JPEG image of the requested bird species from the dataset.

    Looks up the species name in the 525-class label list to get its merged
    label ID, then uses the pre-built row index to load just that one image
    from the cached Hugging Face dataset and returns it as a JPEG stream."""

    # ----- Find the Merged Label ID -----

    # Load the 525-class name list and search for the requested species.
    # The position of the name in this list is its merged label ID.
    class_names = load_class_names()
    target = species_label.upper().strip()

    merged_id = None
    for i, name in enumerate(class_names):
        if name.upper() == target:
            merged_id = i
            break

    # If the name isn't in the label list, this species doesn't exist in the dataset.
    if merged_id is None:
        raise HTTPException(
            status_code=404,
            detail=f"Species '{species_label}' not found in the dataset."
        )

    # ----- Look Up the Row Index -----

    # Build (or retrieve from cache) the merged-label-ID → row-index lookup table.
    dataset, id_to_row = _build_image_index()

    # Make sure we actually have a row for this species.
    if merged_id not in id_to_row:
        raise HTTPException(
            status_code=404,
            detail=f"No image found for '{species_label}'."
        )

    # ----- Load and Stream the Image -----

    # Load just the one dataset row we need — the HF library reads only that
    # record from the Arrow cache, so no other images are touched.
    row_idx = id_to_row[merged_id]
    image = dataset[row_idx]["image"]

    # Convert the PIL image to JPEG bytes, then send them back as a streaming response.
    # Converting to RGB first handles any greyscale or RGBA images in the dataset.
    buffer = BytesIO()
    image.convert("RGB").save(buffer, format="JPEG")
    buffer.seek(0)

    return StreamingResponse(buffer, media_type="image/jpeg")


