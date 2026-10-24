from fastapi import FastAPI

common_name = "BirdName"





# App is creating the the API application
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


# /stats Endpoints returns the modles stats and talks about the models metrics
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


# /predict  Endpoint returns the model and the bird predtiion
@app.get("/predict")
def prediction():
    return {
        "message":"Coming soon"
    }


# /bird/common_name returns info for one bird
@app.get(f"/bird/{common_name}")
def birds():
    return {
        "message":"Coming soon"
    }

