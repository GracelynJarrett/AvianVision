# register_model.py
#
# Purpose: Registers the chosen model artifact from its MLflow run into the MLflow
# model registry. This gives the model an official name and version so it can be
# loaded by name in the Phase 4 prediction API.
#
# Run AFTER add_testset.py — the model artifact must exist in the run before
# it can be registered.
#
# Usage:
#   python src/register_model.py --run-id 55947bdfa48e4b3daa329a3be608fde7
#
# Optional: override the default model name
#   python src/register_model.py --run-id <id> --model-name my-custom-name

import argparse

import mlflow

from mlflow_setup import setup_mlflow


def register(run_id, model_name):
    """Registers the model artifact from the given MLflow run into the model registry."""

    # Point MLflow at the project's tracking database so it knows where to look.
    setup_mlflow()

    # Build the URI that points to the model artifact logged by add_testset.py.
    model_uri = f"runs:/{run_id}/model"

    # Register the model — MLflow creates version 1 the first time, and increments
    # the version number automatically on every subsequent registration.
    print(f"Registering '{model_name}' from run {run_id}...")
    model_version = mlflow.register_model(model_uri=model_uri, name=model_name)

    # Print a confirmation so there is a clear record of what was registered.
    print(f"\nModel registered successfully.")
    print(f"  Name:    {model_version.name}")
    print(f"  Version: {model_version.version}")
    print(f"  Run ID:  {model_version.run_id}")
    print(f"\nTo load this model later:")
    print(f"  mlflow.tensorflow.load_model('models:/{model_name}/{model_version.version}')")


# Run the registration when this file is executed directly.
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Register the chosen model into the MLflow model registry."
    )
    parser.add_argument(
        "--run-id",
        type=str,
        required=True,
        dest="run_id",
        help="MLflow run ID whose model artifact will be registered.",
    )
    parser.add_argument(
        "--model-name",
        type=str,
        default="avianvision-bird-classifier",
        dest="model_name",
        help="Name to register the model under (default: avianvision-bird-classifier).",
    )
    args = parser.parse_args()
    register(run_id=args.run_id, model_name=args.model_name)
