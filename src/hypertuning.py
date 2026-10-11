# hypertuning.py
#
# Purpose: Runs hypertuning experiments for the AvianVision bird classifier.
# Unlike train.py (which fully freezes or unfreezes the top N layers), this script
# supports section-based freezing of EfficientNetB0 — independently controlling
# which of three sections (base, middle, end) are frozen or unfrozen per experiment.
# All 24 experiments are defined in configs/hypertuning_experiments.yaml.
#
# Usage:
#   python src/hypertuning.py --run base-frozen-HT

import argparse
from pathlib import Path

import tensorflow as tf

import mlflow
from sklearn.metrics import f1_score, precision_score, recall_score

from help_read_yaml import read_yaml
from preprocessing import get_datasets
from mlflow_setup import setup_mlflow


# --- Optimizer lookup (same as model_builder.py) ---
OPTIMIZERS = {
    "adam": tf.keras.optimizers.Adam,
    "sgd": tf.keras.optimizers.SGD,
    "rmsprop": tf.keras.optimizers.RMSprop,
}

# Layer name prefixes that identify each section of EfficientNetB0.
# base   = stem + blocks 1-2 (early layers — edges, colors, textures)
# middle = blocks 3-5 (mid layers — shapes and patterns)
# end    = blocks 6-7 + top (high-level, bird-specific features)
BASE_PREFIXES = ("stem_", "block1", "block2")
MIDDLE_PREFIXES = ("block3", "block4", "block5")
END_PREFIXES = ("block6", "block7", "top_")


def get_layer_section(layer_name):
    """Returns which section a layer belongs to based on its name: 'base', 'middle', 'end', or None."""
    # Check the layer name against each section's known prefixes.
    if layer_name.startswith(BASE_PREFIXES):
        return "base"
    if layer_name.startswith(MIDDLE_PREFIXES):
        return "middle"
    if layer_name.startswith(END_PREFIXES):
        return "end"
    # Some layers (e.g. the input layer) don't belong to a named section.
    return None


def apply_section_freezing(base_model, freeze_base, freeze_middle, freeze_end):
    """Freezes or unfreezes each EfficientNetB0 layer based on which section it belongs to."""
    # Start with the whole base model trainable, then freeze individual sections as needed.
    base_model.trainable = True
    for layer in base_model.layers:
        # Work out which section this layer is in.
        section = get_layer_section(layer.name)
        # Freeze the layer if its section is marked frozen in the experiment config.
        if section == "base" and freeze_base:
            layer.trainable = False
        elif section == "middle" and freeze_middle:
            layer.trainable = False
        elif section == "end" and freeze_end:
            layer.trainable = False


def build_model(ht_cfg, num_classes, image_size):
    """Builds and compiles EfficientNetB0 with section-based freezing from the experiment config."""

    # --- Load EfficientNetB0 pretrained on ImageNet, without its original top layer ---
    base_model = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_shape=(image_size, image_size, 3),
    )

    # --- Apply section-based freezing from the experiment config ---
    apply_section_freezing(
        base_model,
        freeze_base=ht_cfg["freeze_base"],
        freeze_middle=ht_cfg["freeze_middle"],
        freeze_end=ht_cfg["freeze_end"],
    )

    # --- Build the model: base -> pooling -> dropout -> species output ---
    # training=False keeps EfficientNetB0's batch-norm layers in inference mode,
    # which is recommended even when fine-tuning (preserves ImageNet statistics).
    inputs = tf.keras.Input(shape=(image_size, image_size, 3))
    x = base_model(inputs, training=False)
    # Flatten the base's feature maps into one vector per image.
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    # Randomly drop connections during training to reduce overfitting.
    x = tf.keras.layers.Dropout(ht_cfg["dropout"])(x)
    # Final layer: one output per bird species, softmax turns them into probabilities.
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    model = tf.keras.Model(inputs, outputs)

    # --- Pick the optimizer named in the config ---
    optimizer_class = OPTIMIZERS.get(ht_cfg["optimizer"].lower(), tf.keras.optimizers.Adam)
    optimizer = optimizer_class(learning_rate=ht_cfg["learning_rate"])

    # --- Compile the model so it is ready to train ---
    model.compile(
        optimizer=optimizer,
        loss="sparse_categorical_crossentropy",
        metrics=[
            "accuracy",
            tf.keras.metrics.SparseTopKCategoricalAccuracy(k=5, name="top5_accuracy"),
        ],
    )

    return model


def count_trainable_params(model):
    """Counts the total number of trainable parameters in the model."""
    # Sum the number of individual values in each trainable weight tensor.
    return int(sum(w.numpy().size for w in model.trainable_weights))


