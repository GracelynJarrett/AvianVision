from fastapi import FastAPI

common_name = "BirdName"





# App is creating the API application
app = FastAPI( # creat a new FastAPI server
    title="AvianVision Backend", 
    description="Backend API for bird prediction and species information",
    version="1.0.0"
)


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
        "mlflow": "not connected "
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
        "message":"Coming soon"
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

