# Phase 1 — Dataset & Preprocessing

**Status:** In Progress

---

## Overview

Phase 1 focuses on accessing and preparing the 525-species bird dataset for model 
training. This includes verifying the dataset is clean and usable, building the image 
preprocessing pipeline, and setting up MLflow to track all experiments going forward.

---

## Main Tasks

- [x] Access the Hugging Face bird dataset
- [ ] Verify dataset integrity (corrupted images, class distribution)
- [ ] Set up the image preprocessing pipeline
- [ ] Set up MLflow for experiment tracking

---

## Dependencies

None — this is the first phase of the project.

---

## Tools & Libraries

| Tool / Library | Purpose |
|---------------|---------|
| Hugging Face Datasets | Accessing the 525-species bird dataset |
| pygbif | Matching common bird names to scientific names |
| eBird Taxonomy CSV | Common name to scientific name lookup |
| pandas | Data manipulation and mapping |
| MLflow | Experiment tracking |
| Python (venv) | Dependency management |

---

## Key Decisions

**Decision:** Use the eBird taxonomy CSV instead of pygbif for common name to scientific 
name matching
**Reason:** pygbif is designed for scientific names, not common names. Both name_suggest() 
and name_backbone() returned zero reliable matches for the dataset's ALL CAPS common name 
labels. The eBird taxonomy CSV provided a direct common name lookup that achieved a 98.3% 
match rate across 525 species.

---

## Known Risks & Mitigations

**Risk:** Corrupted or mislabeled images in the dataset could affect model training
**Mitigation:** Verify dataset integrity before training begins by checking class 
distribution and scanning for corrupted files

**Risk:** Some fuzzy-matched scientific names from the entity resolution script may be 
incorrect
**Mitigation:** Manually review all fuzzy-matched entries in the bird name mapping CSV 
before using them in the enrichment pipeline

**Risk:** Class imbalance across 525 species could bias the model toward more 
common species
**Mitigation:** Check class distribution during dataset verification and apply 
class weighting or oversampling if needed

---

## Results & Notes

[Filled in after the phase is complete.]

---

*Last updated: 2026-09-22*