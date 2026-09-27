# build_bird_mapping.py
#
# Purpose: Take the 525 bird labels from the Hugging Face dataset, match each one
# to its scientific name using the eBird taxonomy, and save the results to a CSV
# mapping file that later phases (especially Phase 3 enrichment) will depend on.

from pathlib import Path
import os
import re
from difflib import get_close_matches

import pandas as pd
from dotenv import load_dotenv
from datasets import load_dataset
from huggingface_hub import login


# ---- File paths ----
# Work out the project's main folder based on where this script lives (it lives in
# the "src" folder, so the project root is one level up). Building the paths this
# way means the script works no matter which folder it is run from.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Location of the eBird taxonomy file (download it from the Cornell Lab website and
# save it into the "data" folder). Change this line if you keep the file elsewhere.
EBIRD_CSV_PATH = PROJECT_ROOT / "data" / "eBird_taxonomy.csv"

# Where the finished bird name mapping file will be saved.
OUTPUT_CSV_PATH = PROJECT_ROOT / "data" / "bird_name_mapping.csv"


# ---- Manual overrides for known naming mismatches ----
# These are hand-verified matches for birds whose dataset label does not line up
# with the eBird common names. A value of None means the bird has no single clear
# scientific name, so it is treated as ambiguous.
MANUAL_MAP = {
    "WHIMBREL": "Numenius phaeopus",
    "NORTHERN GOSHAWK": "Accipiter gentilis",
    "OSTRICH": "Struthio camelus",
    "PEACOCK": "Pavo cristatus",
    "MALLARD DUCK": "Anas platyrhynchos",
    "BLUE HERON": "Ardea herodias",
    "HOOPOES": "Upupa epops",
    "KOOKABURRA": "Dacelo novaeguineae",
    "LILAC ROLLER": "Coracias caudatus",
    "CANARY": "Serinus canaria",
    "CASSOWARY": "Casuarius casuarius",
    "KIWI": "Apteryx mantelli",
    "PUFFIN": "Fratercula arctica",
    "MYNA": "Acridotheres tristis",
    "CROW": "Corvus brachyrhynchos",
    "FAIRY PENGUIN": "Eudyptula minor",
    "FAIRY BLUEBIRD": "Irena puella",
    "FAIRY TERN": "Gygis alba",
    "AFRICAN CROWNED CRANE": "Balearica regulorum",
    "BALD IBIS": "Geronticus eremita",
    "QUETZAL": "Pharomachrus mocinno",
    "UMBRELLA BIRD": "Cephalopterus ornatus",
    "CARMINE BEE-EATER": "Merops nubicus",
    "COMMON HOUSE MARTIN": "Delichon urbicum",
    "GREY PLOVER": "Pluvialis squatarola",
    "TIT MOUSE": "Baeolophus bicolor",
    "GUINEAFOWL": "Numida meleagris",
    "ALPINE CHOUGH": "Pyrrhocorax graculus",
    "BUSH TURKEY": "Alectura lathami",
    "TAKAHE": "Porphyrio hochstetteri",
    "GREEN MAGPIE": "Cissa chinensis",
    "GREEN WINGED DOVE": "Chalcophaps indica",
    "PURPLE SWAMPHEN": "Porphyrio porphyrio",
    "ASIAN DOLLARD BIRD": "Eurystomus orientalis",
    "ROUGH LEG BUZZARD": "Buteo lagopus",
    "MASKED BOBWHITE": "Colinus virginianus",
    "RED HEADED DUCK": "Aythya americana",
    "RED BROWED FINCH": "Neochmia temporalis",
    "STEAMER DUCK": "Tachyeres pteneres",
    "IMPERIAL SHAQ": "Leucocarbo atriceps",
    "AUCKLAND SHAQ": "Leucocarbo colensoi",
    "AZURE TANAGER": "Tangara cayana",
    "BLUE THROATED TOUCANET": "Aulacorhynchus caeruleogularis",
    "BLACK HEADED CAIQUE": "Pionites melanocephalus",
    "GO AWAY BIRD": "Corythaixoides leucogaster",
    "COCK OF THE  ROCK": "Rupicola peruvianus",
    "TOUCHAN": "Ramphastos toco",
    "PARUS MAJOR": "Parus major",  # dataset used the scientific name by mistake
    "SCARLET CROWNED FRUIT DOVE": "Ptilinopus pulchellus",
    "STRIPPED SWALLOW": "Cecropis striolata",
    "CHARA DE COLLAR": "Calocitta formosa",
    "ENGGANO MYNA": "Acridotheres melanopterus",
    # Verified corrections for fuzzy matches that landed on the wrong bird.
    # Each of these was checked by hand during the Phase 1 name review.
    "BALI STARLING": "Leucopsar rothschildi",
    "BANDED PITA": "Hydrornis guajanus",
    "BARN OWL": "Tyto alba",
    "BLACK COCKATO": "Calyptorhynchus banksii",
    "BLACK THROATED HUET": "Pteroptochos tarnii",
    "BLACK-NECKED GREBE": "Podiceps nigricollis",
    "BLUE GROUSE": "Dendragapus obscurus",
    "BORNEAN PHEASANT": "Polyplectron schleiermacheri",
    "CAPE GLOSSY STARLING": "Lamprotornis nitens",
    "CAPE LONGCLAW": "Macronyx capensis",
    "CHUKAR PARTRIDGE": "Alectoris chukar",
    "COMMON STARLING": "Sturnus vulgaris",
    "CRESTED SHRIKETIT": "Falcunculus frontatus",
    "INDIAN BUSTARD": "Ardeotis nigriceps",
    "LITTLE AUK": "Alle alle",
    "PYGMY KINGFISHER": "Chloroceryle aenea",
    "ROADRUNNER": "Geococcyx californianus",
    "ROCK DOVE": "Columba livia",
    "ROSE BREASTED COCKATOO": "Eolophus roseicapilla",
    "ROYAL FLYCATCHER": "Onychorhynchus coronatus",
    "SAND MARTIN": "Riparia riparia",
    "BLACK THROATED WARBLER": "Setophaga caerulescens",
    "EASTERN GOLDEN WEAVER": "Ploceus subaureus",
    "SAMATRAN THRUSH": "Garrulax bicolor",
    "CRESTED NUTHATCH": "Sitta europaea",  # fallback: genus type species (no exact "Crested nuthatch")
    "RED TAILED THRUSH": "Neocossyphus rufus",
    "YELLOW CACIQUE": "Cacicus cela",
    # Second review batch — subtler fuzzy corrections, also checked by hand.
    "AFRICAN PIED HORNBILL": "Lophoceros semifasciatus",
    "FLAME TANAGER": "Piranga bidentata",
    "MALABAR HORNBILL": "Ocyceros griseus",
    "CRESTED FIREBACK": "Lophura ignita",
    "TURQUOISE MOTMOT": "Eumomota superciliosa",
    "OYSTER CATCHER": "Haematopus ostralegus",
    "TAILORBIRD": "Orthotomus sutorius",
    "RED BELLIED PITTA": "Erythropitta erythrogaster",
    "RUFOUS KINGFISHER": "Todiramphus winchelli",
    # Truly ambiguous / domestic breeds — no single scientific name
    "ALBATROSS": None,
    "ANTBIRD": None,
    "BIRD OF PARADISE": None,
    "FRIGATE": None,
    "COCKATOO": None,
    "TEAL DUCK": None,
    "FRILL BACK PIGEON": None,
    "JACOBIN PIGEON": None,
    "LOONEY BIRDS": None,  # likely the unknown class
}


