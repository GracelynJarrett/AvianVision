# add_testset.py
#
# Purpose: Re-trains the chosen hypertuning model (since weights were not saved during
# the original training run), evaluates it on the held-out test set for the first and
# only time, and logs the final test metrics plus three artifacts (model, confusion
# matrix, classification report) to a new dedicated MLflow run.
#
# Usage:
#   python src/add_testset.py --run base-middle-frozen-low-dropout-HT

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
    precision_score,
    recall_score,
)

from help_read_yaml import read_yaml
from hypertuning import build_model
from mlflow_setup import setup_mlflow
from preprocessing import get_datasets


def run_test_evaluation(run_name):
    """Re-trains the chosen model, evaluates it on the test set, and logs everything to a new dedicated MLflow run."""

    # --- Find and read the config files ---
    # The project root is one level up from this file (which lives in src/).
    project_root = Path(__file__).resolve().parent.parent
    ht_experiments = read_yaml(project_root / "configs" / "hypertuning_experiments.yaml")
    image_cfg = read_yaml(project_root / "configs" / "image_config.yaml")

    # Make sure the requested experiment exists before doing any work.
    if run_name not in ht_experiments:
        print(f"Error: '{run_name}' not found in hypertuning_experiments.yaml.")
        print(f"Available runs: {list(ht_experiments.keys())}")
        return
    ht_cfg = ht_experiments[run_name]

    # --- Build all three datasets — this time we actually use test_ds ---
    # No augmentation: we want clean, unmodified images for the final evaluation.
    train_ds, val_ds, test_ds, class_names = get_datasets(
        batch_size=ht_cfg["batch_size"],
        image_size=image_cfg["image_size"],
        augmentation_enabled=False,
        augmentation={},
    )
    num_classes = len(class_names)

    # --- Re-train the chosen model ---
    # The original training session ended without saving the weights, so we rebuild
    # the model here using the exact same config to match the original experiment.
    print(f"\nRe-training {run_name} to recover model weights...")
    model = build_model(ht_cfg, num_classes=num_classes, image_size=image_cfg["image_size"])
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=ht_cfg["epochs"],
    )

    # --- Evaluate on the held-out test set ---
    # model.evaluate returns loss and the compiled metrics in the order they were added.
    print("\nEvaluating on the held-out test set...")
    test_loss, test_accuracy, test_top5_accuracy = model.evaluate(test_ds, verbose=1)

    # --- Collect predictions for sklearn metrics ---
    # Loop through the test set and gather every true label and model prediction.
    y_true = []
    y_pred = []
    for images, labels in test_ds:
        predictions = model.predict(images, verbose=0)
        y_true.extend(labels.numpy())
        y_pred.extend(predictions.argmax(axis=1))

    # Macro averaging treats every species equally regardless of image count.
    test_macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    test_macro_precision = precision_score(y_true, y_pred, average="macro", zero_division=0)
    test_macro_recall = recall_score(y_true, y_pred, average="macro", zero_division=0)

    # --- Log everything to a new dedicated MLflow run ---
    # A separate run keeps the final test results clean and distinct from the training run.
    setup_mlflow()
    final_run_name = f"{run_name}-final"
    with mlflow.start_run(run_name=final_run_name):

        # Log the 6 test metrics.
        mlflow.log_metrics({
            "test_loss": test_loss,
            "test_accuracy": test_accuracy,
            "test_top5_accuracy": test_top5_accuracy,
            "test_macro_f1": test_macro_f1,
            "test_macro_precision": test_macro_precision,
            "test_macro_recall": test_macro_recall,
        })

        # --- Artifact 1: model ---
        # Saving the model here makes it available for registration in register_model.py.
        print("\nLogging model artifact...")
        mlflow.tensorflow.log_model(model, artifact_path="model")

        # --- Artifacts 2 and 3: files written to a temp folder, then logged ---
        # Using a temp directory so no loose files are left on disk after the run.
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # --- Artifact 2: confusion matrix as CSV ---
            # Rows = true class, columns = predicted class.
            # With 525 classes this is a 526x526 CSV (header + 525 data rows).
            cm = confusion_matrix(y_true, y_pred, labels=list(range(num_classes)))
            cm_path = tmpdir / "confusion_matrix.csv"
            with open(cm_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                # Header row: blank corner cell, then each species name as a column label.
                writer.writerow(["true \\ predicted"] + class_names)
                for i, row in enumerate(cm):
                    # Each data row starts with the true species name.
                    writer.writerow([class_names[i]] + list(row))
            mlflow.log_artifact(str(cm_path), artifact_path="confusion_matrix")
            print("Confusion matrix logged.")

            # --- Artifact 3: classification report as text ---
            # Per-class precision, recall, F1, and support for all 525 species.
            report = classification_report(
                y_true, y_pred, target_names=class_names, zero_division=0
            )
            report_path = tmpdir / "classification_report.txt"
            report_path.write_text(report, encoding="utf-8")
            mlflow.log_artifact(str(report_path), artifact_path="classification_report")
            print("Classification report logged.")

    # Print a summary to the terminal so results are visible without opening MLflow.
    print("\n--- Test Set Results ---")
    print(f"Test loss:            {test_loss:.4f}")
    print(f"Test accuracy:        {test_accuracy:.4f}")
    print(f"Test top-5 accuracy:  {test_top5_accuracy:.4f}")
    print(f"Test macro F1:        {test_macro_f1:.4f}")
    print(f"Test macro precision: {test_macro_precision:.4f}")
    print(f"Test macro recall:    {test_macro_recall:.4f}")
    print(f"\nAll results logged to MLflow run: {final_run_name}")


# Run the test evaluation when this file is executed directly.
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evaluate the chosen model on the held-out test set and log results to MLflow."
    )
    parser.add_argument(
        "--run",
        type=str,
        required=True,
        help="Experiment name from hypertuning_experiments.yaml (e.g. base-middle-frozen-low-dropout-HT).",
    )
    args = parser.parse_args()
    run_test_evaluation(run_name=args.run)
