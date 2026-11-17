# Bird Gate: Model and Dataset Decisions

**Author:** Gracelyn Jarrett
**Date:** 2026-11-14
**Status:**  Data sources checked. Dataset build is next (no training yet).

---

## 1. Problem

The species classifier only knows 525 bird classes. Its softmax output always
adds up to 100%, so it must pick the "most bird-like" species even when the image
is not a bird. During testing, two airplane images were given to the model, and
one was labeled a bird with 95% confidence.

A confidence threshold cannot fix this, because the model was confident. The
classifier needs a separate check that answers one question first: **is this a bird?**

## 2. Decision: add a bird gate

**Current workflow**

    User input -> Species classifier -> Enrichment data

**New workflow**

    User input -> Bird gate -> (if bird) Species classifier -> Enrichment data

If the gate says "not a bird," the app shows a message such as
"This doesn't look like a bird. Try another photo!" and stops. The species
classifier and enrichment steps are skipped.

## 3. Decision: model

- **Model:** EfficientNetB0 (Keras, transfer learning), fine-tuned for two
  classes: bird / not bird.
- **Why:**
  - Same framework and base model as the species classifier, so the code and
    preprocessing can be shared.
  - Small and fast, which suits a gate that runs on every upload.
  - Fine-tuning a model gives me something I trained, can measure, and can
    explain in the capstone report.
- **Optional baselines (only if time allows):** an ImageNet bird-class baseline,
  and CLIP zero-shot in a separate notebook.

## 4. Decision: do not use the 525-species dataset

The gate only needs "bird or not," so it does not need the 525-species data.
Using a different source avoids two problems:

- **Leakage:** the species model already trained on those images, so test
  results could look better than they really are.
- **Domain gap:** the 525 images are clean, well-framed photos. Real users
  upload blurry, distant, and cluttered ones.

## 4a. Decision: what counts as a bird

The gate treats **any clear picture of a bird as a bird, including drawings,
paintings, and other artwork.** The Bird vs Drone bird folder contains some
drawings and paintings, and we decided to keep them labeled "bird".

Consequence: a drawing can pass the gate and reach the species classifier,
which was trained on photos, so its species guess for art may be less reliable.
The gate does not try to reject art.


## 5. Dataset sources

Each source was checked by hand. Details are in `docs/bird_gate_dataset_quality.md`.

| Role | Source | Where | Size used | Notes |
|------|--------|-------|-----------|-------|
| Birds (clean) | CUB-200-2011 | Hugging Face | up to 6,000 of 11,788 | Few overlays (about 13% had text) |
| Birds (messy) | Bird vs Drone, `Birds` folder | Kaggle | 400 | Kaggle copy is a small subset of the Mendeley original. Includes drawings. |
| Hard negatives (drones) | Bird vs Drone, `Drones` folder | Kaggle | 428 | |
| Negatives (objects, airplanes) | Caltech-256 | Hugging Face | up to 6,000 | 9 bird classes plus birdbath removed |
| Birds (test) | Aves del Tolima | Hugging Face | about 2,970 sampled | 11 species, 11,000 images after dropping 4 duplicate folders |
| Negatives (test) | Places365 | Hugging Face | about 2,600 sampled | 365 scenes, 1.8M images, sampled through the viewer API |

**Access rule:** public data only, no API key or account. Hugging Face
datasets load with the `datasets` library. Kaggle works with `kagglehub`
and no key (confirmed on my machine).

## 6. Split strategy: split by source, not by image

Three bird sources and three non-bird sources. Two of each are used for
train/val, and the third of each is held out for the test set.

| Split | Birds | Not birds |
|-------|-------|-----------|
| Train / val | CUB + Bird vs Drone birds | Caltech-256 (minus bird and challenge classes) + Bird vs Drone drones + part of airplanes-101 |
| Test | Aves del Tolima (11 species) | Places365 sample |
| Challenge set (test only) | n/a | Held-out Caltech-256 classes (fighter-jet, helicopter, hot-air-balloon, blimp, bat, butterfly, house-fly) + part of airplanes-101 |
| Real-life set (test only) | Own bird photos | The 2 airplane images + own photos of planes, pets, random things |

- `airplanes-101` is split between train/val and the challenge set, so the gate
  sees airplanes in training and is still tested on unseen ones.
  The exact split is decided when the dataset is built.

**Why by source:** it measures how the gate handles data it has never seen,
not just new images from the same collection.

**Known limits:**
- Aves del Tolima has only 11 species from one region, so the test birds are narrow.
- The Places365 test negatives are mostly easy, which is why the challenge set exists.
- The challenge set splits one source by class, not by source.

## 7. Data cleaning rules

1. **Remove every bird class from Caltech-256** (for example cormorant and
   ibis). Check by reading the label names, not by guessing.
2. **Screen the negatives for hidden birds.** Run an existing bird model over
   the Places365 sample and Caltech-256, then review the highest-scoring
   images by hand.
3. **Bird vs Drone near-duplicates.** Frames from the same video must stay
   together in one split, or the test score will look too good.
4. **Check for overlap** between the new bird data and the 525-species set
   by comparing file hashes.
5. **Balance classes.** Aim for roughly 1:1 birds to not-birds, with no single
   negative source dominating.
6. **Make birds messier with augmentation:** random zoom-out, crops that cut off
   part of the bird, blur, and low-resolution resizing.
7. **Text shortcut.** In the Bird vs Drone copy, about 19 of 30 birds had text
   or watermarks, versus about 5 of 30 drones (hand count). The gate could learn
   "text means bird". Fix: random text overlays on a share of training images of
   both classes (`text_overlay` in the config), then a small manual check with
   about 20 text-heavy drones and 20 text-free birds.
8. **Aves del Tolima duplicates.** 4 of its 15 folders repeat other folders.
   Use only the 11 Latin-name folders, with about 270 images per species.
9. **Places365 scenes.** Included by default. 11 scenes where birds are likely
   the subject are excluded. Stray birds in other scenes are removed by
   screening with the species model.

## 8. Evaluation plan (proposed)

- Report **precision and recall** for the bird class, plus a confusion matrix.
- Two errors matter, and they hurt in different ways:
  - **False accept:** a non-bird passes (the original airplane problem).
  - **False reject:** a real bird is blocked, so the user cannot identify it.
- Choose the gate's decision threshold on the validation set, not the test set.
- Report results separately on the test set, the challenge set, and the
  real-life set.
- Log runs in MLflow, and save the best weights during training so the test
  evaluation does not need a re-train.

## 9. Licenses and citations

- CUB-200-2011: cite Wah et al. (2011). License differs by mirror, so check.
- Caltech-256: cite Griffin, Holub, and Perona. The Hugging Face copy lists no license.
- Aves del Tolima: mixed-source, includes CC BY-NC images (research use).
- Bird vs Drone: check the Kaggle page. Images come from Pexels.
- Places365: check the license on the specific copy used.


## 10. Open items

- [x] Confirm `kagglehub` downloads without an API key.
- [x] Confirm the Kaggle dataset name (`harshwalia/birds-vs-drone-dataset`).
- [x] Print the Caltech-256 labels and sort the classes.
- [x] Choose the challenge classes.
- [ ] Check licenses for all six sources (see the quality doc).
- [ ] Decide how `airplanes-101` is split (placeholder: 30% to the challenge set).
- [ ] Build the dataset: sample, screen for hidden birds, check duplicates and
      overlap with the 525 set.
- [ ] Decide the final size of each source after sampling.