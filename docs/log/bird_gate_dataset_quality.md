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

## CUB-200-2011 (Hugging Face: bentrevett/caltech-ucsd-birds-200-2011)

| Check | Result |
|-------|--------|
| Role | Train/val: bird |
| Access | Public, no key (Hugging Face `datasets`) |
| Size | 11,788 images (5,994 train + 5,794 test). Both halves are pooled and re-split. |
| License | TODO: check the dataset page (the Hugging Face copy does not clearly state one) |
| Citation | Wah et al. (2011), Caltech-UCSD Birds-200-2011 |
| Labels | 200 species in `label`, plus `bbox`. Both ignored. Every image is relabeled "bird". |

**Findings (hand check, every 200th image, 30 images):**
- Text on 4 of 30 images (about 13%): a copyright line or the date taken.
  Much lower than the Bird vs Drone birds (about 63%).
- Real photos vs drawings: TODO (fill in)
- Bird size / blur: TODO (fill in)
- The 200 species are North American, and many are probably also among the
  525 species. The photos should differ; overlap is checked by file hash later.

**Problems and fixes:**
- Mostly clean, close-up photos, so the gate might reject small or blurry
  birds. Fix: augmentation (zoom, crop, blur, low resolution) and the messier
  Bird vs Drone birds.
- Original train/test split is not used, since CUB is a train/val source.

---

## Aves del Tolima (Hugging Face: AndresFelipeYule/AvesdelTolima)

| Check | Result |
|-------|--------|
| Role | Test: bird (held out, never used for training or tuning) |
| Access | Public, no key (files fetched with `huggingface_hub`) |
| Size | 14,072 image files, 6.79 GB. Too big to download whole; sample instead. |
| License | None declared on the repo. Sources are mixed and include CC BY-NC images. Treated as research use only. |
| Citation | TODO: credit the dataset author and the original photo sources |
| Labels | Species folders only (no train/test folders). Every image is relabeled "bird". |

**Findings:**
- 15 folders, but only 11 species. Four folders with an underscore name
  (BATARA_CARCAJADA, HORMIGUERO_GUARDABOSQUE, TIRANUELO_CEJIAMARILLO,
  TOROROI_COMPADRE) repeat the Latin-name folders. Drop them. The pool is
  11 species x 1,000 images = 11,000.
- File names come in two styles: a 9-digit number or a short hex code. Some
  species are almost all hex (Martin Pescador Grande: 991 of 1,000), so the
  images probably come from more than one source.
- Hand check (about 45 previewed images, plus 12 neighboring images from one
  folder): 1 image with text, 1 collage of many photos, no sign of edited copies.
- Species labels are inconsistent in places (the same file number appears under
  two different species names). Not an issue for the gate, which ignores species.
- All birds are Colombian species, so unlike CUB and the 525 set.

**Problems and fixes:**
- Narrow test: 11 species from one region. It checks unfamiliar birds, but
  cannot represent all bird types. Report this limit.
- Collage image(s): rare, kept for now. Revisit if more turn up.
- Possible near-duplicates: not seen by eye. Check with file hashes when
  building the dataset.
- Sampling: take about the same number per species (about 270 each, roughly
  3,000 total), from the 11 Latin-name folders only.

---

## Places365 (Hugging Face: ljnlonoljpiljm/places365-256px)

| Check | Result |
|-------|--------|
| Role | Test: not bird (scenes, sky, and airport scenes), held out |
| Access | Public, no key. Streamed through the dataset viewer `/rows` endpoint; the `/filter` endpoint failed with 500 errors. |
| Size | 1,803,460 images, about 19 GB, 365 scenes. Never downloaded whole; sampled. |
| Sample | TODO: fill in the DONE count (about 8 images per scene, 20 for the sky, mountain, and aircraft scenes) |
| License | TODO: check the Places365 / dataset page |
| Citation | Zhou et al. (2017), Places: A 10 Million Image Database for Scene Recognition, IEEE TPAMI |
| Labels | 365 scene names in `label`; every sampled image is relabeled "not bird" |

**Findings:**
- The files are sorted by scene, so the first rows of the dataset are all one
  scene. Streaming from the top would give one scene, so a mix needs
  sampling across the dataset.
- Reading the label column from the parquet files directly took about 2 hours
  and was stopped. Not a usable method.
- A scan of 1 row every 3,000 rows found 281 of 365 scenes (about 25% of
  requests failed). The 8 scenes we most needed (sky, skyscraper, snowfield,
  volcano, runway, hangar/outdoor, oilrig, lighthouse) were found by binary search.
- 76 scenes were not located and are skipped. This is fine for a varied test set.
- Hand check of about 5 scenes (including sky, farm, park, and airfield): no
  problems seen.

**Scene rules:**
- Included by default.
- 11 scenes excluded because birds are likely the subject: beach, coast, islet,
  marsh, swamp, lagoon, pond, fishpond, watering hole, natural history museum,
  pet shop.
- A larger share (20 images) is sampled from sky, mountains, deserts, roads,
  towers, and airport scenes (airfield, runway, heliport, hangars, and so on).

**Problems and fixes:**
- Stray birds in kept scenes (farm, park, river, and so on). Fix: screen the
  full sample with the species model and remove high-scoring images by hand.
  If one scene produces many hits, move it to the exclude list.
- The sample takes the first rows of each scene, not a random draw, so it is
  not fully random within a scene. Acceptable for a test set meant to be varied.
- Mostly easy negatives (that is why the challenge set exists).
---

