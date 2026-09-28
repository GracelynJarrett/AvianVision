# preprocessing.py
#
# Purpose: Turn the raw Hugging Face bird dataset into batches of images that are
# ready to feed into EfficientNetB0 for training. This handles resizing, merging
# the duplicate Parakeet Auklet label, optional data augmentation, and building
# efficient train/validation/test pipelines. It intentionally does NOT normalize
# pixel values (EfficientNetB0 does that internally). The image size, batch size,
# and augmentation settings are passed in from the config files by the runner.

import os
import re

import numpy as np
import tensorflow as tf
from dotenv import load_dotenv
from datasets import load_dataset


# ---- Default settings (the runner overrides these with values from the configs) ----
# The Hugging Face dataset we are loading.
DATASET_NAME = "yashikota/birds-525-species-image-classification"

# Default image size EfficientNetB0 expects, used if the runner does not pass one.
IMAGE_SIZE = 224

# Default number of images per training step.
BATCH_SIZE = 32

# A fixed random seed so shuffling/augmentation are repeatable and experiments compare fairly.
SEED = 42

# How many images to hold in memory for shuffling the training data. A bigger
# number mixes the data more thoroughly but uses more memory; lower it if needed.
SHUFFLE_BUFFER = 1000


def load_raw_dataset():
    """Loads the raw bird dataset (all splits) from Hugging Face."""
    # Load the Hugging Face token from the .env file so downloads get higher limits.
    load_dotenv()
    # Pull down the dataset with its train, validation, and test splits.
    return load_dataset(DATASET_NAME)


def build_label_remap(class_names):
    """Builds a mapping from the original label numbers to clean, merged 0-524 numbers.

    Two labels that are identical once extra spaces are removed are treated as the
    same species and merged into one class. This fixes the Parakeet Auklet, which the
    dataset accidentally split into two labels ('PARAKETT  AUKLET' and 'PARAKETT
    AUKLET') using a double-space typo.
    """
    # Remember which new class number we have given to each cleaned-up name.
    new_id_for_name = {}
    # Map each original label number to its new, merged class number.
    old_to_new = {}
    # The final list of class names, in new-id order (this becomes 525 names).
    merged_names = []

    # Walk through every original label in order.
    for old_id, name in enumerate(class_names):
        # Collapse any repeated spaces so duplicate labels line up as one name.
        canonical = re.sub(r"\s+", " ", name).strip()
        # The first time we see a cleaned-up name, give it the next new class number.
        if canonical not in new_id_for_name:
            new_id_for_name[canonical] = len(merged_names)
            merged_names.append(canonical)
        # Point this original label at its new (possibly shared) class number.
        old_to_new[old_id] = new_id_for_name[canonical]

    return old_to_new, merged_names


def build_augmenter(augmentation):
    """Builds a stack of random image-augmentation layers from the settings, or None if all are off."""
    # Collect only the augmentation layers that are switched on in the image config.
    layers = []
    # Randomly mirror images left-to-right.
    if augmentation.get("horizontal_flip"):
        layers.append(tf.keras.layers.RandomFlip("horizontal", seed=SEED))
    # Randomly flip images upside down.
    if augmentation.get("vertical_flip"):
        layers.append(tf.keras.layers.RandomFlip("vertical", seed=SEED))
    # Randomly rotate images (value is a fraction of a full turn).
    if augmentation.get("rotation", 0):
        layers.append(tf.keras.layers.RandomRotation(augmentation["rotation"], seed=SEED))
    # Randomly zoom in or out.
    if augmentation.get("zoom", 0):
        layers.append(tf.keras.layers.RandomZoom(augmentation["zoom"], seed=SEED))
    # Randomly change brightness (our images are on a 0-255 scale).
    if augmentation.get("brightness", 0):
        layers.append(tf.keras.layers.RandomBrightness(
            augmentation["brightness"], value_range=(0, 255), seed=SEED))
    # Randomly change contrast.
    if augmentation.get("contrast", 0):
        layers.append(tf.keras.layers.RandomContrast(augmentation["contrast"], seed=SEED))

    # If nothing was turned on, there is no augmenter to apply.
    if not layers:
        return None
    # Bundle the chosen layers into one pipeline that can be applied to a batch of images.
    return tf.keras.Sequential(layers, name="augmentation")


