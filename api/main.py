from fastapi import FastAPI

# App is creating the the API application
app = FastAPI( # creat a new FastAPI server
    title="AvianVision Backend", 
    description="Backend API for bird prediction and species information",
    version="1.0.0"
)

@app.get("/health") # Creating the /health Endpoint it retunes a message talking about if all the projects parts are conneted and online
def home():
    return{
        # Sends data back to the user
        
        "application": "AvianVision",
        "api_status": "online",
        "model_status": "not loaded",
        "database": "not connected",
        "mlflow": "not connected "
    }