def hypertuning(run_name):
    """Runs one hypertuning experiment: loads config + data, builds the model, trains it, and logs to MLflow."""

    # --- Find and read the config files ---
    # The project root is one level up from this file (which lives in src/).
    project_root = Path(__file__).resolve().parent.parent
    ht_experiments = read_yaml(project_root / "configs" / "hypertuning_experiments.yaml")
    image_cfg = read_yaml(project_root / "configs" / "image_config.yaml")

    # --- Validate that the requested run exists ---
    if run_name not in ht_experiments:
        print(f"Error: '{run_name}' not found in hypertuning_experiments.yaml.")
        print(f"Available runs: {list(ht_experiments.keys())}")
        return
    ht_cfg = ht_experiments[run_name]

    # --- Build the data pipelines (train + validation only; test is held out) ---
    # Hypertuning runs never use augmentation — we isolate the freezing strategy variable.
    train_ds, val_ds, test_ds, class_names = get_datasets(
        batch_size=ht_cfg["batch_size"],
        image_size=image_cfg["image_size"],
        augmentation_enabled=False,
        augmentation={},
    )

    # test_ds is intentionally left unused — held out for the final chosen model only.
    num_classes = len(class_names)

    # --- Build the model with section-based freezing ---
    model = build_model(ht_cfg, num_classes=num_classes, image_size=image_cfg["image_size"])

    # Count trainable parameters so we can log how much of the network was actually training.
    trainable_params = count_trainable_params(model)

    # --- Point MLflow at our project's tracking database ---
    setup_mlflow()

    with mlflow.start_run(run_name=run_name):

        # Record every setting used for this run so it can be reproduced exactly.
        mlflow.log_params({
            "freeze_base": ht_cfg["freeze_base"],
            "freeze_middle": ht_cfg["freeze_middle"],
            "freeze_end": ht_cfg["freeze_end"],
            "learning_rate": ht_cfg["learning_rate"],
            "dropout": ht_cfg["dropout"],
            "epochs": ht_cfg["epochs"],
            "batch_size": ht_cfg["batch_size"],
            "optimizer": ht_cfg["optimizer"],
            "image_size": image_cfg["image_size"],
            "augmentation_enabled": False,
            "num_classes": num_classes,
            "trainable_params": trainable_params,
        })

        # Train on the training set, checking accuracy on the validation set each epoch.
        history = model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=ht_cfg["epochs"],
        )

        # --- Log per-epoch metrics so the learning curve is visible in MLflow ---
        for epoch in range(ht_cfg["epochs"]):
            mlflow.log_metrics(
                {
                    "train_loss": history.history["loss"][epoch],
                    "train_accuracy": history.history["accuracy"][epoch],
                    "train_top5_accuracy": history.history["top5_accuracy"][epoch],
                    "val_loss": history.history["val_loss"][epoch],
                    "val_accuracy": history.history["val_accuracy"][epoch],
                    "val_top5_accuracy": history.history["val_top5_accuracy"][epoch],
                },
                step=epoch,
            )

        # --- Log overall summary metrics after training ---
        # Final epoch values.
        final_val_accuracy = history.history["val_accuracy"][-1]
        final_val_top5_accuracy = history.history["val_top5_accuracy"][-1]

        # Find the epoch with the highest validation accuracy.
        best_epoch = max(
            range(len(history.history["val_accuracy"])),
            key=lambda i: history.history["val_accuracy"][i],
        )
        best_val_accuracy = history.history["val_accuracy"][best_epoch]
        best_val_top5_accuracy = history.history["val_top5_accuracy"][best_epoch]

        mlflow.log_metrics(
            {
                "final_val_accuracy": final_val_accuracy,
                "final_val_top5_accuracy": final_val_top5_accuracy,
                "best_val_accuracy": best_val_accuracy,
                "best_val_top5_accuracy": best_val_top5_accuracy,
                "best_epoch": best_epoch + 1,
            }
        )

        # --- Calculate validation macro F1, precision, and recall ---
        # Loop through the entire validation set to collect true labels and predictions.
        y_true = []
        y_pred = []
        for images, labels in val_ds:
            predictions = model.predict(images, verbose=0)
            y_true.extend(labels.numpy())
            y_pred.extend(predictions.argmax(axis=1))

        # Macro averaging treats every class equally regardless of how many images it has.
        val_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
        val_precision = precision_score(y_true, y_pred, average="macro", zero_division=0)
        val_recall = recall_score(y_true, y_pred, average="macro", zero_division=0)

        mlflow.log_metrics(
            {
                "val_macro_f1": val_f1,
                "val_macro_precision": val_precision,
                "val_macro_recall": val_recall,
            }
        )


# Run the experiment when this file is executed directly.
if __name__ == "__main__":
    # --run is required — there is no default experiment for hypertuning.
    parser = argparse.ArgumentParser(description="Run a hypertuning experiment for AvianVision.")
    parser.add_argument(
        "--run",
        type=str,
        required=True,
        help="Name of the experiment to run (from hypertuning_experiments.yaml).",
    )
    args = parser.parse_args()
    hypertuning(run_name=args.run)