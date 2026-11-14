# observations_pipline.py
#
# Purpose: Fetches individual GBIF occurrence (sighting) records for the 525
# bird species in the AvianVision dataset and saves each sighting as its own
# document in the MongoDB Atlas species_observations collection.
#
# This script is kept separate from bird_info_pipeline.py because observation
# data can be very large (potentially hundreds of thousands of records). Keeping
# it separate means you can increase the record limit or re-run just the
# observations without touching the bird info data.
#
# Usage (run from the project root):
#   python src/observations_pipline.py                  # all 525 species, 300 records each
#   python src/observations_pipline.py --test           # first 3 species only
#   python src/observations_pipline.py --limit 1000     # up to 1000 records per species

import argparse
import sys
import time
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv

# Add the src/ folder to the Python path so we can import mongodb_client
# without installing the project as a package.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from mongodb_client import get_species_observations_collection

# ---- Fixed settings ----

# Project root folder, calculated from where this script lives (inside src/).
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Path to the CSV that maps dataset labels to scientific names.
BIRD_MAPPING_PATH = PROJECT_ROOT / "data" / "bird_name_mapping.csv"

# GBIF API base URL — no authentication required, it is a public API.
GBIF_BASE = "https://api.gbif.org/v1"

# Default maximum number of occurrence records to fetch per species.
# This can be increased with the --limit flag when running the script.
DEFAULT_LIMIT = 1000

# How long to pause between species so we do not overwhelm external APIs.
RATE_LIMIT_SECONDS = 0.5


# ---- Data loading ----

def load_bird_mapping():
    """Reads the bird name mapping CSV and returns a list of dicts, one per species.
    Each dict contains 'dataset_label' and 'scientific_name'."""

    # Read the CSV from the data folder.
    df = pd.read_csv(BIRD_MAPPING_PATH)

    # Remove rows where the scientific name is missing — GBIF cannot be queried
    # without a scientific name.
    df = df.dropna(subset=["scientific_name"])

    # Convert each row to a plain dictionary for easy field access.
    return df.to_dict(orient="records")


# ---- API fetch functions ----

def fetch_gbif_key(scientific_name):
    """Calls the GBIF species match endpoint to get the numeric GBIF species key
    for one bird. This key is required to query occurrence records for that species.

    Returns the integer key, or None if the species cannot be found."""

    # Build the request to match the scientific name against GBIF's species database.
    url = f"{GBIF_BASE}/species/match"
    params = {"name": scientific_name, "strict": "false"}

    try:
        # Request with a 10-second timeout so the script does not hang.
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"    GBIF key lookup error for '{scientific_name}': {e}")
        return None

    # If GBIF found no match, we cannot fetch observations for this species.
    if data.get("matchType") == "NONE":
        print(f"    GBIF: no match for '{scientific_name}'")
        return None

    # usageKey is the numeric ID GBIF uses internally for this species.
    return data.get("usageKey")


def fetch_gbif_occurrences(gbif_key, scientific_name, dataset_label, max_records=DEFAULT_LIMIT):
    """Fetches individual GBIF sighting records for one species and returns them as a
    list of MongoDB-ready documents. Each document represents one sighting event.

    Only records that have valid coordinates AND a parseable date are included.
    Records missing either field are silently skipped.

    Returns a list of dicts, one per sighting record."""

    records = []
    offset = 0
    page_size = 300

    # Keep fetching pages of results until we hit the requested maximum.
    while len(records) < max_records:
        # Ask for as many records as we still need, but no more than one page at a time.
        limit = min(page_size, max_records - len(records))

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
            print(f"    GBIF occurrence fetch error (offset {offset}): {e}")
            break

        # Pull the list of sighting records from this page of results.
        results = data.get("results", [])
        if not results:
            # GBIF has no more records — stop paging.
            break

        # Convert each raw GBIF record into a clean MongoDB document.
        for rec in results:
            lat = rec.get("decimalLatitude")
            lon = rec.get("decimalLongitude")
            country = rec.get("country") or rec.get("countryCode")
            event_date = rec.get("eventDate", "")

            # Skip this record if it has no date — we cannot extract month or year.
            if not event_date or len(event_date) < 7:
                continue

            # Parse the month and year out of the ISO date string (e.g. "2023-05-14").
            try:
                month = int(event_date[5:7])
                year = int(event_date[:4])
            except (ValueError, IndexError):
                # Date is malformed — skip this record.
                continue

            # Build one MongoDB document for this single sighting.
            doc = {
                "species_label": dataset_label,
                "scientific_name": scientific_name,
                "gbif_key": gbif_key,
                "lat": lat,
                "lon": lon,
                "country": country,
                "event_date": event_date[:10],  # keep only the "YYYY-MM-DD" portion
                "month": month,
                "year": year,
            }
            records.append(doc)

        offset += len(results)

        # If GBIF returned fewer records than we asked for, there are no more pages.
        if len(results) < limit:
            break

        # Short pause between pages to be considerate of the GBIF servers.
        time.sleep(1)

    return records


