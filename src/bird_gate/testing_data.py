import pandas as pd, glob
from pathlib import Path

RAW = Path(__file__).resolve().parents[2] / "data"/"bird_gate" / "raw"   # src/bird_gate/ -> project root
print("Looking in:", RAW, "| exists:", RAW.exists())

files = glob.glob(str(RAW / "manifest_*.csv"))
print("Manifests found:", [Path(f).name for f in files])
m = pd.concat([pd.read_csv(f) for f in files])

cal = m[m.source == "caltech"]
print("Caltech classes kept:", cal.orig_class.nunique())
print("Removed classes still present (must be empty):",
      sorted(set(cal.orig_class) & {"cormorant","duck","goose","hummingbird","ibis","ostrich","owl","penguin","swan","birdbath"}))
print("Hard classes found:", sorted(c for c in cal.orig_class.unique()
      if c in {"airplanes","fighter_jet","helicopter","hot_air_balloon","blimp","bat","butterfly","house_fly"}), "\n")

aves = m[m.source == "aves_tolima"]
print("Aves species:", aves.orig_class.nunique(), "(expect 11)")
print(aves.groupby("orig_class").size(), "\n")

places = m[m.source == "places365"]
print("Places scenes:", places.orig_class.nunique())
print("Needed scenes missing:", sorted({"sky","skyscraper","snowfield","volcano","runway","hangar_outdoor","oilrig","lighthouse"} - set(places.orig_class)))
print(m.groupby(["source", "label"]).size())


# ---------------- Hidden bird screen ----------------
import numpy as np
import tensorflow as tf

SPLIT_CSV = RAW.parent / "split_manifest.csv"
SCORES_CSV = RAW.parent / "hidden_bird_scores.csv"
BATCH = 32

# ImageNet class numbers that are birds (cock to great grey owl,
# black grouse to black swan, white stork to albatross)
BIRD_IDS = list(range(7, 25)) + list(range(80, 101)) + list(range(127, 147))


def load_batch(paths):
    """Open a group of images and resize them to the 224x224 size EfficientNetB0 expects."""
    # Load each picture as RGB, resize it, and turn it into numbers
    images = [tf.keras.utils.img_to_array(
        tf.keras.utils.load_img(RAW / p, target_size=(224, 224), color_mode="rgb"))
        for p in paths]
    return np.stack(images)


def screen_hidden_birds():
    """Score every not-bird image for how bird-like it looks, and save a sorted list for review."""
    # Load the standard ImageNet EfficientNetB0 (it rescales pixels by itself)
    model = tf.keras.applications.EfficientNetB0(weights="imagenet")

    # Only the not-bird images need screening
    df = pd.read_csv(SPLIT_CSV)
    df = df[df["label"] == "not_bird"].reset_index(drop=True)
    print(f"Screening {len(df)} not-bird images...")

    # Score images in small groups so memory stays low
    scores, top_ids = [], []
    for start in range(0, len(df), BATCH):
        batch = load_batch(df["path"].iloc[start:start + BATCH])
        probs = model.predict(batch, verbose=0)
        # Add up the chance of every bird class: this is the "bird score"
        scores.extend(probs[:, BIRD_IDS].sum(axis=1))
        # Also keep the single most likely ImageNet class, to help the review
        top_ids.extend(probs.argmax(axis=1))
        if start % (BATCH * 50) == 0:
            print(f"  {start} / {len(df)} done")

    # Turn class numbers into names, like "goldfinch" or "airliner"
    names = tf.keras.applications.efficientnet.decode_predictions(
        np.eye(1000), top=1)
    df["top_imagenet_class"] = [names[i][0][1] for i in top_ids]
    df["bird_score"] = scores

    # Save highest scores first, so the likely hidden birds are at the top
    df.sort_values("bird_score", ascending=False).to_csv(SCORES_CSV, index=False)
    print(f"Saved scores to {SCORES_CSV}")
    print("Images with bird score above 0.5:", (df["bird_score"] > 0.5).sum())
    print(df.groupby("source")["bird_score"].apply(lambda s: (s > 0.5).sum()))

from PIL import Image

MAX_DIFF = 5  # how many of the 64 fingerprint dots may differ and still count as "similar"
GROUPS_CSV = RAW.parent / "bvd_groups.csv"  # where the image groups get saved

def fingerprint(rel_path):
    """Shrink an image to 8x8 gray dots and mark each dot as lighter or darker than average."""
    # Make the image tiny and gray so only its rough shape is left
    img = Image.open(RAW / rel_path).convert("L").resize((8, 8))
    dots = np.asarray(img, dtype=float)
    # Each dot becomes True (light) or False (dark): this is the fingerprint
    return (dots > dots.mean()).flatten()


def find_similar_groups():
    """Group Bird vs Drone images whose fingerprints are almost the same, and print the groups."""
    df = pd.read_csv(SPLIT_CSV)
    bvd = df[df["source"] == "bird_vs_drone"].reset_index(drop=True)

    # Make a fingerprint for every Bird vs Drone image
    prints = np.stack([fingerprint(p) for p in bvd["path"]])

    # Count how many dots differ between every pair of images
    diffs = (prints[:, None, :] != prints[None, :, :]).sum(axis=2)
    similar = diffs <= MAX_DIFF

    # Join images into groups: if A looks like B and B looks like C, all three are one group
    group = [-1] * len(bvd)
    next_id = 0
    for start in range(len(bvd)):
        if group[start] != -1:
            continue
        to_visit = [start]
        group[start] = next_id
        while to_visit:
            i = to_visit.pop()
            for j in np.where(similar[i])[0]:
                if group[j] == -1:
                    group[j] = next_id
                    to_visit.append(j)
        next_id += 1
    bvd["group"] = group

    # Show a summary and the biggest groups so they can be checked by eye
    sizes = bvd["group"].value_counts()
    print(f"{len(bvd)} images in {len(sizes)} groups. Groups with 2+ images: {(sizes > 1).sum()}")
    for g in sizes.index[:10]:
        rows = bvd[bvd["group"] == g]
        print(f"\nGroup {g} ({len(rows)} images, label: {rows['label'].iloc[0]}):")
        print("\n".join(rows["path"].head(5)))
        
          # Save each image's group so the split script can keep groups together
    bvd[["path", "group"]].to_csv(GROUPS_CSV, index=False)
    print(f"\nSaved {len(bvd)} rows to {GROUPS_CSV}")
        
if __name__ == "__main__":
    import sys
    # "--groups" runs the similar-image check, otherwise the hidden bird screen runs
    if "--groups" in sys.argv:
        find_similar_groups()
    else:
        screen_hidden_birds()