"""
Combine the bird gate manifests and split them into train, val, test, and challenge.
Run from the project root: python src/bird_gate/commbind_split_data.py
"""
import hashlib
from pathlib import Path

import pandas as pd

# ---- Settings (change these here) ----
RAW_DIR = Path("data/bird_gate/raw")
OUTPUT_CSV = Path("data/bird_gate/split_manifest.csv")
SEED = 42
VAL_SHARE = 0.25                # 75/25 train/val
AIRPLANE_CHALLENGE_SHARE = 0.30 # 30% of airplanes go to the challenge set
CUB_MAX = 6000
AVES_PER_SPECIES = 270

# Caltech classes that are birds (or birdbath) and must never be negatives
CALTECH_REMOVE = ["cormorant", "duck", "goose", "hummingbird", "ibis-101",
                  "ostrich", "owl", "penguin", "swan", "birdbath"]
# Caltech classes held out for the challenge set only (names match the manifest)
CALTECH_CHALLENGE = ["fighter_jet", "helicopter", "hot_air_balloon",
                     "blimp", "bat", "butterfly", "house_fly"]
AIRPLANE_CLASS = "airplanes"


def load_manifests():
    """Read all five manifest CSVs and stack them into one table."""
    # Each file has the same columns, so they can be joined end to end
    names = ["manifest_aves_tolima.csv", "manifest_bird_vs_drone.csv",
             "manifest_caltech.csv", "manifest_cub.csv", "manifest_places365.csv"]
    tables = [pd.read_csv(RAW_DIR / n) for n in names]
    return pd.concat(tables, ignore_index=True)


def check_class_names(df):
    """Warn about any Caltech class name in the settings that is not in the data."""
    # Collect the real class names, written in lowercase for a fair match
    found = set(df.loc[df["source"] == "caltech", "orig_class"].dropna().str.lower())
    # Report each name we expected but did not find, so it can be fixed by hand
    for name in CALTECH_REMOVE + CALTECH_CHALLENGE + [AIRPLANE_CLASS]:
        if name.lower() not in found:
            print(f"WARNING: Caltech class '{name}' not found. Check the spelling.")


def file_hash(rel_path):
    """Return a fingerprint of an image file so exact copies can be spotted."""
    # Read the file's bytes and turn them into a short unique code
    return hashlib.md5((RAW_DIR / rel_path).read_bytes()).hexdigest()


def split_caltech(df):
    """Remove bird classes, then send challenge classes and 30% of airplanes to the challenge set."""
    cal = df[df["source"] == "caltech"].copy()
    cls = cal["orig_class"].fillna("").str.lower()

    # Drop bird classes so no bird is ever labeled "not bird"
    keep = ~cls.isin([c.lower() for c in CALTECH_REMOVE])
    cal, cls = cal[keep], cls[keep]

    # Held-out challenge classes go straight to the challenge set
    cal["split"] = "trainval"
    cal.loc[cls.isin([c.lower() for c in CALTECH_CHALLENGE]), "split"] = "challenge"

    # Randomly pick 30% of airplanes for the challenge set
    planes = cal[cls == AIRPLANE_CLASS]
    to_challenge = planes.sample(frac=AIRPLANE_CHALLENGE_SHARE, random_state=SEED).index
    cal.loc[to_challenge, "split"] = "challenge"
    return cal


def build(test_rows=None, save=True):
    """Combine every source, balance the classes, and assign each image a split.
    test_rows: if set, keep only this many images per class (for a quick test).
    save: if False, nothing is written to disk."""
    df = load_manifests()
    check_class_names(df)

    # In test mode, keep a few images from every class so each step still runs
    if test_rows:
        df = df.groupby(["source", "orig_class"], dropna=False).head(test_rows)
        print(f"TEST MODE: using {len(df)} images.")

    # Remove exact duplicate images (same file bytes) across all sources
    df["hash"] = df["path"].apply(file_hash)
    before = len(df)
    df = df.drop_duplicates(subset="hash", keep="first")
    print(f"Removed {before - len(df)} exact duplicate images.")

    # Birds for train/val: up to 6,000 CUB plus all Bird vs Drone birds
    cub = df[df["source"] == "cub"]
    cub = cub.sample(n=min(CUB_MAX, len(cub)), random_state=SEED)
    bvd = df[df["source"] == "bird_vs_drone"]
    birds = pd.concat([cub, bvd[bvd["label"] == "bird"]])

    # Not-birds for train/val: all drones, train airplanes, then other Caltech to fill
    cal = split_caltech(df)
    drones = bvd[bvd["label"] == "not_bird"]
    cal_tv = cal[cal["split"] == "trainval"]
    is_plane = cal_tv["orig_class"].fillna("").str.lower() == AIRPLANE_CLASS
    room = max(len(birds) - len(drones) - is_plane.sum(), 0)
    others = cal_tv[~is_plane]
    others = others.sample(n=min(room, len(others)), random_state=SEED)
    not_birds = pd.concat([drones, cal_tv[is_plane], others])

    # Split train/val 75/25, keeping the bird/not-bird ratio the same in both
    trainval = pd.concat([birds, not_birds])
    val_idx = trainval.groupby("label", group_keys=False).sample(
        frac=VAL_SHARE, random_state=SEED).index
    trainval["split"] = "train"
    trainval.loc[val_idx, "split"] = "val"

    # Test birds: 270 per Aves del Tolima species
    aves = df[df["source"] == "aves_tolima"]
    aves = aves.groupby("orig_class", group_keys=False).apply(
        lambda g: g.sample(n=min(AVES_PER_SPECIES, len(g)), random_state=SEED))
    # Test not-birds: the whole Places365 sample
    places = df[df["source"] == "places365"]
    test = pd.concat([aves, places])
    test["split"] = "test"

    # Challenge set: held-out Caltech classes and 30% of airplanes
    challenge = cal[cal["split"] == "challenge"]

    # Save everything into one CSV and print a summary table
    out = pd.concat([trainval, test, challenge], ignore_index=True)
    if save:
        out.to_csv(OUTPUT_CSV, index=False)
        print(f"Saved {len(out)} rows to {OUTPUT_CSV}")
    else:
        print("TEST MODE: nothing was saved.")
    return out


def quick_test():
    """Check the inputs, run a tiny build, and confirm the output follows the rules."""
    df = load_manifests()

    # Make sure every manifest has the columns the script needs
    needed = {"path", "label", "source", "orig_class"}
    missing_cols = needed - set(df.columns)
    assert not missing_cols, f"Missing columns: {missing_cols}"

    # Make sure the image files the manifests point to really exist
    missing = [p for p in df["path"] if not (RAW_DIR / p).exists()]
    print(f"{len(missing)} of {len(df)} image files are missing.")
    if missing:
        print("First few missing:", missing[:5])

    # Run the whole build on a few images per class, without saving
    out = build(test_rows=5, save=False)

    # No image may appear in more than one split
    assert out["path"].is_unique, "An image ended up in two splits."
    # No removed bird class may appear as a negative
    bad = out["orig_class"].fillna("").str.lower().isin(
        [c.lower() for c in CALTECH_REMOVE])
    assert not bad.any(), "A removed Caltech bird class is still in the data."
    # Test sources must never be in train or val
    leaked = out[out["source"].isin(["aves_tolima", "places365"])
                 & out["split"].isin(["train", "val"])]
    assert leaked.empty, "Test images leaked into train/val."
    print("All checks passed.")


if __name__ == "__main__":
    import sys
    # Run "python src/bird_gate/commbind_split_data.py --test" for the quick test
    if "--test" in sys.argv:
        quick_test()
    else:
        build()