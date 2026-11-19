# train.py (bird gate)
#
# Purpose: Runs one bird gate training experiment. It reads the configs, builds the
# train/val datasets from split_manifest.csv, builds the gate model, trains it, and
# logs everything to the avianvision-bird-gate MLflow experiment. The test and
# challenge sets are NOT used here. They are held out for the final chosen model.
#
# Usage (from the project root):
#   python -m src.bird_gate.train                        # baseline
#   python -m src.bird_gate.train --run conservative-DA  # an augmentation experiment

import argparse
from pathlib import Path

import mlflow
from sklearn.metrics import f1_score, recall_score

from src.help_read_yaml import read_yaml
from src.mlflow_setup import setup_mlflow
from src.bird_gate.gate_preprocessing import get_gate_datasets
from src.bird_gate.gate_model_builder import build_gate_model

# The MLflow experiment every bird gate run is filed under
GATE_EXPERIMENT = "avianvision-bird-gate"


def train(run_name=None):
    """Runs one bird gate experiment: loads config + data, builds the model, trains it, and logs to MLflow."""

    # --- Read the config files ---
    project_root = Path(__file__).resolve().parents[2]
    model_cfg = read_yaml(project_root / "configs" / "gate_model_config.yaml")
    image_cfg = read_yaml(project_root / "configs" / "image_config.yaml")

    # --- Pick augmentation settings and the run name ---
    # With --run, use that augmentation experiment. Without it, run the baseline (no augmentation)
    if run_name:
        aug_cfg = read_yaml(project_root / "configs" / "gate_augmentation_experiments.yaml")[run_name]
        augmentation_enabled = aug_cfg["augmentation_enabled"]
        augmentation = aug_cfg["augmentation"]
    else:
        run_name = model_cfg.get("run_name", "gate-baseline")
        augmentation_enabled = False
        augmentation = {}

    # --- Build the datasets (only train and val are used here) ---
    train_ds, val_ds, test_ds, challenge_ds, class_names = get_gate_datasets(
        batch_size=model_cfg["batch_size"],
        image_size=image_cfg["image_size"],
        augmentation_enabled=augmentation_enabled,
        augmentation=augmentation,
    )

    # --- Build the model ---
    model = build_gate_model(model_cfg, image_size=image_cfg["image_size"])

    # --- Point MLflow at the bird gate experiment ---
    setup_mlflow(GATE_EXPERIMENT)

    with mlflow.start_run(run_name=run_name):
        # Record every setting so the run can be repeated exactly
        mlflow.log_params(model_cfg)
        mlflow.log_param("image_size", image_cfg["image_size"])
        mlflow.log_param("augmentation_enabled", augmentation_enabled)
        if augmentation_enabled:
            mlflow.log_params({f"aug_{k}": v for k, v in augmentation.items()})

        # Train, checking the validation set after each epoch
        history = model.fit(train_ds, validation_data=val_ds, epochs=model_cfg["epochs"])

        # --- Log each epoch's metrics so the learning curve shows in MLflow ---
        names = ["loss", "accuracy", "auc", "precision", "recall"]
        for epoch in range(model_cfg["epochs"]):
            metrics = {}
            for n in names:
                metrics[f"train_{n}"] = history.history[n][epoch]
                metrics[f"val_{n}"] = history.history[f"val_{n}"][epoch]
            mlflow.log_metrics(metrics, step=epoch)

        # --- Log summary metrics: last epoch and best epoch (by val accuracy) ---
        best_epoch = max(range(len(history.history["val_accuracy"])),
                         key=lambda i: history.history["val_accuracy"][i])
        mlflow.log_metrics({
            "final_val_accuracy": history.history["val_accuracy"][-1],
            "final_val_auc": history.history["val_auc"][-1],
            "best_val_accuracy": history.history["val_accuracy"][best_epoch],
            "best_val_auc": history.history["val_auc"][best_epoch],
            "best_epoch": best_epoch + 1,
        })

        # --- Score the whole val set at a 0.5 cut-off ---
        y_true, y_pred = [], []
        for images, labels in val_ds:
            scores = model.predict(images, verbose=0).ravel()
            y_true.extend(labels.numpy().astype(int))
            y_pred.extend((scores >= 0.5).astype(int))

        # bird recall = real birds let through, not_bird recall = non-birds blocked
        mlflow.log_metrics({
            "val_f1": f1_score(y_true, y_pred, zero_division=0),
            "val_bird_recall": recall_score(y_true, y_pred, pos_label=1, zero_division=0),
            "val_not_bird_recall": recall_score(y_true, y_pred, pos_label=0, zero_division=0),
        })


# Run training when this file is executed directly
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the AvianVision bird gate.")
    parser.add_argument("--run", type=str, default=None,
                        help="Augmentation experiment name (from gate_augmentation_experiments.yaml). Omit for baseline.")
    args = parser.parse_args()
    train(run_name=args.run)