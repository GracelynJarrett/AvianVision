# mlflow_setup.py
#
# Purpose: Configure MLflow for the AvianVision project. This points MLflow at a
# local SQLite database (so the model registry works later) and selects a single
# named experiment that all training runs will be grouped under. Phase 2 training
# code just imports and calls setup_mlflow() before it starts logging.

from pathlib import Path

import mlflow


# ---- Settings ----
# The project's main folder, worked out from where this file lives (in src/).
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# The SQLite database file that stores all run data (needed for the model registry).
DB_PATH = PROJECT_ROOT / "mlflow.db"

# The folder where saved models and other run artifacts will be stored.
ARTIFACT_PATH = PROJECT_ROOT / "models"

# The name that groups all of this project's runs together in the MLflow UI.
EXPERIMENT_NAME = "avianvision-bird-classification"


def setup_mlflow():
    """Points MLflow at the local SQLite database and selects the project's experiment."""
    # Tell MLflow to store run data in the local SQLite database. Using forward
    # slashes (as_posix) keeps the path valid for SQLite on Windows.
    mlflow.set_tracking_uri(f"sqlite:///{DB_PATH.as_posix()}")

    # The first time only, create the experiment and send its artifacts to models/.
    # On later runs the experiment already exists, so we skip creating it.
    if mlflow.get_experiment_by_name(EXPERIMENT_NAME) is None:
        mlflow.create_experiment(EXPERIMENT_NAME, artifact_location=ARTIFACT_PATH.as_uri())

    # Make this the active experiment so every run is filed under it.
    mlflow.set_experiment(EXPERIMENT_NAME)


# Run a quick test when this file is executed directly, to confirm MLflow is wired up.
if __name__ == "__main__":
    # Apply the configuration above.
    setup_mlflow()

    # Log a tiny throwaway run with one parameter and one metric to prove it works.
    with mlflow.start_run(run_name="setup-test"):
        mlflow.log_param("test_param", 42)
        mlflow.log_metric("test_metric", 0.99)

    # Print where things are stored and how to open the MLflow UI to see the run.
    print("MLflow test run logged successfully.")
    print(f"Tracking database: {DB_PATH}")
    print(f"Experiment:        {EXPERIMENT_NAME}")
    print("\nTo view it, run this from the project root:")
    print("  mlflow ui --backend-store-uri sqlite:///mlflow.db")
    print("Then open http://127.0.0.1:5000 in your browser.")
