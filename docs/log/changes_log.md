# AvianVision Change Log

## About This Document

This document tracks all meaningful changes and decisions made to the AvianVision project throughout its lifecycle. 
A "change" is any modification to the project plan, file structure, documentation, model architecture, or scope that differs from what was originally planned.

**How to use this document:**
- Log a change any time something meaningful is modified, added, or removed from the project
- Be specific — note what file or area was changed, not just that something changed
- Entries should be added in chronological order, newest at the bottom
- If a change was made because of a blocker or challenge, reference the date in the Project 
  Log where that challenge was documented

---

## Change Log Template

---

**Date:** [Date of change]

**What Was Changed and Why:** [Explain what was changed, where it was changed, why the change 
was necessary, and how it will affect the future of the project. 3 sentences minimum.]

---

**Date:** 2026-09-24 to 2026-09-25

**What Was Changed and Why:** While building the bird name mapping and exploring the dataset 
in Phase 1, the Hugging Face dataset was found to define 526 class labels even though it 
contains only 525 true species. The extra label is a whitespace typo that split the Parakeet 
Auklet across two classes — 'PARAKETT  AUKLET' (two spaces) and 'PARAKETT AUKLET' (one 
space) — which together form one normal class (155 train / 5 validation / 5 test). The plan 
is to merge these two labels into one during preprocessing so the model trains on a clean 
525-class setup, and the two matching rows in data/bird_name_mapping.csv (both Aethia 
psittacula) will be combined at that time. As part of the same Phase 1 work, a mapping file 
(data/bird_name_mapping.csv) and its generating script (src/build_bird_mapping.py) were 
created to match each dataset label to a scientific name (285 exact, 144 fuzzy, 88 manual, 
and 9 ambiguous matches), with 36 fuzzy matches manually corrected into MANUAL_MAP and the 
remaining 144 validated by an 18/18 random sample check; this mapping is a dependency for the 
Phase 3 enrichment pipeline. A dataset-integrity check (notebooks/exploring_bird_images.ipynb) 
also confirmed 0 corrupted images, 100% RGB color mode, mild class balance (~2:1, 130–263 
images per class), and that nearly all images are already 224x224 with only 211 differently 
sized images needing a resize step. Finally, the Hugging Face token was moved out of the code 
and into a .env file (loaded with python-dotenv) so it is no longer hardcoded.

---

**Date:** 2026-10-05

**What Was Changed and Why:** After completing the baseline model and five data augmentation experiments (conservative-DA, moderate-DA, aggressive-DA, spatial-focus-DA, color-focus-DA), the baseline model was selected as the foundation for hyperparameter tuning. The baseline outperformed all augmentation runs with a validation accuracy of 97.3%, macro F1 of 0.973, and validation loss of 0.106, indicating that EfficientNetB0's pretrained ImageNet weights already generalize well to this dataset without additional augmentation. Because augmentation introduced noise that hurt rather than helped, hyperparameter tuning will proceed with augmentation disabled, focusing instead on unfreezing base layers, learning rate, dropout, batch size, optimizer, and epoch count.

---

**Date:** 10-9-2026

**What Was Changed and Why:** After training all of the hypertuning experiments and comparing them to the base model, I have decided to use the base-middle-frozen-low-dropout-HT model. This chosen model has a macro F1 of 0.978 and a val loss of 0.090, meaning there was improvement to the model with hypertuning. 

---

**Date:** 10-12-2026
**What Was Changed and Why:** My original plan was to run the enrichment pipeline in Snowflake every time someone made a prediction. However, Claude pointed out that doing it this way will put stress on the API requests and would take a long time to query the results, and that if one of the servers crashed then the pipeline would break. Instead, Snowflake will be creating the tables and combining the dataset into one table that is stored inside MongoDB Atlas.

---
**Date:** 10-20-2026
**What was changed and why:** Reduced GBIF occurrence retrieval limit from 2,500 to 1,000 records per species. This change significantly reduces API requests, lowers the likelihood of GBIF rate-limiting (HTTP 429), decreases Snowflake storage requirements, and still provides sufficient observations for geographic visualizations and migration analysis.

---

**Date:** 10-20-2026
**What Was Changed and Why:** Removing Snowflake from the architectural design. Snowflake right now is only combining the different datasets, but Python can do that. And through experimentation I have already used up my $20 limit. By removing Snowflake I will be saving money, and by storing the data straight into MongoDB Atlas I will be saving time. However, when presenting this project I need to mention that I was using Snowflake but found that it was unnecessary for this project. 

---

**Date:** 10-29-2026
**What Was Changed and Why:** I added a spread threshold that looks at the top_5_predictions. If the confidence is spread out more than 20%, then the prediction is automatically considered unknown. However, some images still slip through the cracks. The data/test_images/airplane.webp had a confidence score of 95% for the Red Billed Tropicbird, slipping through this new protection. To fully catch future images like this I would need to either A) add an additional category for non-bird images, or B) add a second model that answers the question "is this a bird?" As of right now I am keeping the model as it is and spending time on getting my dashboard done. With more time I will strengthen my current model.