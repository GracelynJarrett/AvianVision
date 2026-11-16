# Bird Gate: Dataset Quality Log

**Last updated:** November 16, 2026

One section per dataset. Same checks for each.

---

## Bird vs Drone (Kaggle: harshwalia/birds-vs-drone-dataset)

| Check | Result |
|-------|--------|
| Role | Train/val: birds (bird) and drones (not bird) |
| Access | Public, no API key (kagglehub) |
| Size | 400 birds, 428 drones (smaller copy of the Mendeley original, ~20.9k images) |
| License | TODO: check Kaggle page |
| Citation | Shandilya et al. (2023), Data in Brief, DOI 10.1016/j.dib.2023.109355 |
| Labels | By folder: Birds / Drones |

**Findings (hand check, 30 images per folder):**
- Bird images look unique, not near-copies.
- Some bird images are drawings or paintings. Decision: keep as "bird".
- Text or watermarks: about 19/30 birds, about 5/30 drones.
- Some drone images contain people (fine).
- Some drone images look alike but at different distances.

**Problems and fixes:**
- Text could become a shortcut for "bird". Fix: random text overlay on both classes in training (`text_overlay` in the config), then a small manual check.

---

## Caltech-256 (Hugging Face: ilee0022/Caltech-256)

| Check | Result |
|-------|--------|
| Role | Train/val: not bird (plus a held-out challenge set) |
| Access | Public, no key (Hugging Face `datasets`) |
| Size | About 30k images in 257 classes (256 objects + clutter) |
| License | Not listed on the Hugging Face card (TODO: check the original source) |
| Citation | Griffin, Holub, and Perona (2007), Caltech-256 |
| Labels | Integer `label` plus a `text` column holding the class name |

**Findings:**
- The label list has 257 classes, and 9 are birds: cormorant, duck, goose,
  hummingbird, ibis-101, ostrich, owl, penguin, swan. These must be removed from
  the negatives. Most names do not contain the word "bird".
- `birdbath` is not a bird, but its photos can show birds. One of 8 sampled
  images showed a ceramic bird. Removed to be safe.
- `bat` (8 images checked) is the animal. Used in the challenge set.
- `clutter` (8 images checked) showed no birds. Kept for now.

**Problems and fixes:**
- Bird classes hiding in the negatives. Fix: remove the 9 bird classes and
  birdbath (`caltech256_remove_classes` in the config).
- Hidden birds in other classes. Fix: screen with the species model and review
  the highest-scoring images by hand.
- Airplanes are the original failure. Decision: split `airplanes-101` between
  train/val and the challenge set (details later).

**Challenge classes (held out):** fighter-jet, helicopter-101, hot-air-balloon,
blimp, bat, butterfly, house-fly.

---




