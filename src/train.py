# train.py
#
# Purpose: The runner that ties Phase 2 together. It reads the config files, builds
# the data pipelines (training + validation only), builds the EfficientNetB0 model,
# trains it, and logs the whole run to MLflow. The TEST set is deliberately NOT used
# here — it is held out for one final, unbiased score on the chosen model later.
#
# Usage:
#   python src/train.py                        # runs the baseline (uses image_config.yaml)
#   python src/train.py --run conservative-DA  # runs a named augmentation experiment

import argparse
from pathlib import Path

import mlflow

from help_read_yaml import read_yaml
from preprocessing import get_datasets
from model_builder import build_model
from mlflow_setup import setup_mlflow
from sklearn.metrics import f1_score, precision_score, recall_score

def train(run_name=None):
    """Runs one training experiment: loads config + data, builds the model, trains it, and logs to MLflow."""

    # --- Find and read the two config files ---
    # The project root is one level up from this file (which lives in src/).
    project_root = Path(__file__).resolve().parent.parent
    model_cfg = read_yaml(project_root / "configs" / "model_config.yaml")
    image_cfg = read_yaml(project_root / "configs" / "image_config.yaml")

    # --- Resolve augmentation settings and the run name ---
    # If --run was passed, pull augmentation settings from augmentation_experiments.yaml.
    # Otherwise fall back to image_config.yaml (used for the baseline run).
    if run_name:
        aug_experiments = read_yaml(project_root / "configs" / "augmentation_experiments.yaml")
        aug_cfg = aug_experiments[run_name]
        augmentation_enabled = aug_cfg["augmentation_enabled"]
        augmentation = aug_cfg["augmentation"]
    else:
        run_name = model_cfg.get("run_name", "baseline")
        augmentation_enabled = image_cfg["augmentation_enabled"]
        augmentation = image_cfg.get("augmentation", {})

    # --- Build the data pipelines (train + validation only; test is held out) ---
    # Settings come straight from the resolved augmentation variables above.
    train_ds, val_ds, test_ds, class_names = get_datasets(
        batch_size=model_cfg["batch_size"],
        image_size=image_cfg["image_size"],
        augmentation_enabled=augmentation_enabled,
        augmentation=augmentation,
    )
    
    # test_ds is intentionally left unused here — we only touch it for the final model.
    num_classes = len(class_names)

    # --- Build and compile the model from the model config ---
    model = build_model(model_cfg, num_classes=num_classes, image_size=image_cfg["image_size"])

    # --- Point MLflow at our project's tracking database ---
    # We log every metric explicitly below. MLflow's TensorFlow autolog does not
    # capture metrics with Keras 3 (our setup), so we do not use it here.
    setup_mlflow()

    # --- Train inside one MLflow run so everything is grouped and reproducible ---
    # run_name was resolved above — either from --run or from model_config.yaml.
    with mlflow.start_run(run_name=run_name):
        # Record the exact settings used for this run, so it can be reproduced later.
        mlflow.log_params(model_cfg)
        mlflow.log_param("image_size", image_cfg["image_size"])
        mlflow.log_param("augmentation_enabled", augmentation_enabled)
        mlflow.log_param("num_classes", num_classes)

        # Train on the training set, checking accuracy on the validation set each epoch.
        history = model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=model_cfg["epochs"],
        )
        
        for epoch in range(model_cfg["epochs"]):
            mlflow.log_metrics(
                {
                    "train_loss": history.history["loss"][epoch],
                    "train_accuracy": history.history["accuracy"][epoch],
                    "train_top5_accuracy": history.history["top5_accuracy"][epoch],
                    "val_loss": history.history["val_loss"][epoch],
                    "val_accuracy": history.history["val_accuracy"][epoch],
                    "val_top5_accuracy": history.history["val_top5_accuracy"][epoch],
                },
                step=epoch,
            )
            
            
        #--- Log overall validation metrics after training ---
        
        # final epoch metrics
        final_val_accuracy = history.history["val_accuracy"][-1]
        final_val_top5_accuracy = history.history["val_top5_accuracy"][-1]
        
        # Find the epoch with the best validation accuracy
        best_epoch = max(
            range(len(history.history["val_accuracy"])),
            key=lambda i: history.history["val_accuracy"][i],
        )

        best_val_accuracy = history.history['val_accuracy'][best_epoch]
        best_val_top5_accuracy = history.history["val_top5_accuracy"][best_epoch]
        
        # Log summary metrics to mlflow
        mlflow.log_metrics(
            {
                "final_val_accuracy": final_val_accuracy,
                "final_val_top5_accuracy": final_val_top5_accuracy,
                "best_val_accuracy": best_val_accuracy,
                "best_val_top5_accuracy": best_val_top5_accuracy,
                "best_epoch": best_epoch + 1,
            }
        )

        # --- Calculate validation F1, precision, and recall ---
        y_true = []
        y_pred = []
        
        for images, lables in val_ds:
            predictions = model.predict(images,verbose =0)
            
            y_true.extend(lables.numpy())
            y_pred.extend(predictions.argmax(axis=1))
        
        
        val_f1 = f1_score(
            y_true,
            y_pred,
            average="macro",
            zero_division=0
        )
        
        val_precision = precision_score(
            y_true,
            y_pred,
            average="macro",
            zero_division=0
        )

        val_recall = recall_score(
            y_true,
            y_pred,
            average="macro",
            zero_division=0
        )

        mlflow.log_metrics(
            {
                "val_macro_f1": val_f1,
                "val_macro_precision": val_precision,
                "val_macro_recall": val_recall,
            }
        )


# Run the training when this file is executed directly.
if __name__ == "__main__":
    # Parse the optional --run argument so the caller can select an augmentation experiment.
    parser = argparse.ArgumentParser(description="Train the AvianVision bird classifier.")
    parser.add_argument(
        "--run",
        type=str,
        default=None,
        help="Name of the augmentation experiment (from augmentation_experiments.yaml). Omit for baseline.",
    )
    args = parser.parse_args()
    train(run_name=args.run)
