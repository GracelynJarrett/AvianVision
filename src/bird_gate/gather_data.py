"""gather_data.py - download and sample the five bird-gate sources into data/raw.

Run from anywhere:
    python src/bird_gate/gather_data.py                  # all sources
    python src/bird_gate/gather_data.py --only cub aves  # some sources
    python src/bird_gate/gather_data.py --out D:/bird_data/raw

Needs: pip install kagglehub datasets huggingface_hub requests

Output layout (one folder per source, one subfolder per label):
    data/raw/<source>/bird/...        data/bird_gate/raw/<source>/not_bird/...
    data/raw/manifest_<source>.csv    one manifest per source

Images are saved with their ORIGINAL bytes (no re-encoding), so the file-hash
check against the 525-species set still works. combine_split_data.py should
read all manifest_*.csv files, then deduplicate, balance, and split.

Sources and roles (see bird_gate.md, section 6):
    pooled train/val/test : cub, bird_vs_drone, caltech
    held-out new-source   : aves (birds), places (not birds)
"""

import argparse
import csv
import random
import re
import shutil
import time
from collections import defaultdict
from pathlib import Path, PurePosixPath

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
SEED = 42
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# src/bird_gate/gather_data.py -> project root is two levels up
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "data" / "bird_gate"/"raw"

KAGGLE_BVD = "harshwalia/birds-vs-drone-dataset"
HF_CALTECH = "ilee0022/Caltech-256"
HF_CUB = "bentrevett/caltech-ucsd-birds-200-2011"
HF_AVES = "AndresFelipeYule/AvesdelTolima"
HF_PLACES = "ljnlonoljpiljm/places365-256px"

# Caps (the pool is capped again later when balancing; these keep downloads small)
CUB_CAP = 3000
CALTECH_PER_CLASS = 12          # about 3,000 images over ~247 kept classes
CALTECH_HARD_PER_CLASS = 60     # airplanes + challenge classes get a bigger share
AVES_PER_SPECIES = 270          # 11 species -> about 2,970

# Caltech-256: names are compared after normalizing (see norm_caltech)
CALTECH_REMOVE = {
    "cormorant", "duck", "goose", "hummingbird", "ibis", "ostrich", "owl",
    "penguin", "swan", "birdbath",
}
CALTECH_HARD = {
    "airplanes", "fighter_jet", "helicopter", "hot_air_balloon", "blimp",
    "bat", "butterfly", "house_fly",
}

# Aves del Tolima: four folders that repeat the Latin-name folders
AVES_DROP = {
    "BATARA_CARCAJADA", "HORMIGUERO_GUARDABOSQUE",
    "TIRANUELO_CEJIAMARILLO", "TOROROI_COMPADRE",
}

# Places365
PLACES_STRIDE = 3000            # 1 request every 3,000 rows (rows are sorted by scene)
PLACES_BLOCK = 20               # rows per request
PLACES_QUOTA = 8                # images per scene
PLACES_KEY_QUOTA = 20           # images for sky / mountain / desert / road / tower / airport scenes
PLACES_EXCLUDE = {
    "beach", "coast", "islet", "marsh", "swamp", "lagoon", "pond", "fishpond",
    "watering_hole", "natural_history_museum", "pet_shop",
}
PLACES_KEY_TOKENS = {
    "sky", "mountain", "desert", "road", "highway", "tower",
    "airfield", "runway", "heliport", "hangar",
}
# Scenes the notes say were needed but that stride sampling can miss
PLACES_NEEDED = {
    "sky", "skyscraper", "snowfield", "volcano", "runway", "hangar_outdoor",
    "oilrig", "lighthouse",
}

FIELDS = ["path", "label", "source", "subgroup", "orig_class", "orig_name"]

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def norm_caltech(name):
    """'105.fighter-jet' / 'fighter-jet' / 'airplanes-101' -> 'fighter_jet' / 'airplanes'."""
    s = str(name).lower().strip()
    s = re.sub(r"^\d+[._\-\s]*", "", s)            # leading class number
    s = re.sub(r"[\s\-]+", "_", s)
    s = re.sub(r"_101$", "", s)
    return s.strip("_")


def norm_scene(name):
    """'/a/airfield' -> 'airfield'; '/h/hangar/outdoor' -> 'hangar_outdoor'."""
    s = str(name).lower().strip()
    s = re.sub(r"^/[a-z]/", "", s)
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def slug(text):
    return re.sub(r"[^A-Za-z0-9]+", "_", str(text)).strip("_").lower()


def ext_of(name, default=".jpg"):
    e = Path(str(name)).suffix.lower()
    return e if e in IMG_EXTS else default


