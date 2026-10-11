# Phase 2 — Model Training

**Status:** Complete

---

## Overview

Phase 2 focuses on training the bird species classification model using transfer learning 
with EfficientNetB0. Multiple training experiments will be run with different 
hyperparameters, tracked in MLflow, and the best performing model will be selected, 
evaluated, and registered for use in later phases.

---

## Main Tasks

- [x] Set up EfficientNetB0 with transfer learning
- [x] Set up YAML config files for hyperparameters
- [x] Begin training experiments
- [x] Log all experiments in MLflow (accuracy, loss, hyperparameters)
- [x] Continue running hyperparameter experiments
- [x] Validate each model on the validation dataset
- [x] Select the best-performing model (80%+ validation accuracy)
- [x] Evaluate the best model on the test dataset
- [x] Set the confidence threshold for the unknown category
- [x] Register the best model in MLflow

---

## Dependencies

- Phase 1 must be complete — dataset verified and preprocessing pipeline ready

---

## Tools & Libraries

| Tool / Library | Purpose |
|---------------|---------|
| TensorFlow / Keras | Building and training the EfficientNetB0 model |
| EfficientNetB0 | Pre-trained base model for transfer learning |
| MLflow | Tracking all training experiments |
| YAML | Storing hyperparameter configurations |
| NumPy | Numerical operations during training |

---

## Key Decisions

**Decision:** Use EfficientNetB0 as the base model
**Reason:** EfficientNetB0 offers a strong balance between accuracy and computational 
efficiency. It is well suited for image classification tasks and is small enough to 
train within the resource constraints of a capstone project.

**Decision:** Set a 45% confidence threshold for the unknown category
**Reason:** If the model is less than 45% confident in its top prediction, the result 
is flagged as unknown rather than returning a potentially incorrect species. This 
reduces the risk of confidently wrong predictions being shown to users.

---

## Known Risks & Mitigations

**Risk:** Model fails to reach the 80% validation accuracy target
**Mitigation:** Run multiple hyperparameter experiments and use MLflow to compare 
results. If 80% cannot be reached, document the best achieved accuracy and discuss 
with the professor before moving on.

**Risk:** Overfitting to the training dataset
**Mitigation:** Monitor the gap between training and validation accuracy during each 
experiment. Apply dropout or data augmentation if overfitting is detected.

**Risk:** Training takes longer than expected given the number of species
**Mitigation:** Week 4 is a buffer week built into the schedule specifically for 
Phase 2 running over time.

**Risk:** The 45% confidence threshold may be too low or too high
**Mitigation:** Test the threshold against the validation dataset and adjust based 
on how many correct predictions get flagged as unknown versus how many incorrect 
predictions get through.

---

## Results & Notes

**Training Summary:**
- Baseline model: validation accuracy 97.37%, macro F1 0.973, validation loss 0.106
- Five data augmentation experiments were run (conservative-DA, moderate-DA, aggressive-DA, spatial-focus-DA, color-focus-DA). None outperformed the baseline, confirming that EfficientNetB0's pretrained ImageNet weights already generalize well to this dataset without augmentation.
- Twenty-four hypertuning experiments were run across six freezing strategy groups (base frozen, middle frozen, end frozen, base+middle frozen, base+end frozen, middle+end frozen), varying learning rate, dropout, batch size, and epochs within each group.

**Chosen Model:** base-middle-frozen-low-dropout-HT
- Freezing strategy: base and middle sections frozen, end section (Blocks 6–7) unfrozen
- Learning rate: 0.0001 | Dropout: 0.1 | Epochs: 15 | Batch size: 32 | Optimizer: Adam
- Validation macro F1: 0.978 | Validation loss: 0.090

**Final Test Set Results:**
- Test accuracy: 98.55% | Test top-5 accuracy: 99.96%
- Test macro F1: 0.9849 | Test macro precision: 0.9882 | Test macro recall: 0.9855
- Test loss: 0.0464

**Model Registration:** Registered in MLflow as `avianvision-bird-classifier` version 1
- Run ID: b1ab602131634539868de6602f557373
- Confidence threshold for the unknown category: 45% (stored in configs/api_config.yaml)

---

*Last updated: 2026-10-10*