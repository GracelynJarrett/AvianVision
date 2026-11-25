# model_loader.py is a file to load the model into fastAPI to be used on the dashboard

import mlflow.tensorflow
from pathlib import Path

_model = None
_gate_model = None

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



def get_gate_model():
    """Loads the bird gate model once and keeps it in memory, so every /predict call reuses it."""
    global _gate_model

    if _gate_model is None:

        # Folder of the final bird gate model (MLflow run gate-base-frozen-HT-final).
        # Loaded by folder path, like the classifier, so it works in Windows too.
        gate_model_path = Path(
            "models/models/m-2bc7282608834f9b99ccb215afe6edef/artifacts"
        )

        _gate_model = mlflow.tensorflow.load_model(
            str(gate_model_path)
        )

    return _gate_model