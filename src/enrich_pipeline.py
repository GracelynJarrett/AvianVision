# enrich_pipeline.py
#
# Purpose: The main enrichment pipeline for AvianVision. For all 525 bird species,
# this script fetches data from three sources (GBIF API, IUCN Red List API, and
# the Avian Diet Database file), loads each source into its own raw table in
# Snowflake, combines them into a single SPECIES_ENRICHMENT table, and then
# stores the final enriched records in MongoDB Atlas.
#
# Run this script once before Phase 4 to pre-populate the enrichment data.
#
# Usage:
#   python src/enrich_pipeline.py

import argparse
import csv
import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

from mongodb_client import get_species_enrichment_collection
from snowflake_client import get_snowflake_connection

# --- Constants ---

# Base URLs for the two external APIs.
GBIF_API_URL = "https://api.gbif.org/v1"
IUCN_API_URL = "https://apiv3.iucnredlist.org/api/v3"

# How long to wait between API calls (in seconds).
# This prevents hitting GBIF and IUCN rate limits when looping through 525 species.
API_DELAY = 0.5

# Path to the Avian Diet Database file, which lives in the project's data folder.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DIET_FILE = PROJECT_ROOT / "data" / "AvianDietDatabase.txt"

# Path to the species mapping file, which has the dataset label and scientific name
# for all 525 bird species.
MAPPING_FILE = PROJECT_ROOT / "data" / "bird_name_mapping.csv"


# --- Section 2: Diet File Parser ---