def write_manifest(out, source, rows):
    out.mkdir(parents=True, exist_ok=True)
    with open(out / f"manifest_{source}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    n_bird = sum(r["label"] == "bird" for r in rows)
    print(f"[{source}] wrote {len(rows)} rows ({n_bird} bird, {len(rows) - n_bird} not_bird)")


def make_row(out, dest, label, source, subgroup, orig_class="", orig_name=""):
    return {
        "path": dest.relative_to(out).as_posix(),
        "label": label,
        "source": source,
        "subgroup": subgroup,
        "orig_class": orig_class,
        "orig_name": orig_name,
    }


def retry(fn, tries=4, wait=2.0):
    for k in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 - network flakiness
            if k == tries - 1:
                raise
            time.sleep(wait * (k + 1))
    return None


def load_hf_all_splits(name):
    """Load every split of an HF image dataset as one dataset, with raw image bytes."""
    from datasets import Image, concatenate_datasets, load_dataset

    dd = load_dataset(name)
    ds = concatenate_datasets([dd[k] for k in dd])
    if "image" not in ds.column_names:
        raise RuntimeError(f"{name}: no 'image' column; columns are {ds.column_names}")
    return ds.cast_column("image", Image(decode=False))


def save_hf_image(entry, dest):
    """entry = {'bytes': ..., 'path': ...} from an Image(decode=False) column."""
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    data = entry.get("bytes")
    if data:
        dest.write_bytes(data)
    elif entry.get("path"):
        shutil.copyfile(entry["path"], dest)
    else:
        raise RuntimeError("image entry has neither bytes nor path")

# --------------------------------------------------------------------------
# Sources
# --------------------------------------------------------------------------
def gather_bird_vs_drone(out):
    import kagglehub

    src = Path(kagglehub.dataset_download(KAGGLE_BVD))
    print(f"[bird_vs_drone] downloaded to {src}")
    rows = []
    for label, folder, subgroup in (
        ("bird", "birds", "bird_vs_drone_bird"),
        ("not_bird", "drones", "drone"),
    ):
        dirs = [d for d in src.rglob("*") if d.is_dir() and d.name.lower() == folder]
        if not dirs:
            raise RuntimeError(f"no '{folder}' folder found under {src}")
        files = sorted(p for d in dirs for p in d.rglob("*") if p.suffix.lower() in IMG_EXTS)
        print(f"[bird_vs_drone] {folder}: {len(files)} images")
        for i, p in enumerate(files):
            dest = out / "bird_vs_drone" / label / f"bvd_{label}_{i:05d}{p.suffix.lower()}"
            if not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(p, dest)
            rows.append(make_row(out, dest, label, "bird_vs_drone", subgroup, folder, p.name))
    write_manifest(out, "bird_vs_drone", rows)


def gather_cub(out):
    ds = load_hf_all_splits(HF_CUB)
    print(f"[cub] {len(ds)} images across all splits")
    rng = random.Random(SEED)
    idx = sorted(rng.sample(range(len(ds)), min(CUB_CAP, len(ds))))
    rows = []
    for i in idx:
        entry = ds[i]["image"]
        dest = out / "cub" / "bird" / f"cub_{i:06d}{ext_of(entry.get('path'))}"
        save_hf_image(entry, dest)
        rows.append(make_row(out, dest, "bird", "cub", "photo", "", Path(str(entry.get("path") or "")).name))
    write_manifest(out, "cub", rows)


def gather_caltech(out):
    ds = load_hf_all_splits(HF_CALTECH)
    if "text" in ds.column_names:
        names = list(ds["text"])
    else:
        label_names = ds.features["label"].names
        names = [label_names[i] for i in ds["label"]]
    bases = [norm_caltech(n) for n in names]

    all_classes = sorted(set(bases))
    removed = sorted(c for c in all_classes if c in CALTECH_REMOVE)
    hard = sorted(c for c in all_classes if c in CALTECH_HARD)
    print(f"[caltech] {len(all_classes)} classes found")
    print(f"[caltech] REMOVED ({len(removed)}, expect 10): {removed}")
    print(f"[caltech] HARD    ({len(hard)}, expect 8):  {hard}")
    if len(removed) != 10 or len(hard) != 8:
        print("[caltech] WARNING: class-name matching looks off. Print the class "
              "names and fix CALTECH_REMOVE / CALTECH_HARD before trusting this run.")

    by_class = defaultdict(list)
    for i, c in enumerate(bases):
        if c not in CALTECH_REMOVE:
            by_class[c].append(i)

    rng = random.Random(SEED)
    rows = []
    for c in sorted(by_class):
        cap = CALTECH_HARD_PER_CLASS if c in CALTECH_HARD else CALTECH_PER_CLASS
        picks = sorted(rng.sample(by_class[c], min(cap, len(by_class[c]))))
        if c == "airplanes":
            subgroup = "airplane"
        elif c in CALTECH_HARD:
            subgroup = "challenge_" + c
        else:
            subgroup = "object"
        for i in picks:
            entry = ds[i]["image"]
            dest = out / "caltech" / "not_bird" / f"cal_{i:06d}{ext_of(entry.get('path'))}"
            save_hf_image(entry, dest)
            rows.append(make_row(out, dest, "not_bird", "caltech", subgroup, c))
    write_manifest(out, "caltech", rows)


def gather_aves(out):
    from huggingface_hub import HfApi, hf_hub_download

    files = retry(lambda: HfApi().list_repo_files(HF_AVES, repo_type="dataset"))
    by_species = defaultdict(list)
    for f in files:
        p = PurePosixPath(f)
        if p.suffix.lower() not in IMG_EXTS or len(p.parts) < 2:
            continue
        species = p.parts[-2]
        if species.upper() in AVES_DROP:
            continue
        by_species[species].append(f)

    print(f"[aves] {len(by_species)} species folders kept (expect 11):")
    for s in sorted(by_species):
        print(f"        {s}: {len(by_species[s])} files")
    if len(by_species) != 11:
        print("[aves] WARNING: expected 11 species folders. Check AVES_DROP and the folder names.")

    rng = random.Random(SEED)
    rows = []
    for species in sorted(by_species):
        picks = sorted(rng.sample(by_species[species], min(AVES_PER_SPECIES, len(by_species[species]))))
        for f in picks:
            name = PurePosixPath(f).name
            dest = out / "aves_tolima" / "bird" / f"{slug(species)}__{name}"
            if not dest.exists():
                local = retry(lambda f=f: hf_hub_download(HF_AVES, f, repo_type="dataset"))
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(local, dest)
            rows.append(make_row(out, dest, "bird", "aves_tolima", "tolima", species, name))
    write_manifest(out, "aves_tolima", rows)


def gather_places(out):
    import requests

    base = "https://datasets-server.huggingface.co/rows"
    params = {"dataset": HF_PLACES, "config": "default", "split": "train"}

    def fetch(offset, length):
        def call():
            r = requests.get(base, params={**params, "offset": offset, "length": length}, timeout=60)
            r.raise_for_status()
            return r.json()
        try:
            return retry(call, tries=4, wait=2.0)
        except Exception:  # noqa: BLE001
            return None

    first = fetch(0, 1)
    if first is None:
        raise RuntimeError("could not reach the Hugging Face dataset viewer for Places365")
    total = first["num_rows_total"]
    names = next(f["type"]["names"] for f in first["features"] if f["name"] == "label")
    print(f"[places] {total} rows, {len(names)} scenes")

    counts = defaultdict(int)
    rows, failed_requests, offsets = [], 0, list(range(0, total, PLACES_STRIDE))
    for n, offset in enumerate(offsets):
        data = fetch(offset, PLACES_BLOCK)
        if data is None:
            failed_requests += 1
            continue
        for r in data["rows"]:
            row = r["row"]
            scene = norm_scene(names[row["label"]])
            if scene in PLACES_EXCLUDE:
                continue
            key = bool(set(scene.split("_")) & PLACES_KEY_TOKENS)
            quota = PLACES_KEY_QUOTA if key else PLACES_QUOTA
            if counts[scene] >= quota:
                continue
            dest = out / "places365" / "not_bird" / f"{slug(scene)}__{r['row_idx']:07d}.jpg"
            if not dest.exists():
                try:
                    img = retry(lambda u=row["image"]["src"]: requests.get(u, timeout=60))
                    img.raise_for_status()
                except Exception:  # noqa: BLE001
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(img.content)
            counts[scene] += 1
            rows.append(make_row(out, dest, "not_bird", "places365", "scene", scene, dest.name))
        if (n + 1) % 50 == 0:
            print(f"[places] {n + 1}/{len(offsets)} requests, {len(rows)} images, {failed_requests} failed")
        time.sleep(0.2)

    write_manifest(out, "places365", rows)
    print(f"[places] scenes found: {len(counts)}; failed requests: {failed_requests}")
    missing = sorted(s for s in PLACES_NEEDED if counts[s] == 0)
    if missing:
        print(f"[places] needed scenes NOT found by stride sampling: {missing}\n"
              "         Find their row offsets (binary search, as in the notes) and add them.")


SOURCES = {
    "bird_vs_drone": gather_bird_vs_drone,
    "cub": gather_cub,
    "caltech": gather_caltech,
    "aves": gather_aves,
    "places": gather_places,
}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"output folder (default {DEFAULT_OUT})")
    ap.add_argument("--only", nargs="+", choices=sorted(SOURCES), help="gather only these sources")
    args = ap.parse_args()

    for name in args.only or list(SOURCES):
        print(f"\n=== {name} ===")
        SOURCES[name](args.out)


if __name__ == "__main__":
    main()




