def sign_in_to_huggingface():
    """Signs in to Hugging Face using the token kept safely in the .env file."""
    # Load the secret values stored in the .env file into the program's memory.
    load_dotenv()
    # Grab the Hugging Face token by its name, without ever writing it in the code.
    token = os.getenv("HF_TOKEN")
    # Sign in so downloads get the higher request limits that come with a token.
    login(token=token)


def load_ebird_lookup(csv_path):
    """Loads the eBird taxonomy CSV and builds a common-name to scientific-name lookup."""
    # Read the eBird taxonomy file into a table.
    ebird = pd.read_csv(csv_path)
    # Keep only true species rows and drop everything else (subspecies, groups, etc.).
    ebird_species = ebird[ebird["CATEGORY"] == "species"].copy()
    # Make a lowercase version of every common name so matching ignores capitalization.
    ebird_species["common_lower"] = ebird_species["PRIMARY_COM_NAME"].str.lower()
    # Build a quick dictionary that maps each common name to its scientific name.
    name_to_sci = dict(zip(ebird_species["common_lower"], ebird_species["SCI_NAME"]))
    # Return the dictionary plus the plain list of names (needed for fuzzy matching).
    return name_to_sci, list(name_to_sci.keys())


def normalize(name):
    """Cleans up a bird name by fixing extra spaces and standardizing capitalization."""
    # Collapse any repeated spaces into one and put the name into Title Case.
    return re.sub(r"\s+", " ", name.title()).strip()


