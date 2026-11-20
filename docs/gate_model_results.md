# About this document
This document covers the results of the augmentation, hypertuning, and test set models for the bird gate. It has tables comparing all the experiments to each other, and a description of which model was chosen to move forward and why.

# Augmentation

## Setup
Model: EfficientNetB0 bird / not-bird gate (sigmoid head)
Baseline settings: all sections frozen, learning rate 0.001, dropout 0.2, 10 epochs, batch size 32
Validation set: 1,678 images (845 birds, 833 not-birds)
MLflow experiment: avianvision-bird-gate
Augmentation runs come from configs/gate_augmentation_experiments.yaml

## Validation results
Run	val_accuracy	val_auc	val_bird_recall	val_not_bird_recall	val_f1	val_loss
gate-baseline	0.987	0.997	0.981	0.993	0.987	0.052
color-focus-DA	0.986	0.996	0.983	0.988	0.986	0.060
conservative-DA	0.983	0.996	0.981	0.986	0.983	0.069
moderate-DA	0.979	0.995	0.978	0.981	0.979	0.076
aggressive-DA	0.979	0.994	0.979	0.978	0.979	0.086
spatial-focus-DA	0.977	0.994	0.981	0.974	0.978	0.084

## Training results
Run	train_accuracy	train_auc	train_loss	Duration
gate-baseline	0.992	0.999	0.036	3.8 min
color-focus-DA	0.986	0.999	0.048	5.8 min
conservative-DA	0.980	0.998	0.058	6.6 min
moderate-DA	0.978	0.997	0.066	6.7 min
aggressive-DA	0.971	0.996	0.080	5.8 min
spatial-focus-DA	0.974	0.997	0.074	5.6 min

## What the results show
The baseline had the best val_accuracy, val_auc, and val_not_bird_recall. Augmentation did not clearly beat it. This is likely because every section was frozen, so the model could not learn much from the extra variety.
color-focus-DA was very close to the baseline and had the best val_bird_recall (0.983 vs 0.981). That difference is only about 2 birds out of 845, so the two runs are basically tied.
The baseline is not overfitting much (train 0.992 vs val 0.987).
spatial-focus-DA and aggressive-DA were the weakest on not-birds.
Model chosen to move forward
color-focus-DA was chosen for hypertuning.

## Why:
It is tied with the baseline within a few images.
It has the best bird recall, which matters most because a missed bird never reaches the species classifier.
Hypertuning will likely unfreeze sections of the model, which raises the risk of overfitting. Augmentation should help more at that point.

---

# Hypertuning


# Final results