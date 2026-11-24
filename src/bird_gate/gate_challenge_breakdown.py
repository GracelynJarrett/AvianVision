# gate_challenge_breakdown.py
#
# Purpose: Loads the final bird gate model (MLflow run "gate-base-frozen-HT-final"),
# scores one split (challenge or test), and shows where the gate makes mistakes:
# not-birds it lets through as birds, and real birds it blocks. It also compares
# several cut-offs side by side, so we can see what a higher or lower cut-off costs.
#
# This script only reads. It does not retrain, log to MLflow, or write any files.
# Run it in WSL, because the model was saved from WSL.
#
# Usage (from the project root):
#   python -m src.bird_gate.gate_challenge_breakdown                  (challenge set, cut-off 0.5)
#   python -m src.bird_gate.gate_challenge_breakdown --split test     (test set)
#   python -m src.bird_gate.gate_challenge_breakdown --split test --cutoff 0.75

import argparse

import mlflow
import mlflow.tensorflow
import pandas as pd

from src.help_read_yaml import read_yaml
from src.mlflow_setup import setup_mlflow
from src.bird_gate.gate_preprocessing import PROJECT_ROOT, SPLIT_CSV, make_split_dataset

# The MLflow experiment and run that hold the final gate model
GATE_EXPERIMENT = "avianvision-bird-gate"
FINAL_RUN_NAME = "gate-base-frozen-HT-final"

# Cut-offs to compare side by side in the comparison table
CUTOFFS_TO_COMPARE = [0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9]


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


def get_kind(row, split):
    """Gives each image a readable group name for the summary table."""
    # Test set: group by label and source, e.g. "bird (aves_del_tolima)"
    if split == "test":
        return f"{row['label']} ({row['source']})"
    # Challenge set: original class if it has one (e.g. "bat"), else the source name
    if pd.notna(row["orig_class"]) and str(row["orig_class"]).strip() != "":
        return str(row["orig_class"])
    return str(row["source"])


def score_images(model, rows, image_size, batch_size):
    """Runs the gate over the images and returns one bird score (0 to 1) per image, in manifest order."""
    # Same loading as training (resize only, no augmentation, no shuffling),
    # so the scores line up with the rows in the manifest
    ds = make_split_dataset(rows, batch_size, image_size, training=False, augmenter=None)
    scores = []
    for images, _ in ds:
        # Sigmoid output: one number per image, how likely it is a bird
        scores.extend(model.predict(images, verbose=0).ravel().tolist())
    return scores


def print_cutoff_comparison(rows):
    """Prints how many birds get blocked and how many not-birds get through at each cut-off."""
    total_birds = int(rows["is_bird"].sum())
    total_not_birds = int((~rows["is_bird"]).sum())

    table = []
    for c in CUTOFFS_TO_COMPARE:
        # A bird is blocked when its score is under the cut-off
        birds_blocked = int((rows["is_bird"] & (rows["bird_score"] < c)).sum())
        # A not-bird gets through when its score is at or above the cut-off
        not_birds_through = int((~rows["is_bird"] & (rows["bird_score"] >= c)).sum())
        table.append({
            "cutoff": c,
            "birds_blocked": f"{birds_blocked} of {total_birds}",
            "bird_recall": round(1 - birds_blocked / total_birds, 4) if total_birds else "n/a",
            "not_birds_through": f"{not_birds_through} of {total_not_birds}",
            "not_bird_recall": round(1 - not_birds_through / total_not_birds, 4) if total_not_birds else "n/a",
        })

    print("\n--- Cut-off comparison ---")
    print(pd.DataFrame(table).to_string(index=False))


