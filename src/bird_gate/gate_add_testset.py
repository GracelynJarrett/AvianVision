# gate_add_testset.py
#
# Purpose: Re-trains the chosen bird gate model (since weights were not saved during
# the hypertuning run), then scores it on the held-out test set and challenge set for
# the first and only time. It logs train, val, test, and challenge results in ONE MLflow
# run, so every set's numbers are kept together for the records. The train/val/test split
# comes from split_manifest.csv, so adding the test set does not shrink train or val.
# It also logs the model, confusion matrices, and classification reports to a new
# dedicated MLflow run in "avianvision-bird-gate".
#
# Labels: 1 = bird, 0 = not-bird (same as train.py).
# The challenge set is all not-birds (held-out Caltech classes + 30% of airplanes),
# so for that set we only measure how many it blocks and how many it lets through.
#
# Usage (from the project root):
#   python -m src.bird_gate.gate_add_testset --run gate-base-frozen-HT

import argparse
import csv
import tempfile
from pathlib import Path

import mlflow
import mlflow.tensorflow
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    recall_score,
)

from src.help_read_yaml import read_yaml
from src.mlflow_setup import setup_mlflow
from src.bird_gate.gate_preprocessing import get_gate_datasets
from src.bird_gate.gate_model_builder import build_gate_model

# The MLflow experiment every bird gate run is filed under
GATE_EXPERIMENT = "avianvision-bird-gate"

# Names for the two labels, in label order (0 = not_bird, 1 = bird)
LABEL_NAMES = ["not_bird", "bird"]


def get_predictions(model, dataset):
    """Runs the model over a whole dataset and returns the true labels and the 0/1 predictions at a 0.5 cut-off."""
    y_true, y_pred = [], []
    for images, labels in dataset:
        # Sigmoid output: one number per image, 0 to 1, how likely it is a bird
        scores = model.predict(images, verbose=0).ravel()
        y_true.extend(labels.numpy().astype(int))
        y_pred.extend((scores >= 0.5).astype(int))
    return y_true, y_pred


def count_images(dataset):
    """Counts how many images are in a dataset by adding up each batch's labels."""
    return int(sum(len(labels) for _, labels in dataset))


def write_confusion_matrix(y_true, y_pred, path):
    """Writes a 2x2 confusion matrix to a CSV file (rows = true label, columns = predicted label)."""
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        # Header row: blank corner cell, then each label as a column
        writer.writerow(["true \\ predicted"] + LABEL_NAMES)
        for i, row in enumerate(cm):
            # Each data row starts with the true label name
            writer.writerow([LABEL_NAMES[i]] + list(row))


