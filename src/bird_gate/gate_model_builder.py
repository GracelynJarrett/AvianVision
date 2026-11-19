# gate_model_builder.py
#
# Purpose: Build and compile the EfficientNetB0 bird gate. Same design as the
# classifier, but with ONE output: the chance that the image shows a bird.
# Freezing uses the same base / middle / end sections as hypertuning.py.

import tensorflow as tf

from src.species_classifier.hypertuning import OPTIMIZERS, apply_section_freezing


def build_gate_model(cfg, image_size=224):
    """Builds and compiles the bird / not-bird EfficientNetB0 model from the config."""

    # --- Load the pretrained EfficientNetB0 base (without its 1000-class top) ---
    base_model = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_shape=(image_size, image_size, 3),
    )

    # --- Freeze or unfreeze each section from the config ---
    apply_section_freezing(
        base_model,
        freeze_base=cfg["freeze_base"],
        freeze_middle=cfg["freeze_middle"],
        freeze_end=cfg["freeze_end"],
    )

    # --- Build the model: base -> pooling -> dropout -> one bird output ---
    inputs = tf.keras.Input(shape=(image_size, image_size, 3))
    # training=False keeps batch-norm in inference mode (same as the classifier)
    x = base_model(inputs, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(cfg["dropout"])(x)
    # Sigmoid gives one number from 0 to 1: how likely the image is a bird
    outputs = tf.keras.layers.Dense(1, activation="sigmoid")(x)
    model = tf.keras.Model(inputs, outputs)

    # --- Pick the optimizer named in the config (Adam if unknown) ---
    optimizer_class = OPTIMIZERS.get(cfg["optimizer"].lower(), tf.keras.optimizers.Adam)
    optimizer = optimizer_class(learning_rate=cfg["learning_rate"])

    # --- Compile: binary loss for 2 classes, plus metrics that suit a gate ---
    # Recall = how many real birds get let through (the most important one)
    model.compile(
        optimizer=optimizer,
        loss="binary_crossentropy",
        metrics=[
            "accuracy",
            tf.keras.metrics.AUC(name="auc"),
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall"),
        ],
    )
    return model


# Quick check when run directly: build the baseline model and print a summary
if __name__ == "__main__":
    from pathlib import Path
    from src.help_read_yaml import read_yaml

    project_root = Path(__file__).resolve().parents[2]
    cfg = read_yaml(project_root / "configs" / "gate_model_config.yaml")
    model = build_gate_model(cfg)
    model.summary()