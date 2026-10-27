# model_loader.py is a file to load the model into fastAPI to be used on the dashboard

import mlflow.tensorflow
from pathlib import Path

_model = None

def get_model():
    global _model

    if _model is None:

        model_path = Path(
            "models/models/m-578f1895e72243b5a24765bbb16de367/artifacts"
        )

        _model = mlflow.tensorflow.load_model(
            str(model_path)
        )

    return _model