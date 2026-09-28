# train.py
#
# Purpose: The runner that ties Phase 2 together. It reads the config files, builds
# the data pipelines (training + validation only), builds the EfficientNetB0 model,
# trains it, and logs the whole run to MLflow. The TEST set is deliberately NOT used
# here — it is held out for one final, unbiased score on the chosen model later.

from pathlib import Path

import mlflow

from help_read_yaml import read_yaml
from preprocessing import get_datasets
from model_builder import build_model
from mlflow_setup import setup_mlflow


def train():
    """Runs one training experiment: loads config + data, builds the model, trains it, and logs to MLflow."""

    # --- Find and read the two config files ---
    # The project root is one level up from this file (which lives in src/).
    project_root = Path(__file__).resolve().parent.parent
    model_cfg = read_yaml(project_root / "configs" / "model_config.yaml")
    image_cfg = read_yaml(project_root / "configs" / "image_config.yaml")

    # --- Build the data pipelines (train + validation only; test is held out) ---
    # Settings come straight from the config files, so changing a config changes the run.
    train_ds, val_ds, test_ds, class_names = get_datasets(
        batch_size=model_cfg["batch_size"],
        image_size=image_cfg["image_size"],
        augmentation_enabled=image_cfg["augmentation_enabled"],
        augmentation=image_cfg["augmentation"],
    )
    # test_ds is intentionally left unused here — we only touch it for the final model.
    num_classes = len(class_names)

    # --- Build and compile the model from the model config ---
    model = build_model(model_cfg, num_classes=num_classes, image_size=image_cfg["image_size"])

    # --- Point MLflow at our project's tracking database and turn on auto-logging ---
    # autolog automatically records the model's metrics (loss/accuracy) each epoch.
    setup_mlflow()
    mlflow.tensorflow.autolog()

    # --- Train inside one MLflow run so everything is grouped and reproducible ---
    # The run name comes from the config if set, otherwise defaults to "baseline".
    run_name = model_cfg.get("run_name", "baseline")
    with mlflow.start_run(run_name=run_name):
        # Record the exact settings used for this run, so it can be reproduced later.
        mlflow.log_params(model_cfg)
        mlflow.log_param("image_size", image_cfg["image_size"])
        mlflow.log_param("augmentation_enabled", image_cfg["augmentation_enabled"])
        mlflow.log_param("num_classes", num_classes)

        # Train on the training set, checking accuracy on the validation set each epoch.
        model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=model_cfg["epochs"],
        )


# Run the training when this file is executed directly.
if __name__ == "__main__":
    train()