def run_gate_test_evaluation(run_name):
    """Re-trains the chosen gate model, scores it on the test and challenge sets, and logs everything to MLflow."""

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

    # --- Use the same augmentation as the original run, so the re-train matches it ---
    aug_cfg = aug_experiments[ht_cfg["augmentation_run"]]
    augmentation_enabled = aug_cfg["augmentation_enabled"]
    augmentation = aug_cfg["augmentation"]

    # --- Build all four datasets. This time test and challenge are actually used ---
    train_ds, val_ds, test_ds, challenge_ds, class_names = get_gate_datasets(
        batch_size=ht_cfg["batch_size"],
        image_size=image_cfg["image_size"],
        augmentation_enabled=augmentation_enabled,
        augmentation=augmentation,
    )

    # --- Re-train the chosen model with the exact same config ---
    print(f"\nRe-training {run_name} to recover model weights...")
    model = build_gate_model(ht_cfg, image_size=image_cfg["image_size"])
    history = model.fit(train_ds, validation_data=val_ds, epochs=ht_cfg["epochs"])

    # --- Count the images in each set, so the record shows the split sizes ---
    train_count = count_images(train_ds)

    # --- Score the val set (same metrics as train.py, so it lines up with the other runs) ---
    val_true, val_pred = get_predictions(model, val_ds)
    val_f1 = f1_score(val_true, val_pred, zero_division=0)
    val_bird_recall = recall_score(val_true, val_pred, pos_label=1, zero_division=0)
    val_not_bird_recall = recall_score(val_true, val_pred, pos_label=0, zero_division=0)

    # --- Score the test set ---
    # model.evaluate returns loss, then the compiled metrics in order: accuracy, auc, precision, recall
    print("\nEvaluating on the held-out test set...")
    test_loss, test_accuracy, test_auc, test_precision, test_recall = model.evaluate(test_ds, verbose=1)
    test_true, test_pred = get_predictions(model, test_ds)
    test_f1 = f1_score(test_true, test_pred, zero_division=0)
    test_bird_recall = recall_score(test_true, test_pred, pos_label=1, zero_division=0)
    test_not_bird_recall = recall_score(test_true, test_pred, pos_label=0, zero_division=0)

    # --- Score the challenge set (all not-birds) ---
    # Accuracy here is the share of not-birds blocked. "Let through" = not-birds called birds.
    print("\nEvaluating on the challenge set...")
    challenge_true, challenge_pred = get_predictions(model, challenge_ds)
    challenge_total = len(challenge_true)
    challenge_let_through = sum(1 for t, p in zip(challenge_true, challenge_pred) if t == 0 and p == 1)
    challenge_accuracy = sum(1 for t, p in zip(challenge_true, challenge_pred) if t == p) / challenge_total

    # --- Log everything to a new dedicated MLflow run ---
    setup_mlflow(GATE_EXPERIMENT)
    final_run_name = f"{run_name}-final"
    with mlflow.start_run(run_name=final_run_name):

        # Record the settings this model was trained with
        mlflow.log_params(ht_cfg)
        mlflow.log_param("image_size", image_cfg["image_size"])
        mlflow.log_param("augmentation_enabled", augmentation_enabled)
        if augmentation_enabled:
            mlflow.log_params({f"aug_{k}": v for k, v in augmentation.items()})

        # Record how many images are in each set
        mlflow.log_params({
            "train_images": train_count,
            "val_images": len(val_true),
            "test_images": len(test_true),
            "challenge_images": challenge_total,
        })

        # --- Train and val metrics for each epoch (same names as train.py) ---
        names = ["loss", "accuracy", "auc", "precision", "recall"]
        for epoch in range(ht_cfg["epochs"]):
            metrics = {}
            for n in names:
                metrics[f"train_{n}"] = history.history[n][epoch]
                metrics[f"val_{n}"] = history.history[f"val_{n}"][epoch]
            mlflow.log_metrics(metrics, step=epoch)

        # Val, test, and challenge summary metrics
        mlflow.log_metrics({
            "val_f1": val_f1,
            "val_bird_recall": val_bird_recall,
            "val_not_bird_recall": val_not_bird_recall,
            "test_loss": test_loss,
            "test_accuracy": test_accuracy,
            "test_auc": test_auc,
            "test_precision": test_precision,
            "test_recall": test_recall,
            "test_f1": test_f1,
            "test_bird_recall": test_bird_recall,
            "test_not_bird_recall": test_not_bird_recall,
            "challenge_accuracy": challenge_accuracy,
            "challenge_let_through": challenge_let_through,
            "challenge_total": challenge_total,
        })

        # --- Artifact 1: model ---
        # Saved the same way as the classifier, so it lands in the models/ folder through MLflow
        print("\nLogging model artifact...")
        mlflow.tensorflow.log_model(model, artifact_path="model")

        # --- Artifacts 2 to 4: files written to a temp folder, then logged ---
        # Using a temp folder so no loose files are left on disk after the run
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Artifact 2: val and test confusion matrices
            val_cm_path = tmpdir / "val_confusion_matrix.csv"
            write_confusion_matrix(val_true, val_pred, val_cm_path)
            mlflow.log_artifact(str(val_cm_path), artifact_path="confusion_matrix")
            test_cm_path = tmpdir / "test_confusion_matrix.csv"
            write_confusion_matrix(test_true, test_pred, test_cm_path)
            mlflow.log_artifact(str(test_cm_path), artifact_path="confusion_matrix")

            # Artifact 3: challenge confusion matrix
            challenge_cm_path = tmpdir / "challenge_confusion_matrix.csv"
            write_confusion_matrix(challenge_true, challenge_pred, challenge_cm_path)
            mlflow.log_artifact(str(challenge_cm_path), artifact_path="confusion_matrix")
            print("Confusion matrices logged.")

            # Artifact 4: val and test classification reports (precision, recall, F1 for each label)
            for set_name, y_true, y_pred in [("val", val_true, val_pred), ("test", test_true, test_pred)]:
                report = classification_report(
                    y_true, y_pred, labels=[0, 1], target_names=LABEL_NAMES, zero_division=0
                )
                report_path = tmpdir / f"{set_name}_classification_report.txt"
                report_path.write_text(report, encoding="utf-8")
                mlflow.log_artifact(str(report_path), artifact_path="classification_report")
            print("Classification reports logged.")

    # Print a summary to the terminal so results are visible without opening MLflow
    print("\n--- Set sizes ---")
    print(f"Train: {train_count}  Val: {len(val_true)}  Test: {len(test_true)}  Challenge: {challenge_total}")
    print("\n--- Train Results (last epoch) ---")
    print(f"Train accuracy:        {history.history['accuracy'][-1]:.4f}")
    print(f"Train AUC:             {history.history['auc'][-1]:.4f}")
    print(f"Train loss:            {history.history['loss'][-1]:.4f}")
    print("\n--- Val Results (should be close to the original run) ---")
    print(f"Val accuracy:          {history.history['val_accuracy'][-1]:.4f}")
    print(f"Val AUC:               {history.history['val_auc'][-1]:.4f}")
    print(f"Val loss:              {history.history['val_loss'][-1]:.4f}")
    print(f"Val F1:                {val_f1:.4f}")
    print(f"Val bird recall:       {val_bird_recall:.4f}")
    print(f"Val not-bird recall:   {val_not_bird_recall:.4f}")
    print("\n--- Test Set Results ---")
    print(f"Test loss:             {test_loss:.4f}")
    print(f"Test accuracy:         {test_accuracy:.4f}")
    print(f"Test AUC:              {test_auc:.4f}")
    print(f"Test F1:               {test_f1:.4f}")
    print(f"Test bird recall:      {test_bird_recall:.4f}")
    print(f"Test not-bird recall:  {test_not_bird_recall:.4f}")
    print("\n--- Challenge Set Results ---")
    print(f"Challenge accuracy:    {challenge_accuracy:.4f}")
    print(f"Let through as birds:  {challenge_let_through} of {challenge_total}")
    print(f"\nAll results logged to MLflow run: {final_run_name}")


# Run the test evaluation when this file is executed directly
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evaluate the chosen bird gate on the test and challenge sets and log results to MLflow."
    )
    parser.add_argument(
        "--run",
        type=str,
        required=True,
        help="Experiment name from gate_hypertuning_experiments.yaml (e.g. gate-base-frozen-HT).",
    )
    args = parser.parse_args()
    run_gate_test_evaluation(run_name=args.run)