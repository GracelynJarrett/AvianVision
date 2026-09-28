# model_builder.py
#
# Purpose: Build and compile the EfficientNetB0 transfer-learning model for the
# 525-species bird classifier. This is the single place the model architecture is
# defined, so every experiment (baseline, augmentation, hyperparameter tuning)
# builds the model the same way, using settings from the model config.

import tensorflow as tf

# The optimizers we support by name in the config, mapped to their Keras classes.
OPTIMIZERS = {
    "adam": tf.keras.optimizers.Adam,
    "sgd": tf.keras.optimizers.SGD,
    "rmsprop": tf.keras.optimizers.RMSprop,
}


def build_model(model_config, num_classes, image_size=224):
    """Builds and compiles the EfficientNetB0 model from the config, class count, and image size."""

    # --- Load the pretrained EfficientNetB0 base (without its original top layer) ---
    # weights="imagenet" reuses features already learned from millions of images.
    # include_top=False drops its original 1000-class layer so we can add our own.
    base_model = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_shape=(image_size, image_size, 3),
    )

    # --- Decide how much of the base is allowed to learn ---
    if model_config["freeze_base"]:
        # Baseline: freeze the whole base so only our new head trains.
        base_model.trainable = False
    else:
        # Fine-tuning: let the base learn. If fine_tune_layers is set, keep all but
        # the top few layers frozen so we only adjust the highest-level features.
        base_model.trainable = True
        layers_to_tune = model_config.get("fine_tune_layers", 0)
        if layers_to_tune > 0:
            for layer in base_model.layers[:-layers_to_tune]:
                layer.trainable = False

    # --- Build the model: base -> pooling -> dropout -> final species layer ---
    # The input is a batch of 224x224 color images with pixel values 0-255
    # (EfficientNetB0 normalizes them internally, so we do not rescale here).
    inputs = tf.keras.Input(shape=(image_size, image_size, 3))
    # Run the images through the pretrained base. training=False keeps its internal
    # batch-norm layers in inference mode, which is the standard transfer-learning setup.
    x = base_model(inputs, training=False)
    # Turn the base's feature maps into a single vector per image.
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    # Randomly drop some connections during training to reduce overfitting.
    x = tf.keras.layers.Dropout(model_config["dropout"])(x)
    # The final layer: one output per bird species, softmax gives class probabilities.
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    model = tf.keras.Model(inputs, outputs)

    # --- Pick the optimizer named in the config (default to Adam if unknown) ---
    optimizer_class = OPTIMIZERS.get(model_config["optimizer"].lower(), tf.keras.optimizers.Adam)
    optimizer = optimizer_class(learning_rate=model_config["learning_rate"])

    # --- Compile the model so it is ready to train ---
    # sparse_categorical_crossentropy is used because our labels are integer class
    # numbers (0-524), not one-hot vectors. We track both top-1 and top-5 accuracy.
    model.compile(
        optimizer=optimizer,
        loss="sparse_categorical_crossentropy",
        metrics=[
            "accuracy",
            tf.keras.metrics.SparseTopKCategoricalAccuracy(k=5, name="top5_accuracy"),
        ],
    )

    return model


# Quick check when run directly: build the model from the real config files and
# print a summary, to confirm it assembles correctly.
if __name__ == "__main__":
    from pathlib import Path
    from help_read_yaml import read_yaml

    # Work out the project root so we can find the config files from anywhere.
    project_root = Path(__file__).resolve().parent.parent
    model_cfg = read_yaml(project_root / "configs" / "model_config.yaml")
    image_cfg = read_yaml(project_root / "configs" / "image_config.yaml")

    # Build the model for all 525 bird species at the configured image size.
    model = build_model(model_cfg, num_classes=525, image_size=image_cfg["image_size"])

    # Print the model's structure and a count of trainable vs frozen parameters.
    model.summary()
