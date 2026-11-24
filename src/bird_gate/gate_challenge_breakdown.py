# gate_challenge_breakdown.py
#
# Purpose: Loads the final bird gate model (MLflow run "gate-base-frozen-HT-final"),
# scores only the challenge images, and shows which kinds of not-birds the gate lets
# through as birds. The challenge set is all not-birds (7 held-out Caltech classes +
# 30% of airplanes), so any image scored at or above the cut-off is a mistake.
#
# This script only reads. It does not retrain, log to MLflow, or write any files.
#
# Usage (from the project root):
#   python -m src.bird_gate.gate_challenge_breakdown
#   python -m src.bird_gate.gate_challenge_breakdown --cutoff 0.5

import argparse

import mlflow
import mlflow.tensorflow
import pandas as pd
import tensorflow as tf

from src.help_read_yaml import read_yaml
from src.mlflow_setup import setup_mlflow
from src.bird_gate.gate_preprocessing import PROJECT_ROOT, SPLIT_CSV, make_split_dataset

# The MLflow experiment and run that hold the final gate model
GATE_EXPERIMENT = "avianvision-bird-gate"
FINAL_RUN_NAME = "gate-base-frozen-HT-final"


def load_final_gate_model():
    """Finds the final gate run in MLflow by its name and loads the model saved in it."""
    # Point MLflow at the same tracking setup the gate runs used
    setup_mlflow(GATE_EXPERIMENT)

    # Look up the run by its name, newest first, in case it was ever run more than once
    runs = mlflow.search_runs(
        experiment_names=[GATE_EXPERIMENT],
        filter_string=f"tags.mlflow.runName = '{FINAL_RUN_NAME}'",
        order_by=["start_time DESC"],
    )
    if runs.empty:
        raise ValueError(f"No MLflow run named '{FINAL_RUN_NAME}' found in '{GATE_EXPERIMENT}'.")

    run_id = runs.iloc[0]["run_id"]
    print(f"Loading gate model from run {FINAL_RUN_NAME} ({run_id})...")
    return mlflow.tensorflow.load_model(f"runs:/{run_id}/model")


def get_kind(row):
    """Gives each challenge image a readable group name: its original class if it has one, else its source."""
    # orig_class is blank for some sources, so fall back to the source name
    if pd.notna(row["orig_class"]) and str(row["orig_class"]).strip() != "":
        return str(row["orig_class"])
    return str(row["source"])


def score_challenge_images(model, rows, image_size, batch_size):
    """Runs the gate over the challenge images and returns one bird score (0 to 1) per image, in manifest order."""
    # Same loading as training (resize only, no augmentation, no shuffling),
    # so the scores line up with the rows in the manifest
    ds = make_split_dataset(rows, batch_size, image_size, training=False, augmenter=None)
    scores = []
    for images, _ in ds:
        # Sigmoid output: one number per image, how likely it is a bird
        scores.extend(model.predict(images, verbose=0).ravel().tolist())
    return scores


def run_challenge_breakdown(cutoff):
    """Scores the challenge set and prints how many images of each kind got through as birds."""

    # --- Read the image size from the same config training used ---
    image_cfg = read_yaml(PROJECT_ROOT / "configs" / "image_config.yaml")
    image_size = image_cfg["image_size"]

    # --- Keep only the challenge rows from the manifest ---
    df = pd.read_csv(SPLIT_CSV)
    rows = df[df["split"] == "challenge"].reset_index(drop=True)
    print(f"Challenge images: {len(rows)}")

    # --- Load the model and score every challenge image ---
    model = load_final_gate_model()
    rows["bird_score"] = score_challenge_images(model, rows, image_size, batch_size=32)

    # --- Mark which ones got through (scored as bird) and group them by kind ---
    rows["kind"] = rows.apply(get_kind, axis=1)
    rows["let_through"] = rows["bird_score"] >= cutoff

    # One line per kind: how many images, how many got through, and score summary
    summary = (
        rows.groupby("kind")
        .agg(
            images=("path", "count"),
            let_through=("let_through", "sum"),
            avg_score=("bird_score", "mean"),
            max_score=("bird_score", "max"),
        )
        .sort_values("let_through", ascending=False)
    )
    summary["blocked"] = summary["images"] - summary["let_through"]
    summary["let_through_pct"] = (summary["let_through"] / summary["images"] * 100).round(1)
    summary = summary[["images", "blocked", "let_through", "let_through_pct", "avg_score", "max_score"]]

    # --- Print the results ---
    pd.set_option("display.width", 200)
    pd.set_option("display.max_rows", 500)

    print(f"\n--- Challenge breakdown by kind (cut-off {cutoff}) ---")
    print(summary.round(3).to_string())

    total_through = int(rows["let_through"].sum())
    print(f"\nTotal let through as birds: {total_through} of {len(rows)}")

    # Every image that got through, highest bird score first, so you can open and look at them
    through = rows[rows["let_through"]].sort_values("bird_score", ascending=False)
    print("\n--- Images let through (highest bird score first) ---")
    print(through[["kind", "path", "orig_name", "bird_score"]].round(3).to_string(index=False))

    # Near misses: blocked, but scored fairly high. These would get through at a lower cut-off
    near = rows[(~rows["let_through"]) & (rows["bird_score"] >= 0.2)].sort_values("bird_score", ascending=False)
    print(f"\n--- Near misses: blocked, but bird score 0.2 or higher ({len(near)}) ---")
    if len(near) > 0:
        print(near[["kind", "path", "bird_score"]].round(3).to_string(index=False))


# Run the breakdown when this file is executed directly
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Show which challenge images the final bird gate lets through, grouped by kind."
    )
    parser.add_argument(
        "--cutoff",
        type=float,
        default=0.5,
        help="Bird score at or above this counts as a bird (default 0.5, same as training).",
    )
    args = parser.parse_args()
    run_challenge_breakdown(cutoff=args.cutoff)