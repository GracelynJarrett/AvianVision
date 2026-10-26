from fastapi import FastAPI
import json
import mlflow
import math
import pandas as pd
from src.mongodb_client import (
    get_species_info_collection,
    get_species_observations_collection,
    get_predictions_collection
)
from src.model_loader import get_model



common_name = "BirdName"


# App is creating the API application
app = FastAPI( # creat a new FastAPI server
    title="AvianVision Backend", 
    description="Backend API for bird prediction and species information",
    version="1.0.0"
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
    return {
        "message":"Coming soon"
    }


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
    return {
        "message":"Coming soon"
    }


# /predict Endpoint returns the model prediction
@app.post("/predict")
def prediction():
    return {
        "message":"Coming soon"
    }


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