def load_diet_lookup():
    """Reads the Avian Diet Database txt file and returns a dictionary mapping
    each species' scientific name to a summary of its diet."""

    # This dictionary will hold the final diet summary for every species found
    # in the diet file. The key is the scientific name, the value is a dict
    # with prey items, prey classes, and top prey.
    diet_lookup = {}

    # Open the tab-separated diet file and read it row by row.
    with open(DIET_FILE, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")

        for row in reader:
            sci_name = row["Scientific_Name"].strip()

            # Skip rows where the scientific name is missing.
            if not sci_name or sci_name == "NA":
                continue

            # If this is the first time we've seen this species, create an empty
            # entry for it in the lookup dictionary.
            if sci_name not in diet_lookup:
                diet_lookup[sci_name] = {
                    "prey_common_names": set(),
                    "prey_classes": set(),
                    "prey_with_fraction": [],
                }

            # Add the prey common name to the set (sets automatically remove duplicates).
            prey_name = row["Prey_Common_Name"].strip()
            if prey_name and prey_name != "NA":
                diet_lookup[sci_name]["prey_common_names"].add(prey_name)

            # Add the prey class (broad food category) to the set.
            prey_class = row["Prey_Class"].strip()
            if prey_class and prey_class != "NA":
                diet_lookup[sci_name]["prey_classes"].add(prey_class)

            # Record the prey name and how much of the diet it makes up,
            # so we can calculate the top prey items later.
            try:
                fraction = float(row["Fraction_Diet"])
                if prey_name and prey_name != "NA":
                    diet_lookup[sci_name]["prey_with_fraction"].append({
                        "prey": prey_name,
                        "fraction": fraction,
                    })
            except (ValueError, TypeError):
                # Some rows have a missing or non-numeric fraction — skip those.
                pass

    # Convert the sets to sorted lists and calculate the top 5 prey items
    # by average fraction of diet across all studies.
    for sci_name, data in diet_lookup.items():
        data["prey_common_names"] = sorted(data["prey_common_names"])
        data["prey_classes"] = sorted(data["prey_classes"])

        # Group fractions by prey name and average them across studies.
        prey_totals = {}
        prey_counts = {}
        for entry in data["prey_with_fraction"]:
            p = entry["prey"]
            prey_totals[p] = prey_totals.get(p, 0) + entry["fraction"]
            prey_counts[p] = prey_counts.get(p, 0) + 1

        # Build a list of prey with their average fraction, sorted highest first.
        averaged = [
            {"prey": p, "avg_fraction": round(prey_totals[p] / prey_counts[p], 4)}
            for p in prey_totals
        ]
        averaged.sort(key=lambda x: x["avg_fraction"], reverse=True)

        # Keep only the top 5 prey items.
        data["top_prey"] = averaged[:5]

        # Remove the raw fraction list — we no longer need it.
        del data["prey_with_fraction"]

    print(f"Diet lookup built: {len(diet_lookup)} species found in diet file.")
    return diet_lookup


# --- Section 3: GBIF Fetch Function ---

def fetch_gbif(scientific_name):
    """Calls the GBIF species match API for one species and returns its taxonomy data.
    Returns None if no match is found or the request fails."""

    # Build the request URL — GBIF's species/match endpoint looks up a species
    # by scientific name and returns taxonomy information.
    url = f"{GBIF_API_URL}/species/match"
    params = {"name": scientific_name, "strict": "false"}

    try:
        # Send the request to GBIF. Timeout after 10 seconds to avoid hanging
        # indefinitely if the API is slow.
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        # GBIF returns matchType "NONE" when it cannot find the species.
        # In that case there is no useful data to return.
        if data.get("matchType") == "NONE":
            print(f"  GBIF: no match found for '{scientific_name}'")
            return None

        # Pull out the fields we want to store. Use .get() so that missing
        # fields return None instead of crashing.
        return {
            "gbif_key": data.get("usageKey"),
            "taxonomy_class": data.get("class"),
            "taxonomy_order": data.get("order"),
            "taxonomy_family": data.get("family"),
            "taxonomy_genus": data.get("genus"),
        }

    except requests.exceptions.RequestException as e:
        # Catch any network error (timeout, connection refused, bad status code)
        # and report it without stopping the whole pipeline.
        print(f"  GBIF: request failed for '{scientific_name}': {e}")
        return None


# --- Section 4: IUCN Fetch Function ---

# Maps IUCN two-letter status codes to their full human-readable labels.
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


def fetch_iucn(scientific_name):
    """Calls the IUCN Red List API for one species and returns its conservation status
    and population trend. Returns None if the species is not found or the request fails."""

    # Load the IUCN API token from the environment.
    load_dotenv()
    token = os.getenv("IUCN_API_KEY")

    # Build the request URL — the scientific name goes directly in the path.
    # Spaces are encoded as %20 so the URL is valid.
    encoded_name = scientific_name.replace(" ", "%20")
    url = f"{IUCN_API_URL}/species/{encoded_name}"
    params = {"token": token}

    try:
        # Send the request to the IUCN Red List API.
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        # The API returns results as a list. If the list is empty, the species
        # is not in the IUCN database.
        results = data.get("result", [])
        if not results:
            print(f"  IUCN: no record found for '{scientific_name}'")
            return None

        # Take the first result (there is almost always only one).
        record = results[0]
        status_code = record.get("category")

        # Look up the full label for the status code (e.g. "LC" → "Least Concern").
        status_label = IUCN_STATUS_LABELS.get(status_code, "Unknown")

        return {
            "conservation_status": status_code,
            "conservation_status_label": status_label,
            "population_trend": record.get("population_trend"),
        }

    except requests.exceptions.RequestException as e:
        # Catch any network error and report it without stopping the whole pipeline.
        print(f"  IUCN: request failed for '{scientific_name}': {e}")
        return None


# --- Section 5: Snowflake Load Functions ---

def insert_gbif_row(cur, species_label, scientific_name, gbif_data):
    """Inserts one species' GBIF taxonomy data into the GBIF_RAW table in Snowflake.
    If GBIF returned no data for this species, all taxonomy fields are stored as NULL."""

    # If the GBIF fetch returned None, use an empty dict so all fields become NULL.
    gbif_data = gbif_data or {}

    cur.execute(
        """
        INSERT INTO GBIF_RAW
            (SPECIES_LABEL, SCIENTIFIC_NAME, GBIF_KEY,
             TAXONOMY_CLASS, TAXONOMY_ORDER, TAXONOMY_FAMILY, TAXONOMY_GENUS)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (
            species_label,
            scientific_name,
            gbif_data.get("gbif_key"),
            gbif_data.get("taxonomy_class"),
            gbif_data.get("taxonomy_order"),
            gbif_data.get("taxonomy_family"),
            gbif_data.get("taxonomy_genus"),
        ),
    )


def insert_iucn_row(cur, scientific_name, iucn_data):
    """Inserts one species' IUCN conservation data into the IUCN_RAW table in Snowflake.
    If IUCN returned no data for this species, all fields are stored as NULL."""

    # If the IUCN fetch returned None, use an empty dict so all fields become NULL.
    iucn_data = iucn_data or {}

    cur.execute(
        """
        INSERT INTO IUCN_RAW
            (SCIENTIFIC_NAME, CONSERVATION_STATUS,
             CONSERVATION_STATUS_LABEL, POPULATION_TREND)
        VALUES (%s, %s, %s, %s)
        """,
        (
            scientific_name,
            iucn_data.get("conservation_status"),
            iucn_data.get("conservation_status_label"),
            iucn_data.get("population_trend"),
        ),
    )


def insert_diet_row(cur, scientific_name, diet_data):
    """Inserts one species' diet data into the DIET_RAW table in Snowflake.
    The three list fields are stored as JSON using Snowflake's VARIANT type.
    If no diet data exists for this species, all fields are stored as NULL."""

    if diet_data:
        # Convert Python lists to JSON strings so Snowflake can store them
        # as VARIANT (JSON) columns using PARSE_JSON().
        prey_names_json = json.dumps(diet_data["prey_common_names"])
        prey_classes_json = json.dumps(diet_data["prey_classes"])
        top_prey_json = json.dumps(diet_data["top_prey"])

        cur.execute(
            """
            INSERT INTO DIET_RAW
                (SCIENTIFIC_NAME, PREY_COMMON_NAMES, PREY_CLASSES, TOP_PREY)
            VALUES (%s, PARSE_JSON(%s), PARSE_JSON(%s), PARSE_JSON(%s))
            """,
            (scientific_name, prey_names_json, prey_classes_json, top_prey_json),
        )
    else:
        # No diet data found — insert a row with NULLs so the JOIN in Section 6
        # still includes this species in the final SPECIES_ENRICHMENT table.
        cur.execute(
            """
            INSERT INTO DIET_RAW
                (SCIENTIFIC_NAME, PREY_COMMON_NAMES, PREY_CLASSES, TOP_PREY)
            VALUES (%s, NULL, NULL, NULL)
            """,
            (scientific_name,),
        )


# --- Section 6: Snowflake Combine Function ---

def combine_in_snowflake(conn):
    """Joins the three raw Snowflake tables (GBIF_RAW, IUCN_RAW, DIET_RAW) into one
    unified SPECIES_ENRICHMENT table. Any existing rows in SPECIES_ENRICHMENT are
    cleared first so the pipeline can be safely re-run without creating duplicates."""

    cur = conn.cursor()

    # Clear the table before inserting so re-running the pipeline stays safe.
    # TRUNCATE removes all rows instantly without logging individual deletes.
    print("Clearing SPECIES_ENRICHMENT table...")
    cur.execute("TRUNCATE TABLE SPECIES_ENRICHMENT")

    # Join all three raw tables on scientific name and insert the combined result
    # into SPECIES_ENRICHMENT. LEFT JOINs are used so that every species from
    # GBIF_RAW appears in the output even if IUCN or diet data is missing.
    print("Combining raw tables into SPECIES_ENRICHMENT...")
    cur.execute(
        """
        INSERT INTO SPECIES_ENRICHMENT (
            SPECIES_LABEL, SCIENTIFIC_NAME,
            GBIF_KEY, TAXONOMY_CLASS, TAXONOMY_ORDER, TAXONOMY_FAMILY, TAXONOMY_GENUS,
            CONSERVATION_STATUS, CONSERVATION_STATUS_LABEL, POPULATION_TREND,
            PREY_COMMON_NAMES, PREY_CLASSES, TOP_PREY
        )
        SELECT
            g.SPECIES_LABEL,
            g.SCIENTIFIC_NAME,
            g.GBIF_KEY,
            g.TAXONOMY_CLASS,
            g.TAXONOMY_ORDER,
            g.TAXONOMY_FAMILY,
            g.TAXONOMY_GENUS,
            i.CONSERVATION_STATUS,
            i.CONSERVATION_STATUS_LABEL,
            i.POPULATION_TREND,
            PARSE_JSON(d.PREY_COMMON_NAMES),
            d.PREY_CLASSES,
            d.TOP_PREY
        FROM GBIF_RAW g
        LEFT JOIN IUCN_RAW i ON g.SCIENTIFIC_NAME = i.SCIENTIFIC_NAME
        LEFT JOIN DIET_RAW d ON g.SCIENTIFIC_NAME = d.SCIENTIFIC_NAME
        """
    )

    # Report how many species ended up in the combined table.
    cur.execute("SELECT COUNT(*) FROM SPECIES_ENRICHMENT")
    row_count = cur.fetchone()[0]
    print(f"SPECIES_ENRICHMENT populated: {row_count} species rows inserted.")


# --- Section 7: MongoDB Load Function ---

def _parse_variant(value):
    """Converts a Snowflake VARIANT column value into a Python object.
    Snowflake returns VARIANT columns as JSON strings, so this function
    parses them back into Python lists or dicts. Returns None if empty."""

    # If the value is None (species had no data), return None as-is.
    if value is None:
        return None

    # If it came back as a string, parse it as JSON.
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return None

    # If Snowflake already returned it as a Python object, use it directly.
    return value


def load_to_mongodb(conn):
    """Reads every row from the SPECIES_ENRICHMENT table in Snowflake and writes
    each one as a structured document into MongoDB's species_enrichment collection."""

    # Connect to the MongoDB collection where enrichment data will be stored.
    collection = get_species_enrichment_collection()

    # Clear any existing documents so the pipeline can be safely re-run
    # without creating duplicate records.
    print("Clearing MongoDB species_enrichment collection...")
    collection.delete_many({})

    # Fetch every row from the combined Snowflake table.
    cur = conn.cursor()
    cur.execute("SELECT * FROM SPECIES_ENRICHMENT")

    # Use the cursor's column descriptions to get the column names so we can
    # build a dictionary from each row instead of referencing by position.
    columns = [col[0].lower() for col in cur.description]
    rows = cur.fetchall()

    # Build a MongoDB document for each species row.
    documents = []
    for row in rows:
        record = dict(zip(columns, row))

        # Nest related fields into sub-documents so the structure is clean
        # and easy to read in MongoDB Atlas.
        doc = {
            "species_label": record["species_label"],
            "scientific_name": record["scientific_name"],
            "gbif_key": record["gbif_key"],
            "taxonomy": {
                "class": record["taxonomy_class"],
                "order": record["taxonomy_order"],
                "family": record["taxonomy_family"],
                "genus": record["taxonomy_genus"],
            },
            "conservation": {
                "status": record["conservation_status"],
                "status_label": record["conservation_status_label"],
                "population_trend": record["population_trend"],
            },
            "diet": {
                "prey_common_names": _parse_variant(record["prey_common_names"]),
                "prey_classes": _parse_variant(record["prey_classes"]),
                "top_prey": _parse_variant(record["top_prey"]),
            },
        }
        documents.append(doc)

    # Insert all documents into MongoDB in a single batch operation.
    # insert_many is much faster than inserting one at a time for 525 documents.
    if documents:
        collection.insert_many(documents)
        print(f"MongoDB loaded: {len(documents)} species documents inserted.")
    else:
        print("No documents to insert — SPECIES_ENRICHMENT appears to be empty.")


# --- Section 8: Main Orchestration Function ---

def run_pipeline(test_mode=False):
    """Runs the full enrichment pipeline from start to finish.
    Fetches data from GBIF, IUCN, and the diet file for all 525 species,
    loads the raw data into Snowflake, combines it into one table, and
    stores the final result in MongoDB.
    If test_mode is True, only the first 3 species are processed."""

    # Load environment variables from .env so all credentials are available.
    load_dotenv()

    # --- Step 1: Load the diet lookup table from the local file ---
    # This reads the entire diet file once and builds a fast in-memory lookup
    # so we are not re-reading the file for every species.
    print("=== Step 1: Loading diet lookup ===")
    diet_lookup = load_diet_lookup()

    # --- Step 2: Read all 525 species from bird_name_mapping.csv ---
    print("\n=== Step 2: Reading species list ===")
    species_list = []
    with open(MAPPING_FILE, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sci_name = row["scientific_name"].strip()
            label = row["dataset_label"].strip()

            # Skip any row with a missing scientific name (e.g. RED BELLIED PITTA).
            if not sci_name:
                print(f"  Skipping '{label}' — no scientific name in mapping file.")
                continue
            species_list.append({"label": label, "scientific_name": sci_name})

    # In test mode, only process the first 3 species so issues can be caught quickly.
    if test_mode:
        species_list = species_list[:3]
        print(f"TEST MODE — processing {len(species_list)} species only.")
    else:
        print(f"{len(species_list)} species loaded from mapping file.")

    # --- Step 3: Connect to Snowflake and clear the raw tables ---
    # Truncating the raw tables before the loop means the pipeline can be
    # safely re-run without creating duplicate rows.
    print("\n=== Step 3: Connecting to Snowflake ===")
    conn = get_snowflake_connection()
    cur = conn.cursor()
    print("Clearing raw tables...")
    cur.execute("TRUNCATE TABLE GBIF_RAW")
    cur.execute("TRUNCATE TABLE IUCN_RAW")
    cur.execute("TRUNCATE TABLE DIET_RAW")

    # --- Step 4: Fetch and insert data for every species ---
    print("\n=== Step 4: Fetching and loading species data ===")
    total = len(species_list)

    for i, species in enumerate(species_list, start=1):
        label = species["label"]
        sci_name = species["scientific_name"]
        print(f"[{i}/{total}] {label} ({sci_name})")

        # Fetch from GBIF and IUCN APIs.
        gbif_data = fetch_gbif(sci_name)
        iucn_data = fetch_iucn(sci_name)

        # Look up diet data from the pre-loaded dictionary.
        # Returns None if this species is not in the diet file.
        diet_data = diet_lookup.get(sci_name)

        # Insert each piece of data into its raw Snowflake table.
        insert_gbif_row(cur, label, sci_name, gbif_data)
        insert_iucn_row(cur, sci_name, iucn_data)
        insert_diet_row(cur, sci_name, diet_data)

        # Pause briefly between species to respect API rate limits.
        time.sleep(API_DELAY)

    # --- Step 5: Combine the three raw tables into SPECIES_ENRICHMENT ---
    print("\n=== Step 5: Combining tables in Snowflake ===")
    combine_in_snowflake(conn)

    # --- Step 6: Load the combined data into MongoDB ---
    print("\n=== Step 6: Loading into MongoDB ===")
    load_to_mongodb(conn)

    # --- Done ---
    conn.close()
    print("\n=== Pipeline complete! ===")


# Run the pipeline when this file is executed directly.
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run the AvianVision enrichment pipeline."
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run in test mode — processes only the first 3 species.",
    )
    args = parser.parse_args()
    run_pipeline(test_mode=args.test)
