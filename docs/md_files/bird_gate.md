# Bird Gate: Model and Dataset Decisions

**Author:** Gracelyn Jarrett
**Date:** 2026-11-14
**Status:** Planning (no training yet)

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

## 5. Dataset sources

Sizes are approximate. Verify each one before the final build.

| Role | Source | Where | Approx. size | Notes |
|------|--------|-------|--------------|-------|
| Birds (clean) | CUB-200-2011 | Hugging Face | ~11.8k | Close-up, single bird |
| Birds (messy, in motion) | Bird vs Drone, bird folders | Kaggle | part of ~21k | Video frames, near-duplicates likely |
| Birds (extra variety) | Aves del Tolima | Hugging Face | ~11k | 11 species, one region |
| Negatives (objects, airplanes) | Caltech-256 | Hugging Face | ~30k | Bird classes must be removed |
| Hard negatives (drones) | Bird vs Drone, drone folders | Kaggle | part of ~21k | Directly targets the airplane problem |
| Negatives (scenes, sky) | Places365 sample | Hugging Face (streamed) | 3-5k sample | Do not download the full set |

**Access rule:** public data only, no API key or account. Hugging Face
datasets load with the `datasets` library. Kaggle datasets use `kagglehub`
(to be confirmed on my machine with a small test download).

## 6. Split strategy: split by source, not by image

Three bird sources and three non-bird sources. Two of each are used for
train/val, and the third of each is held out for the test set.

| Split | Birds | Not birds |
|-------|-------|-----------|
| Train / val | CUB + Bird vs Drone (bird folders) | Caltech-256 (minus held-out classes) + Bird vs Drone (drone folders) |
| Test | Aves del Tolima | Places365 sample |
| Challenge set (test only) | n/a | Held-out Caltech-256 classes: airplane, jet, helicopter, etc. |
| Real-life set (test only) | Own bird photos | The 2 airplane images + own photos of planes, pets, random things |

- Bird vs Drone stays whole in train/val (birds and drones together), so the
  gate cannot learn "source style = label".
- The test set is touched once, at the end.
- Thresholds and settings are chosen on validation data only.

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

- [ ] Confirm `kagglehub` downloads without an API key.
- [ ] Confirm the Kaggle dataset names and licenses.
- [ ] Print the Caltech-256 labels and sort them into birds (remove),
      challenge classes (hold out), and everything else.
- [ ] Choose which Caltech-256 classes go in the challenge set.
- [ ] Decide the final size of each source after sampling.