def match_bird_name(raw_name, name_to_sci, all_common_names):
    """Finds the scientific name for one dataset label and reports how it was matched."""
    # Standardize the label so it can be compared against the eBird names.
    formatted_lower = normalize(raw_name).lower()

    # First choice: check the hand-verified manual overrides.
    if raw_name in MANUAL_MAP:
        sci = MANUAL_MAP[raw_name]
        if sci:
            # A trusted manual match that has a real scientific name.
            return sci, "manual", "no"
        # A known bird with no single clear scientific name — flag it for review.
        return "", "ambiguous", "yes"

    # Second choice: an exact match against the eBird common names.
    if formatted_lower in name_to_sci:
        return name_to_sci[formatted_lower], "exact", "no"

    # Third choice: a close (fuzzy) guess when nothing exact is found.
    close = get_close_matches(formatted_lower, all_common_names, n=1, cutoff=0.8)
    if close:
        # A best-guess match that a human should double-check before trusting.
        return name_to_sci[close[0]], "fuzzy", "yes"

    # Last case: nothing matched at all — flag it for review.
    return "", "unmatched", "yes"


def build_mapping():
    """Runs the full process: loads the data, matches all 525 birds, and saves the CSV."""
    # Sign in to Hugging Face so the dataset download gets higher rate limits.
    sign_in_to_huggingface()

    # Load the eBird lookup dictionary and the list of names used for fuzzy matching.
    name_to_sci, all_common_names = load_ebird_lookup(EBIRD_CSV_PATH)

    # Load the list of 525 bird labels from the Hugging Face dataset.
    dataset = load_dataset("yashikota/birds-525-species-image-classification", split="train")
    bird_names = dataset.features["label"].names
    print(f"Total labels: {len(bird_names)}\n")

    # Prepare a place to collect one row per bird for the final CSV.
    rows = []
    # Set up counters so we can print a summary of the results at the end.
    counts = {"exact": 0, "fuzzy": 0, "manual": 0, "ambiguous": 0, "unmatched": 0}

    # Go through every bird label and work out its scientific name.
    for name in bird_names:
        sci, match_type, needs_review = match_bird_name(name, name_to_sci, all_common_names)
        # Save this bird's result as one row for the CSV.
        rows.append({
            "dataset_label": name,
            "scientific_name": sci,
            "match_type": match_type,
            "needs_review": needs_review,
        })
        # Add one to the running tally for this kind of match.
        counts[match_type] += 1

    # Turn the collected rows into a table and save it as the mapping CSV.
    df = pd.DataFrame(
        rows,
        columns=["dataset_label", "scientific_name", "match_type", "needs_review"],
    )
    df.to_csv(OUTPUT_CSV_PATH, index=False)

    # Print a summary so we can see at a glance how the matching went.
    total_matched = counts["exact"] + counts["fuzzy"] + counts["manual"]
    flagged = sum(1 for r in rows if r["needs_review"] == "yes")
    print("=" * 50)
    print(f"Exact:     {counts['exact']}")
    print(f"Fuzzy:     {counts['fuzzy']}")
    print(f"Manual:    {counts['manual']}")
    print(f"Ambiguous: {counts['ambiguous']}")
    print(f"No match:  {counts['unmatched']}")
    print("=" * 50)
    print(f"TOTAL MATCHED: {total_matched}/525")
    print(f"Rows flagged for review: {flagged}")
    print(f"\nSaved mapping to: {OUTPUT_CSV_PATH}")


# Run the whole process only when this file is executed directly.
if __name__ == "__main__":
    build_mapping()