def make_tf_dataset(hf_split, old_to_new, batch_size, image_size, training=False, augmenter=None):
    """Converts one dataset split into a batched, ready-to-train TensorFlow dataset."""

    # For training, shuffle the whole dataset ORDER first so every batch gets a good
    # mix of classes (the raw data is grouped by species). This shuffles an index
    # list only — it doesn't load images — so it's cheap and memory-safe.
    if training:
        hf_split = hf_split.shuffle(seed=SEED)

    # A small generator that hands over one (image, label) pair at a time.
    def generator():
        # Go through every example in this split of the Hugging Face dataset.
        for example in hf_split:
            # Get the picture as pixels, forcing it to standard RGB color to be safe.
            image = np.array(example["image"].convert("RGB"))
            # Translate the original label number into our merged class number.
            label = old_to_new[example["label"]]
            yield image, label

    # Describe what the generator produces: images of varying size, and one label.
    output_signature = (
        tf.TensorSpec(shape=(None, None, 3), dtype=tf.uint8),
        tf.TensorSpec(shape=(), dtype=tf.int32),
    )
    # Build the TensorFlow dataset from our generator.
    ds = tf.data.Dataset.from_generator(generator, output_signature=output_signature)

    # Resize every image to the model's expected size. We do NOT rescale the pixel
    # values here because EfficientNetB0 normalizes them itself.
    def resize(image, label):
        image = tf.image.resize(image, [image_size, image_size])
        return image, label
    ds = ds.map(resize, num_parallel_calls=tf.data.AUTOTUNE)

    # Only shuffle the training data, using the fixed seed so runs stay comparable.
    if training:
        ds = ds.shuffle(buffer_size=SHUFFLE_BUFFER, seed=SEED,
                        reshuffle_each_iteration=True)

    # Group images into batches.
    ds = ds.batch(batch_size)

    # Apply data augmentation to TRAINING batches only, and only if one was built.
    # Validation and test data are never augmented — they must stay as the real images.
    if training and augmenter is not None:
        ds = ds.map(lambda image, label: (augmenter(image, training=True), label),
                    num_parallel_calls=tf.data.AUTOTUNE)

    # Prefetch so the CPU prepares the next batch while the model trains on the current one.
    ds = ds.prefetch(tf.data.AUTOTUNE)
    return ds


def get_datasets(batch_size=BATCH_SIZE, image_size=IMAGE_SIZE,
                 augmentation_enabled=False, augmentation=None):
    """Builds the train, validation, and test datasets plus the list of class names."""
    # Load the raw dataset from Hugging Face.
    dataset = load_raw_dataset()

    # Get the original list of label names and build the merged 0-524 mapping.
    class_names = dataset["train"].features["label"].names
    old_to_new, merged_names = build_label_remap(class_names)
    print(f"Original labels: {len(class_names)}  ->  merged classes: {len(merged_names)}")

    # Build the augmentation pipeline only if it is switched on in the image config.
    augmenter = build_augmenter(augmentation) if (augmentation_enabled and augmentation) else None
    print(f"Data augmentation: {'ON' if augmenter is not None else 'OFF'}")

    # Build a TensorFlow pipeline for each split. Only training is shuffled/augmented.
    train_ds = make_tf_dataset(dataset["train"], old_to_new, batch_size, image_size,
                               training=True, augmenter=augmenter)
    val_ds = make_tf_dataset(dataset["validation"], old_to_new, batch_size, image_size,
                             training=False)
    test_ds = make_tf_dataset(dataset["test"], old_to_new, batch_size, image_size,
                              training=False)

    # Return the three datasets and the class names (new id -> name).
    return train_ds, val_ds, test_ds, merged_names


# Run a quick sanity check when this file is executed directly (uses the defaults:
# batch 32, size 224, no augmentation).
if __name__ == "__main__":
    # Build all three datasets and the class-name list.
    train_ds, val_ds, test_ds, class_names = get_datasets()
    print(f"Number of classes: {len(class_names)}")

    # Pull one training batch and confirm its shapes and value ranges look right.
    for images, labels in train_ds.take(1):
        print(f"Batch image shape: {images.shape}")          # expect (32, 224, 224, 3)
        print(f"Batch label shape: {labels.shape}")           # expect (32,)
        print(f"Pixel value range: {float(tf.reduce_min(images)):.1f} "
              f"to {float(tf.reduce_max(images)):.1f}")        # expect ~0 to ~255
        print(f"Label range in batch: {int(tf.reduce_min(labels))} "
              f"to {int(tf.reduce_max(labels))}")              # within 0..524
        break
