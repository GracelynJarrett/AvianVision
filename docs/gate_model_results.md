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

## Setup
All 8 runs use the color-focus-DA augmentation.
2 freezing groups, each with 4 runs that change one setting at a time:
base + middle frozen (only end trains): 3,157,021 trainable parameters
base frozen (middle + end train): 3,989,739 trainable parameters
Standard settings: learning rate 0.0001, dropout 0.2, 10 epochs, batch size 32, adam
Settings: low-lr = learning rate 0.00005, low-dropout = dropout 0.1 with 15 epochs, large-batch = batch size 64
Config: configs/gate_hypertuning_experiments.yaml. Script: src/bird_gate/gate_hypertuning.py
Birds missed and not-birds let through are worked out from recall on 845 birds and 833 not-birds.

## Validation results
Run	val_accuracy	val_auc	val_bird_recall	val_not_bird_recall	val_f1	val_loss	Birds missed	Not-birds let through
gate-base-frozen-HT	0.9934	0.9968	0.9893	0.9976	0.9935	0.0343	9	2
gate-base-middle-frozen-low-dropout-HT	0.9928	0.9956	0.9858	1.0000	0.9928	0.0484	12	0
gate-base-frozen-large-batch-HT	0.9917	0.9968	0.9870	0.9964	0.9917	0.0346	11	3
gate-base-middle-frozen-large-batch-HT	0.9911	0.9965	0.9870	0.9952	0.9911	0.0423	11	4
gate-base-frozen-low-lr-HT	0.9899	0.9964	0.9846	0.9952	0.9899	0.0435	13	4
gate-base-middle-frozen-HT	0.9887	0.9972	0.9870	0.9904	0.9887	0.0424	11	8
gate-base-middle-frozen-low-lr-HT	0.9881	0.9964	0.9822	0.9940	0.9881	0.0437	15	5
gate-base-frozen-low-dropout-HT	0.9869	0.9967	0.9787	0.9952	0.9869	0.0521	18	4
gate-baseline (for comparison)	0.9869	0.9967	0.9811	0.9928	0.9869	0.0521	16	6
color-focus-DA (for comparison)	0.9857	0.9963	0.9834	0.9880	0.9858	0.0602	14	10

## Training results
Run	train_accuracy	best_epoch	Duration
gate-base-frozen-HT	0.9976	10 of 10	8.5 min
gate-base-middle-frozen-low-dropout-HT	0.9994	10 of 15	9.2 min
gate-base-frozen-large-batch-HT	0.9984	10 of 10	8.5 min
gate-base-middle-frozen-large-batch-HT	0.9974	8 of 10	7.1 min
gate-base-frozen-low-lr-HT	0.9974	8 of 10	8.5 min
gate-base-middle-frozen-HT	0.9976	5 of 10	10.9 min
gate-base-middle-frozen-low-lr-HT	0.9964	9 of 10	7.4 min
gate-base-frozen-low-dropout-HT	0.9980	10 of 15	10.3 min

## What the results show
Unfreezing layers helped. Most hypertuning runs beat the baseline on bird recall, and the best run misses 9 birds instead of 16.
gate-base-frozen-HT is the best or tied for best on almost every metric: highest val_accuracy, highest bird recall, lowest val_loss, and only 2 not-birds let through.
gate-base-middle-frozen-low-dropout-HT blocked every not-bird, but it missed 12 birds. Bird recall matters more, so it ranks below gate-base-frozen-HT.
The top 3 runs are within a few images of each other, so the differences between them are small.
Overfitting is small. gate-base-frozen-HT has train 0.9976 vs val 0.9934.
Lowering the learning rate or the dropout did not help in either group.
Model chosen to move forward
gate-base-frozen-HT was chosen as the final gate model.

## Why:

It missed the fewest birds (9 of 845), and bird recall matters most for the gate.
It had the highest val_accuracy (0.9934) and the lowest val_loss (0.0343), and only 2 not-birds were let through.
Its train vs val gap is small (0.9976 vs 0.9934), so it is not overfitting much.


# Final results