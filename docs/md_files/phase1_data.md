# Phase 1 — Dataset & Preprocessing

**Status:** Complete

---

## Overview

Phase 1 focuses on accessing and preparing the 525-species bird dataset for model 
training. This includes verifying the dataset is clean and usable, building the image 
preprocessing pipeline, and setting up MLflow to track all experiments going forward.

---

## Main Tasks

- [x] Access the Hugging Face bird dataset
- [x] Verify dataset integrity (corrupted images, class distribution)
- [x] Set up the image preprocessing pipeline
- [x] Set up MLflow for experiment tracking

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

Phase 1 was completed on 2026-09-27, one day ahead of schedule. All four main tasks are done.

**Bird name mapping**
- Built `data/bird_name_mapping.csv` mapping every dataset label to a scientific name using
  the eBird taxonomy.
- Final matches: 285 exact, 144 fuzzy, 88 manual, 9 ambiguous — 517 of 526 labels have a
  scientific name.
- 36 fuzzy matches were manually reviewed and corrected into MANUAL_MAP; the remaining 144
  fuzzy matches were validated with an 18/18 random sample check.
- The Hugging Face token was moved into a .env file (python-dotenv) so it is no longer hardcoded.

**Dataset integrity** (explored in `notebooks/exploring_bird_images.ipynb`)
- 89,885 images total, already split into train (84,635), validation (2,625), and test (2,625).
- The dataset defines 526 labels but contains 525 true species — the extra label is a
  whitespace-typo duplicate of the Parakeet Auklet, merged into one class during preprocessing.
- Class balance is mild (~2:1, 130–263 images per class), so class weighting/oversampling is
  not needed.
- 0 corrupted images; 100% RGB; 99.8% already 224x224 (211 outliers handled by resizing).

**Preprocessing pipeline** (`src/preprocessing.py`)
- Builds train/validation/test tf.data pipelines: resize to 224x224, merge the duplicate label,
  shuffle training data (fixed seed 42), batch by 32, and prefetch.
- Pixel values are left at 0-255 because EfficientNetB0 normalizes internally; data augmentation
  is off for the baseline, with a seam in place to add it in Phase 2.

**MLflow** (`src/mlflow_setup.py`)
- Configured with a local SQLite backend (mlflow.db) so the model registry will work in Phase 2.
- Experiment name: avianvision-bird-classification. A test run was logged and verified in the UI.

**Follow-up**
- A clean `display_name` column (corrected spellings for the frontend) is planned for
  bird_name_mapping.csv before Phase 5.

---

*Last updated: 2026-09-27*