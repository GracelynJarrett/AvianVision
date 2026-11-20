# gate_hypertuning.py
#
# Purpose: Runs hypertuning experiments for the AvianVision bird gate.
# It works like train.py, but each run unfreezes sections of EfficientNetB0
# (base, middle, end) and uses its own learning rate, dropout, epochs, and batch size.
# Every run also uses the augmentation picked from the augmentation experiments
# (color-focus-DA), named by "augmentation_run" in the config.
# All 8 experiments are defined in configs/gate_hypertuning_experiments.yaml.
# The test and challenge sets are NOT used here. They are held out for the final chosen model.
#
# Usage (from the project root):
#   python -m src.bird_gate.gate_hypertuning --run gate-base-middle-frozen-HT

import argparse
from pathlib import Path

import mlflow
from sklearn.metrics import f1_score, recall_score

from src.help_read_yaml import read_yaml
from src.mlflow_setup import setup_mlflow
from src.species_classifier.hypertuning import count_trainable_params
from src.bird_gate.gate_preprocessing import get_gate_datasets
from src.bird_gate.gate_model_builder import build_gate_model

# The MLflow experiment every bird gate run is filed under
GATE_EXPERIMENT = "avianvision-bird-gate"


def gate_hypertuning(run_name):
    """Runs one gate hypertuning experiment: loads config + data, builds the model, trains it, and logs to MLflow."""

    # --- Read the config files ---
    project_root = Path(__file__).resolve().parents[2]
    ht_experiments = read_yaml(project_root / "configs" / "gate_hypertuning_experiments.yaml")
    aug_experiments = read_yaml(project_root / "configs" / "gate_augmentation_experiments.yaml")
    image_cfg = read_yaml(project_root / "configs" / "image_config.yaml")

    # --- Check that the requested run exists ---
    if run_name not in ht_experiments:
        print(f"Error: '{run_name}' not found in gate_hypertuning_experiments.yaml.")
        print(f"Available runs: {list(ht_experiments.keys())}")
        return
    ht_cfg = ht_experiments[run_name]

    # --- Look up the augmentation settings this run should use ---
    aug_name = ht_cfg["augmentation_run"]
    if aug_name not in aug_experiments:
        print(f"Error: augmentation '{aug_name}' not found in gate_augmentation_experiments.yaml.")
        return
    aug_cfg = aug_experiments[aug_name]
    augmentation_enabled = aug_cfg["augmentation_enabled"]
    augmentation = aug_cfg["augmentation"]

    # --- Build the datasets (only train and val are used here) ---
    train_ds, val_ds, test_ds, challenge_ds, class_names = get_gate_datasets(
        batch_size=ht_cfg["batch_size"],
        image_size=image_cfg["image_size"],
        augmentation_enabled=augmentation_enabled,
        augmentation=augmentation,
    )

    # --- Build the model with this run's section freezing ---
    model = build_gate_model(ht_cfg, image_size=image_cfg["image_size"])

    # Count trainable parameters so we can see how much of the network was training
    trainable_params = count_trainable_params(model)

    # --- Point MLflow at the bird gate experiment ---
    setup_mlflow(GATE_EXPERIMENT)

    with mlflow.start_run(run_name=run_name):
        # Record every setting so the run can be repeated exactly
        mlflow.log_params(ht_cfg)
        mlflow.log_param("image_size", image_cfg["image_size"])
        mlflow.log_param("augmentation_enabled", augmentation_enabled)
        mlflow.log_param("trainable_params", trainable_params)
        if augmentation_enabled:
            mlflow.log_params({f"aug_{k}": v for k, v in augmentation.items()})

        # Train, checking the validation set after each epoch
        history = model.fit(train_ds, validation_data=val_ds, epochs=ht_cfg["epochs"])

        # --- Log each epoch's metrics so the learning curve shows in MLflow ---
        names = ["loss", "accuracy", "auc", "precision", "recall"]
        for epoch in range(ht_cfg["epochs"]):
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


# Run the experiment when this file is executed directly
if __name__ == "__main__":
    # --run is required: there is no default experiment for hypertuning
    parser = argparse.ArgumentParser(description="Run a bird gate hypertuning experiment.")
    parser.add_argument("--run", type=str, required=True,
                        help="Name of the experiment to run (from gate_hypertuning_experiments.yaml).")
    args = parser.parse_args()
    gate_hypertuning(run_name=args.run)