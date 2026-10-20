# bird_info_pipeline.py
#
# Purpose: Fetches all static enrichment data for the 525 bird species in the
# AvianVision dataset and saves one MongoDB document per species directly to
# MongoDB Atlas. This script does NOT handle individual sighting/observation
# records — that is handled by observations_pipline.py.
#
# Data sources:
#   - GBIF Taxonomy API      → class, order, family, genus, gbif_key
#   - GBIF Occurrence API    → aggregated migration summary (totals, top countries, monthly)
#   - IUCN Red List API v4   → conservation status, population trend, movement patterns
#   - Avian Diet Database    → prey items, prey classes, top 5 prey by diet fraction
#   - Wikipedia API          → description, intro extract, article sections
#
# Usage (run from the project root):
#   python src/bird_info_pipeline.py          # process all 525 species
#   python src/bird_info_pipeline.py --test   # process only the first 3 species

import argparse
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv

# Add the src/ folder to the Python path so we can import mongodb_client
# without installing the project as a package.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from mongodb_client import get_species_info_collection

# ---- Fixed settings ----

# Project root folder, calculated from where this script lives (inside src/).
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Path to the CSV that maps dataset labels to scientific names.
BIRD_MAPPING_PATH = PROJECT_ROOT / "data" / "bird_name_mapping.csv"

# Path to the local Avian Diet Database file.
DIET_DB_PATH = PROJECT_ROOT / "data" / "AvianDietDatabase.txt"

# GBIF API base URL — no authentication required, it is a public API.
GBIF_BASE = "https://api.gbif.org/v1"

# IUCN Red List API v4 base URL.
IUCN_BASE = "https://api.iucnredlist.org/api/v4"

# Wikipedia API endpoints.
WIKI_SEARCH_URL = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKI_EXTRACT_URL = "https://en.wikipedia.org/w/api.php"

# Wikipedia article sections that are not useful for bird biology — we skip these.
WIKI_SKIP_SECTIONS = {
    "references", "external links", "further reading", "see also",
    "notes", "footnotes", "sources", "bibliography",
}

# How long to pause between species so we do not overwhelm external APIs.
RATE_LIMIT_SECONDS = 0.5

# Human-readable labels for IUCN Red List status codes.
IUCN_STATUS_LABELS = {
    "LC": "Least Concern",
    "NT": "Near Threatened",
    "VU": "Vulnerable",
    "EN": "Endangered",
    "CR": "Critically Endangered",
    "EW": "Extinct in the Wild",
    "EX": "Extinct",
    "DD": "Data Deficient",
    "NE": "Not Evaluated",
}


# ---- Data loading ----

def load_bird_mapping():
    """Reads the bird name mapping CSV and returns a list of dicts, one per species.
    Each dict contains 'dataset_label' (the training label, e.g. 'ABBOTTS BOOBY')
    and 'scientific_name' (e.g. 'Papasula abbotti')."""

    # Read the CSV from the data folder.
    df = pd.read_csv(BIRD_MAPPING_PATH)

    # Remove rows where the scientific name is blank — those species cannot
    # be looked up in GBIF or IUCN without a scientific name.
    df = df.dropna(subset=["scientific_name"])

    # Convert each row to a plain dictionary so the rest of the script can
    # access fields by name (e.g. row["scientific_name"]).
    return df.to_dict(orient="records")


def load_diet_lookup():
    """Reads the Avian Diet Database text file once and builds a lookup
    dictionary so that diet data can be retrieved instantly for any species
    without re-reading the file each time.

    The file is tab-separated and has 75,000+ rows. We group all rows by
    scientific name and store each row as a small dict with the prey name,
    prey class, and diet fraction.

    Returns: {scientific_name_lowercase: [{"prey_name": ..., "prey_class": ..., "fraction": ...}, ...]}"""

    # Read only the four columns we need from the tab-separated file.
    df = pd.read_csv(
        DIET_DB_PATH,
        sep="\t",
        usecols=["Scientific_Name", "Prey_Common_Name", "Prey_Class", "Fraction_Diet"],
        dtype=str,
        encoding="utf-8",
    )

    # Drop rows where the diet fraction is blank — we cannot rank prey without a number.
    df = df.dropna(subset=["Fraction_Diet"])

    # Convert the fraction column from text to a float number.
    df["Fraction_Diet"] = pd.to_numeric(df["Fraction_Diet"], errors="coerce")
    df = df.dropna(subset=["Fraction_Diet"])

    # Group all rows by scientific name (lowercased so lookups are case-insensitive).
    lookup = defaultdict(list)
    for _, row in df.iterrows():
        key = str(row["Scientific_Name"]).strip().lower()
        lookup[key].append({
            "prey_name": str(row["Prey_Common_Name"]).strip(),
            "prey_class": str(row["Prey_Class"]).strip(),
            "fraction": float(row["Fraction_Diet"]),
        })

    return dict(lookup)