# ---- Main pipeline ----

def run_pipeline(test_mode=False, limit_per_species=DEFAULT_LIMIT):
    """Runs the full observations pipeline.

    Reads the 525-species mapping CSV, looks up each species in GBIF to get its
    species key, fetches individual sighting records up to the specified limit per
    species, and saves all records to the MongoDB species_observations collection.

    If test_mode is True, only the first 3 species are processed.
    limit_per_species sets the maximum number of sighting records per species."""

    # Load environment variables from .env (needed to connect to MongoDB).
    load_dotenv()

    print("Loading bird name mapping...")
    species_list = load_bird_mapping()

    # In test mode, only process the first 3 species for a quick verification run.
    if test_mode:
        species_list = species_list[:3]
        print(f"TEST MODE: processing {len(species_list)} species only.")
    else:
        print(f"Processing {len(species_list)} species.")

    print(f"Records per species limit: {limit_per_species}")

    print("Connecting to MongoDB...")
    collection = get_species_observations_collection()

    # Delete all existing observation documents before starting.
    # This prevents duplicates if the pipeline is run more than once.
    delete_result = collection.delete_many({})
    print(f"  Cleared {delete_result.deleted_count} existing documents from species_observations.")

    total_inserted = 0

    # Process each species one at a time.
    for i, species in enumerate(species_list, start=1):
        label = species["dataset_label"]
        sci_name = species["scientific_name"]

        print(f"\n[{i}/{len(species_list)}] {label} ({sci_name})")

        # Get the GBIF species key — needed to query occurrence records.
        print("  Looking up GBIF key...")
        gbif_key = fetch_gbif_key(sci_name)

        if gbif_key is None:
            # No GBIF key means we cannot fetch observations — skip this species.
            print(f"  Skipping '{label}' — no GBIF key found.")
            time.sleep(RATE_LIMIT_SECONDS)
            continue

        # Fetch individual sighting records for this species up to the limit.
        print(f"  Fetching up to {limit_per_species} occurrence records...")
        records = fetch_gbif_occurrences(gbif_key, sci_name, label, max_records=limit_per_species)
        print(f"  Got {len(records)} valid records.")

        # Insert this batch of records into MongoDB all at once.
        if records:
            collection.insert_many(records)
            total_inserted += len(records)

        # Pause before the next species to stay within API rate limits.
        time.sleep(RATE_LIMIT_SECONDS)

    print(f"\nDone. Total observation documents saved to MongoDB: {total_inserted}")


# ---- Entry point ----

if __name__ == "__main__":
    # Set up the command-line interface.
    parser = argparse.ArgumentParser(
        description="Fetch GBIF occurrence records for all bird species and save to MongoDB."
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Process only the first 3 species instead of all 525.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_LIMIT,
        help=f"Maximum number of occurrence records to fetch per species (default: {DEFAULT_LIMIT}).",
    )
    args = parser.parse_args()

    # Run the pipeline with the provided arguments.
    run_pipeline(test_mode=args.test, limit_per_species=args.limit)
