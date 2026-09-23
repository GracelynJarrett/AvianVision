# Phase 2 — Model Training

**Status:** Not Started

---

## Overview

Phase 2 focuses on training the bird species classification model using transfer learning 
with EfficientNetB0. Multiple training experiments will be run with different 
hyperparameters, tracked in MLflow, and the best performing model will be selected, 
evaluated, and registered for use in later phases.

---

## Main Tasks

- [ ] Set up EfficientNetB0 with transfer learning
- [ ] Set up YAML config files for hyperparameters
- [ ] Begin training experiments
- [ ] Log all experiments in MLflow (accuracy, loss, hyperparameters)
- [ ] Continue running hyperparameter experiments
- [ ] Validate each model on the validation dataset
- [ ] Select the best-performing model (80%+ validation accuracy)
- [ ] Evaluate the best model on the test dataset
- [ ] Set the confidence threshold for the unknown category
- [ ] Register the best model in MLflow

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

[Filled in after the phase is complete.]

---

*Last updated: 2026-09-22*