def run_breakdown(split, cutoff, show):
    """Scores one split and prints a summary by kind, a cut-off comparison, and the mistakes."""

    # --- Read the image size from the same config training used ---
    image_cfg = read_yaml(PROJECT_ROOT / "configs" / "image_config.yaml")
    image_size = image_cfg["image_size"]

    # --- Keep only the rows for the chosen split ---
    df = pd.read_csv(SPLIT_CSV)
    rows = df[df["split"] == split].reset_index(drop=True)
    print(f"{split} images: {len(rows)}")

    # --- Load the model and score every image once ---
    model = load_final_gate_model()
    rows["bird_score"] = score_images(model, rows, image_size, batch_size=32)

    # --- Mark the true label, what the gate called it, and whether that was a mistake ---
    rows["kind"] = rows.apply(lambda r: get_kind(r, split), axis=1)
    rows["is_bird"] = rows["label"] == "bird"
    rows["called_bird"] = rows["bird_score"] >= cutoff
    rows["mistake"] = rows["called_bird"] != rows["is_bird"]

    # One line per kind: how many images, how many the gate called bird, how many mistakes
    summary = (
        rows.groupby("kind")
        .agg(
            images=("path", "count"),
            called_bird=("called_bird", "sum"),
            mistakes=("mistake", "sum"),
            avg_score=("bird_score", "mean"),
            min_score=("bird_score", "min"),
            max_score=("bird_score", "max"),
        )
        .sort_values("mistakes", ascending=False)
    )
    summary["called_not_bird"] = summary["images"] - summary["called_bird"]
    summary["mistake_pct"] = (summary["mistakes"] / summary["images"] * 100).round(1)
    summary = summary[["images", "called_bird", "called_not_bird", "mistakes", "mistake_pct",
                       "avg_score", "min_score", "max_score"]]

    # --- Print the results ---
    pd.set_option("display.width", 200)
    pd.set_option("display.max_rows", 500)

    print(f"\n--- {split} breakdown by kind (cut-off {cutoff}) ---")
    print(summary.round(3).to_string())

    # Totals for both kinds of mistakes at the chosen cut-off
    not_birds_through = rows[~rows["is_bird"] & rows["called_bird"]]
    birds_blocked = rows[rows["is_bird"] & ~rows["called_bird"]]
    print(f"\nNot-birds let through as birds: {len(not_birds_through)} of {int((~rows['is_bird']).sum())}")
    print(f"Birds blocked as not-birds:     {len(birds_blocked)} of {int(rows['is_bird'].sum())}")

    # Same images, judged at several cut-offs
    print_cutoff_comparison(rows)

    # Not-birds that got through, highest bird score first (the most confident mistakes)
    if len(not_birds_through) > 0:
        print(f"\n--- Not-birds let through (highest score first, showing up to {show}) ---")
        print(not_birds_through.sort_values("bird_score", ascending=False)
              [["kind", "path", "bird_score"]].head(show).round(3).to_string(index=False))

    # Birds that got blocked, lowest bird score first (the most confident mistakes)
    if len(birds_blocked) > 0:
        print(f"\n--- Birds blocked (lowest score first, showing up to {show}) ---")
        print(birds_blocked.sort_values("bird_score", ascending=True)
              [["kind", "path", "bird_score"]].head(show).round(3).to_string(index=False))

    # Near misses: not-birds that were blocked, but scored 0.2 or more
    near = rows[~rows["is_bird"] & ~rows["called_bird"] & (rows["bird_score"] >= 0.2)]
    print(f"\n--- Near misses: not-birds blocked, but bird score 0.2 or higher ({len(near)}, showing up to {show}) ---")
    if len(near) > 0:
        print(near.sort_values("bird_score", ascending=False)
              [["kind", "path", "bird_score"]].head(show).round(3).to_string(index=False))


# Run the breakdown when this file is executed directly
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Show where the final bird gate makes mistakes on the challenge or test set."
    )
    parser.add_argument(
        "--split",
        type=str,
        default="challenge",
        choices=["challenge", "test"],
        help="Which set to score (default challenge).",
    )
    parser.add_argument(
        "--cutoff",
        type=float,
        default=0.5,
        help="Bird score at or above this counts as a bird (default 0.5, same as training).",
    )
    parser.add_argument(
        "--show",
        type=int,
        default=40,
        help="How many images to list in each mistakes list (default 40).",
    )
    args = parser.parse_args()
    run_breakdown(split=args.split, cutoff=args.cutoff, show=args.show)