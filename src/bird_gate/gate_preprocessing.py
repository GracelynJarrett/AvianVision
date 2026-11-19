# gate_preprocessing.py
#
# Purpose: Turn data/bird_gate/split_manifest.csv into batches of images for the
# bird gate. Labels are bird = 1 and not_bird = 0. Like the classifier, pixels are
# NOT rescaled (EfficientNetB0 does that itself), and only training images are augmented.

from pathlib import Path

import pandas as pd
import tensorflow as tf

from src.preprocessing import build_augmenter, SEED

# ---- Settings ----
# The project's main folder (this file lives in src/bird_gate/)
PROJECT_ROOT = Path(__file__).resolve().parents[2]
# Where the images are, and the CSV that says which split each image is in
RAW_DIR = PROJECT_ROOT / "data" / "bird_gate" / "raw"
SPLIT_CSV = PROJECT_ROOT / "data" / "bird_gate" / "split_manifest.csv"
# Label 0 is not_bird and label 1 is bird
CLASS_NAMES = ["not_bird", "bird"]


def load_image(path, label, image_size):
    """Reads one image file, makes it RGB, and resizes it to the model's size."""
    # Read the file and decode it (works for both jpg and png)
    image = tf.io.decode_image(tf.io.read_file(path), channels=3, expand_animations=False)
    # Resize only. No rescaling, because EfficientNetB0 does that itself
    image = tf.image.resize(image, [image_size, image_size])
    return image, label


def make_split_dataset(df, batch_size, image_size, training=False, augmenter=None):
    """Builds a batched TensorFlow dataset for one split from its manifest rows."""
    # Full path to each image, and 1.0 for bird or 0.0 for not_bird
    paths = [str(RAW_DIR / p) for p in df["path"]]
    labels = (df["label"] == "bird").astype("float32").tolist()
    ds = tf.data.Dataset.from_tensor_slices((paths, labels))

    # Shuffle the whole list for training, so every batch mixes birds and not-birds
    if training:
        ds = ds.shuffle(len(paths), seed=SEED, reshuffle_each_iteration=True)

    # Load the images and group them into batches
    ds = ds.map(lambda p, l: load_image(p, l, image_size), num_parallel_calls=tf.data.AUTOTUNE)
    ds = ds.batch(batch_size)

    # Augment TRAINING batches only. Val, test, and challenge stay as the real images
    if training and augmenter is not None:
        ds = ds.map(lambda x, y: (augmenter(x, training=True), y),
                    num_parallel_calls=tf.data.AUTOTUNE)

    # Get the next batch ready while the model trains on the current one
    return ds.prefetch(tf.data.AUTOTUNE)


def get_gate_datasets(batch_size=32, image_size=224, augmentation_enabled=False, augmentation=None):
    """Builds the train, val, test, and challenge datasets plus the class names."""
    df = pd.read_csv(SPLIT_CSV)

    # Use the classifier's augmenter so augmentation works exactly the same way
    augmenter = build_augmenter(augmentation) if (augmentation_enabled and augmentation) else None
    print(f"Data augmentation: {'ON' if augmenter is not None else 'OFF'}")

    # One dataset per split. Only train is shuffled and augmented
    datasets = {}
    for split in ["train", "val", "test", "challenge"]:
        rows = df[df["split"] == split]
        datasets[split] = make_split_dataset(rows, batch_size, image_size,
                                             training=(split == "train"), augmenter=augmenter)
        print(f"{split}: {len(rows)} images")

    return datasets["train"], datasets["val"], datasets["test"], datasets["challenge"], CLASS_NAMES


# Quick check when run directly: build the datasets, look at one batch,
# and open every image once to catch any broken files
if __name__ == "__main__":
    train_ds, val_ds, test_ds, challenge_ds, class_names = get_gate_datasets()

    # Check the shape and pixel range of one training batch
    for images, labels in train_ds.take(1):
        print(f"Batch image shape: {images.shape}")   # expect (32, 224, 224, 3)
        print(f"Pixel range: {float(tf.reduce_min(images)):.1f} to {float(tf.reduce_max(images)):.1f}")  # expect ~0 to ~255
        print(f"Birds in this batch: {int(tf.reduce_sum(labels))} of {len(labels)}")

    # Read every image in every split. A broken file will raise an error here
    for name, ds in [("train", train_ds), ("val", val_ds), ("test", test_ds), ("challenge", challenge_ds)]:
        count = sum(int(images.shape[0]) for images, _ in ds)
        print(f"{name}: read {count} images OK")