# ---- API fetch functions ----

def fetch_gbif_taxonomy(scientific_name):
    """Calls the GBIF species match endpoint to get the taxonomic classification
    for one species (class, order, family, genus) and the GBIF species key that
    is needed to query occurrence records.

    Returns a dict with gbif_key and taxonomy fields, or None if the lookup fails."""

    # Build the request URL and parameters.
    url = f"{GBIF_BASE}/species/match"
    params = {"name": scientific_name, "strict": "false"}

    try:
        # Make the GET request with a 10-second timeout so the script does not
        # hang if GBIF is slow to respond.
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"    GBIF taxonomy error for '{scientific_name}': {e}")
        return None

    # If GBIF returned no match at all, we cannot get taxonomy for this species.
    if data.get("matchType") == "NONE":
        print(f"    GBIF: no match for '{scientific_name}'")
        return None

    # Pull out the fields we care about from the GBIF response.
    return {
        "gbif_key": data.get("usageKey"),
        "class": data.get("class"),
        "order": data.get("order"),
        "family": data.get("family"),
        "genus": data.get("genus"),
    }


def fetch_gbif_occurrence_summary(gbif_key, max_records=300):
    """Calls the GBIF occurrence search endpoint to get sighting records for one
    species and aggregates them into a summary — the total count, the top 5 countries
    by number of sightings, and a month-by-month breakdown.

    This function does NOT return or store the individual sighting records.
    Individual records are handled by observations_pipline.py.

    Returns a dict with total_sightings, top_countries (list of 5 dicts),
    and monthly_sightings (dict with keys '1' through '12')."""

    # Track how many sightings occurred in each country and each calendar month.
    country_counts = defaultdict(int)
    monthly_counts = defaultdict(int)
    total = 0
    offset = 0
    page_size = 300

    # Page through GBIF results until we have collected enough records.
    while total < max_records:
        # Calculate how many records to ask for in this page.
        limit = min(page_size, max_records - total)

        url = f"{GBIF_BASE}/occurrence/search"
        params = {
            "speciesKey": gbif_key,
            "limit": limit,
            "offset": offset,
            "hasCoordinate": "true",
            "hasGeospatialIssue": "false",
        }

        try:
            resp = requests.get(url, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"    GBIF occurrence error (offset {offset}): {e}")
            break

        # Get the list of sighting records from this page.
        results = data.get("results", [])
        if not results:
            # No more records available from GBIF — stop paging.
            break

        # Tally the country and calendar month for each sighting.
        for rec in results:
            country = rec.get("countryCode") or rec.get("country")
            if country:
                country_counts[country] += 1

            # eventDate is formatted like "2023-05-14" — we extract just the month digits.
            event_date = rec.get("eventDate", "")
            if event_date and len(event_date) >= 7:
                try:
                    month = int(event_date[5:7])
                    if 1 <= month <= 12:
                        monthly_counts[month] += 1
                except ValueError:
                    pass

        total += len(results)
        offset += len(results)

        # If GBIF gave us fewer records than we asked for, we have reached the end.
        if len(results) < limit:
            break

        # Brief pause between pages to avoid hammering the GBIF servers.
        time.sleep(1)

    # Sort countries by sighting count and keep only the top 5.
    top_countries = sorted(country_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_countries = [{"country": c, "count": n} for c, n in top_countries]

    # Build a dict with one entry per calendar month (keys are strings "1" through "12").
    monthly_sightings = {str(m): monthly_counts.get(m, 0) for m in range(1, 13)}

    return {
        "total_sightings": total,
        "top_countries": top_countries,
        "monthly_sightings": monthly_sightings,
    }


def fetch_iucn_data(scientific_name, iucn_token):
    """Calls the IUCN Red List API v4 in two steps to get the conservation status,
    population trend, and movement patterns for one species.

    Step 1: Find the most recent assessment ID for this species.
    Step 2: Fetch that assessment to get the detailed status information.

    Returns a dict with status, status_label, population_trend, and movement_patterns,
    or None if the species is not found or either request fails."""

    # Split the scientific name into genus and species parts, which the IUCN API
    # requires as separate query parameters.
    parts = scientific_name.strip().split()
    if len(parts) < 2:
        # Cannot split — the scientific name is incomplete.
        return None
    genus = parts[0]
    species = parts[1]

    # --- Step 1: Look up the species to get its most recent assessment ID ---
    url_1 = f"{IUCN_BASE}/taxa/scientific_name"
    headers = {"Authorization": f"Bearer {iucn_token}"}
    params_1 = {"genus_name": genus, "species_name": species, "token": iucn_token}

    try:
        resp_1 = requests.get(url_1, headers=headers, params=params_1, timeout=15)
        resp_1.raise_for_status()
        data_1 = resp_1.json()
    except Exception as e:
        print(f"    IUCN step 1 error for '{scientific_name}': {e}")
        return None

    # Pull the assessments list from the response.
    assessments = data_1.get("assessments", [])
    if not assessments:
        print(f"    IUCN: no assessments found for '{scientific_name}'")
        return None

    # The first assessment in the list is the most recent one.
    assessment_id = assessments[0].get("assessment_id")
    if not assessment_id:
        return None

    # --- Step 2: Fetch the full assessment to get the detailed status fields ---
    url_2 = f"{IUCN_BASE}/assessment/{assessment_id}"
    params_2 = {"token": iucn_token}

    try:
        resp_2 = requests.get(url_2, headers=headers, params=params_2, timeout=15)
        resp_2.raise_for_status()
        data_2 = resp_2.json()
    except Exception as e:
        print(f"    IUCN step 2 error for assessment {assessment_id}: {e}")
        return None

    # Get the Red List category code (e.g. "LC", "EN") and look up its full label.
    status_code = data_2.get("red_list_category", {}).get("code")
    status_label = IUCN_STATUS_LABELS.get(status_code, status_code)

    # Population trend tells us whether numbers are increasing, decreasing, or stable.
    population_trend = data_2.get("population_trend", {}).get("description")

    # Movement patterns describe whether the species is resident, migratory, nomadic, etc.
    movements = data_2.get("systems", [])
    movement_descriptions = [m.get("description", "") for m in movements if m.get("description")]
    movement_patterns = "; ".join(movement_descriptions) if movement_descriptions else None

    return {
        "status": status_code,
        "status_label": status_label,
        "population_trend": population_trend,
        "movement_patterns": movement_patterns,
    }


def fetch_wikipedia_data(scientific_name):
    """Fetches a Wikipedia article for one bird species in three steps.

    Step 1: Search Wikipedia for the scientific name to find the correct article title.
    Step 2: Fetch the article summary (short description and opening paragraph).
    Step 3: Fetch the full plain-text article and extract named sections like
            Description, Habitat, and Breeding.

    Returns a dict with title, description, extract, and sections,
    or None if the article cannot be found."""

    # Wikipedia requires a descriptive User-Agent header for all API requests.
    headers = {
        "User-Agent": "AvianVision/1.0 (neumont capstone project; gjarrett@student.neumont.edu)"
    }

    # --- Step 1: Search for the article by scientific name ---
    search_params = {
        "action": "query",
        "list": "search",
        "srsearch": scientific_name,
        "srlimit": 1,
        "format": "json",
    }

    try:
        resp_1 = requests.get(WIKI_SEARCH_URL, params=search_params, headers=headers, timeout=10)
        resp_1.raise_for_status()
        search_data = resp_1.json()
    except Exception as e:
        print(f"    Wikipedia search error for '{scientific_name}': {e}")
        return None

    # Get the first search result to find the article title.
    search_results = search_data.get("query", {}).get("search", [])
    if not search_results:
        print(f"    Wikipedia: no results found for '{scientific_name}'")
        return None

    article_title = search_results[0]["title"]

    # --- Step 2: Fetch the article summary ---
    # The REST summary endpoint returns a short one-line description and
    # the opening paragraph of the article.
    summary_url = f"{WIKI_SUMMARY_URL}/{requests.utils.quote(article_title)}"

    try:
        resp_2 = requests.get(summary_url, headers=headers, timeout=10)
        resp_2.raise_for_status()
        summary_data = resp_2.json()
    except Exception as e:
        print(f"    Wikipedia summary error for '{article_title}': {e}")
        return None

    description = summary_data.get("description", "")
    extract = summary_data.get("extract", "")

    # --- Step 3: Fetch the full article text to extract named sections ---
    extract_params = {
        "action": "query",
        "prop": "extracts",
        "titles": article_title,
        "explaintext": 1,
        "exsectionformat": "wiki",
        "format": "json",
    }

    try:
        resp_3 = requests.get(WIKI_EXTRACT_URL, params=extract_params, headers=headers, timeout=15)
        resp_3.raise_for_status()
        extract_data = resp_3.json()
    except Exception as e:
        print(f"    Wikipedia extract error for '{article_title}': {e}")
        # We still have the summary, so return partial data rather than nothing.
        return {"title": article_title, "description": description, "extract": extract, "sections": {}}

    # Navigate the nested JSON to get the raw article text.
    pages = extract_data.get("query", {}).get("pages", {})
    page = next(iter(pages.values()), {})
    full_text = page.get("extract", "")

    # Parse the plain text into sections. Wikipedia uses "== Section Name ==" as headers.
    sections = {}
    current_section = None
    current_lines = []

    for line in full_text.splitlines():
        if line.startswith("== ") and line.endswith(" =="):
            # We have hit a new section header. Save the previous section first.
            if current_section and current_section.lower() not in WIKI_SKIP_SECTIONS:
                sections[current_section] = "\n".join(current_lines).strip()

            # Strip the == markers to get the clean section title, then start fresh.
            current_section = line[3:-3].strip()
            current_lines = []
        elif current_section:
            # This line belongs to the current section — add it to the buffer.
            current_lines.append(line)

    # Save the last section in the article (the loop ends before saving it).
    if current_section and current_section.lower() not in WIKI_SKIP_SECTIONS:
        sections[current_section] = "\n".join(current_lines).strip()

    return {
        "title": article_title,
        "description": description,
        "extract": extract,
        "sections": sections,
    }


def get_diet_data(scientific_name, diet_lookup):
    """Looks up one species in the pre-loaded diet lookup dictionary and returns
    aggregated diet information: unique prey names, unique prey classes, and the
    top 5 prey items ranked by average diet fraction.

    Returns a dict with three lists. If the species is not in the diet database,
    all three lists are empty."""

    # Look up by lowercase scientific name for a case-insensitive match.
    key = scientific_name.strip().lower()
    records = diet_lookup.get(key, [])

    if not records:
        # This species has no entries in the Avian Diet Database.
        return {"prey_common_names": [], "prey_classes": [], "top_prey": []}

    # Collect all unique prey names and prey classes across all records for this species.
    prey_names = list({r["prey_name"] for r in records if r["prey_name"]})
    prey_classes = list({r["prey_class"] for r in records if r["prey_class"]})

    # Calculate the average diet fraction for each prey item across all records,
    # then sort from highest to lowest and keep only the top 5.
    prey_totals = defaultdict(list)
    for r in records:
        if r["prey_name"]:
            prey_totals[r["prey_name"]].append(r["fraction"])

    top_prey_ranked = sorted(
        [(name, sum(fracs) / len(fracs)) for name, fracs in prey_totals.items()],
        key=lambda x: x[1],
        reverse=True,
    )[:5]

    top_prey = [{"prey": name, "avg_fraction": round(frac, 4)} for name, frac in top_prey_ranked]

    return {
        "prey_common_names": prey_names,
        "prey_classes": prey_classes,
        "top_prey": top_prey,
    }


# ---- Main pipeline ----

def run_pipeline(test_mode=False):
    """Runs the full bird info enrichment pipeline.

    Reads the 525-species mapping CSV, then for each species fetches data from
    GBIF, IUCN, Wikipedia, and the Avian Diet Database. Builds one MongoDB document
    per species and saves all documents to the species_info collection.

    If test_mode is True, only the first 3 species are processed so you can
    verify the pipeline works correctly before running it on all 525."""

    # Load environment variables from .env so we can read the IUCN key and MongoDB URI.
    load_dotenv()
    iucn_token = os.getenv("IUCN_API_KEY", "").strip()

    print("Loading bird name mapping...")
    species_list = load_bird_mapping()

    # Trim to 3 species in test mode so we can verify quickly.
    if test_mode:
        species_list = species_list[:3]
        print(f"TEST MODE: processing {len(species_list)} species only.")
    else:
        print(f"Processing {len(species_list)} species.")

    print("Loading Avian Diet Database...")
    diet_lookup = load_diet_lookup()
    print(f"  Diet database loaded ({len(diet_lookup)} species entries).")

    print("Connecting to MongoDB...")
    collection = get_species_info_collection()

    # Delete all existing documents in the collection before starting.
    # This prevents duplicate documents if the pipeline is run more than once.
    delete_result = collection.delete_many({})
    print(f"  Cleared {delete_result.deleted_count} existing documents from species_info.")

    documents = []

    # Process each species one at a time.
    for i, species in enumerate(species_list, start=1):
        label = species["dataset_label"]
        sci_name = species["scientific_name"]

        print(f"\n[{i}/{len(species_list)}] {label} ({sci_name})")

        # --- GBIF Taxonomy ---
        # Get the bird's scientific classification and its GBIF species key.
        print("  Fetching GBIF taxonomy...")
        gbif_data = fetch_gbif_taxonomy(sci_name)
        gbif_key = gbif_data["gbif_key"] if gbif_data else None
        taxonomy = {
            "class": gbif_data.get("class") if gbif_data else None,
            "order": gbif_data.get("order") if gbif_data else None,
            "family": gbif_data.get("family") if gbif_data else None,
            "genus": gbif_data.get("genus") if gbif_data else None,
        }

        # --- GBIF Occurrence Summary ---
        # Get aggregated sighting stats (totals, top countries, monthly counts).
        # We only do this if we have a valid GBIF key from the taxonomy step.
        empty_migration = {
            "total_sightings": 0,
            "top_countries": [],
            "monthly_sightings": {str(m): 0 for m in range(1, 13)},
        }
        if gbif_key:
            print("  Fetching GBIF occurrence summary...")
            migration = fetch_gbif_occurrence_summary(gbif_key, max_records=300)
        else:
            migration = empty_migration

        # --- IUCN Conservation Status ---
        # Get the bird's Red List status, population trend, and movement patterns.
        print("  Fetching IUCN conservation data...")
        iucn_data = fetch_iucn_data(sci_name, iucn_token)
        conservation = iucn_data if iucn_data else {
            "status": None,
            "status_label": None,
            "population_trend": None,
            "movement_patterns": None,
        }

        # --- Avian Diet Database ---
        # Look up what this bird eats using the pre-loaded diet lookup dictionary.
        print("  Looking up diet data...")
        diet = get_diet_data(sci_name, diet_lookup)

        # --- Wikipedia ---
        # Fetch the article title, description, summary extract, and article sections.
        print("  Fetching Wikipedia data...")
        wiki_data = fetch_wikipedia_data(sci_name)
        wikipedia = wiki_data if wiki_data else {
            "title": None,
            "description": None,
            "extract": None,
            "sections": {},
        }

        # --- Assemble the MongoDB document ---
        # Combine all enrichment fields into one document for this species.
        doc = {
            "species_label": label,
            "scientific_name": sci_name,
            "gbif_key": gbif_key,
            "taxonomy": taxonomy,
            "conservation": conservation,
            "diet": diet,
            "migration": migration,
            "wikipedia": wikipedia,
        }

        documents.append(doc)

        # Pause before the next species to stay within API rate limits.
        time.sleep(RATE_LIMIT_SECONDS)

    # Insert all documents into MongoDB in one batch operation.
    print(f"\nSaving {len(documents)} documents to MongoDB species_info collection...")
    if documents:
        collection.insert_many(documents)
        print(f"  Done. {len(documents)} species saved successfully.")
    else:
        print("  No documents to save.")


# ---- Entry point ----

if __name__ == "__main__":
    # Set up the command-line interface.
    parser = argparse.ArgumentParser(
        description="Fetch bird info from GBIF, IUCN, Wikipedia, and the Diet DB, then save to MongoDB."
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Process only the first 3 species instead of all 525.",
    )
    args = parser.parse_args()

    # Run the pipeline.
    run_pipeline(test_mode=args.test)
