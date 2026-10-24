from fastapi import FastAPI
import json
import mlflow

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



# ---  Endpoints  ---

# /health Endpoint retunes a message talking about if all the projects parts are conneted and online
@app.get("/health") 
def health():
    return{
        # Sends data back to the user
        
        "application": "AvianVision",
        "api_status": "online",
        "model_status": "not loaded",
        "database": "not connected",
        "mlflow": get_mlflow_status()
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
         "mlflow": 
            {
             "top_aggtetion_models": [],
             "top_hypeerparameter_models": [],
             "best_model": {}
         }
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
@app.get("/bird/{common_name}")
def bird(common_name:str):
    return {
        "message":f"information for {common_name} coning soon"
    }











