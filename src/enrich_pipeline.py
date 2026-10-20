# enrich_pipeline.py
#
# Purpose: The main enrichment pipeline for AvianVision. For all 525 bird species,
# this script fetches data from five sources (GBIF taxonomy API, GBIF occurrence API,
# IUCN Red List API v4, Avian Diet Database file, and Wikipedia API), loads each
# source into Snowflake, combines them into a single SPECIES_ENRICHMENT table, and
# then stores the final enriched records in MongoDB Atlas.
#
# Run this script once before Phase 4 to pre-populate the enrichment data.
#
# Usage:
#   python src/enrich_pipeline.py          # full run (all 525 species)
#   python src/enrich_pipeline.py --test   # test run (first 10 species only)

import argparse
import csv
import json
import os
import time
from collections import Counter
from pathlib import Path

import requests
from dotenv import load_dotenv

from mongodb_client import get_species_enrichment_collection
from snowflake_client import get_snowflake_connection

# --- Constants ---

# Base URLs for the external APIs.
GBIF_API_URL = "https://api.gbif.org/v1"
IUCN_API_URL = "https://api.iucnredlist.org/api/v4"
WIKI_API_URL = "https://en.wikipedia.org/w/api.php"
WIKI_REST_URL = "https://en.wikipedia.org/api/rest_v1"

# How long to wait between species (in seconds) to avoid hitting API rate limits.
API_DELAY = 0.5

# Wikipedia blocks requests that do not include a descriptive User-Agent header.
# This header identifies the project so Wikipedia knows who is making the requests.
WIKI_HEADERS = {
    "User-Agent": "AvianVision/1.0 (neumont capstone project; gjarrett@student.neumont.edu)"
}

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


# --- Section 3: GBIF Fetch Functions ---

def fetch_gbif(scientific_name):
    """Calls the GBIF API for one species and returns taxonomy data plus a summary
    of where and when the species has been observed (used for migration patterns).

    Makes two API calls:
      1. species/match — gets the classification (class, order, family, genus) and
         the GBIF species key needed for the second call.
      2. occurrence/search — fetches up to 300 sighting records and summarises them
         by country and calendar month.

    Returns None if no species match is found or the first request fails.
    If only the second call fails, taxonomy data is still returned."""

    # --- Step 1: Taxonomy lookup ---
    # GBIF's species/match endpoint takes a scientific name and returns classification data.
    url = f"{GBIF_API_URL}/species/match"
    params = {"name": scientific_name, "strict": "false"}

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        # GBIF returns matchType "NONE" when it cannot find the species.
        if data.get("matchType") == "NONE":
            print(f"  GBIF: no match found for '{scientific_name}'")
            return None

        gbif_key = data.get("usageKey")

        # Build the result dictionary with taxonomy fields and placeholder
        # occurrence fields that will be filled in by Step 2.
        result = {
            "gbif_key": gbif_key,
            "taxonomy_class": data.get("class"),
            "taxonomy_order": data.get("order"),
            "taxonomy_family": data.get("family"),
            "taxonomy_genus": data.get("genus"),
            "total_sightings": None,
            "top_countries": None,
            "monthly_sightings": None,
            "occurrences": []
            }

    except requests.exceptions.RequestException as e:
        print(f"  GBIF taxonomy: request failed for '{scientific_name}': {e}")
        return None

    # --- Step 2: Occurrence data (seasonal range / migration) ---
    # Only run if we got a valid species key from Step 1.
    if gbif_key:
        try:
            occ_url = f"{GBIF_API_URL}/occurrence/search"
            all_records = []

            offset = 0
            page_size = 300

            while len(all_records) < 2500:

                occ_params = {
                    "speciesKey": gbif_key,
                    "limit": page_size,
                    "offset": offset,
                    "hasCoordinate": True,
                    "hasGeospatialIssue": False,
                }

                occ_response = requests.get(
                    occ_url,
                    params=occ_params,
                    timeout=15
                )

                occ_response.raise_for_status()

                occ_data = occ_response.json()

                page_records = occ_data.get("results", [])

                if not page_records:
                    break

                all_records.extend(page_records)

                offset += page_size

            records = all_records[:2500]

            total = occ_data.get("count", 0)

            if records:
                # Count how many sightings were recorded in each country and each month.
                country_counts = Counter()
                month_counts = Counter()

                occurrence_records = []
                for rec in records:
                    occurrence_records.append({
                        "occurrence_id": rec.get("key"),
                        "gbif_key": gbif_key,
                        "species_label": None,
                        "scientific_name": scientific_name,
                        "decimal_latitude": rec.get("decimalLatitude"),
                        "decimal_longitude": rec.get("decimalLongitude"),
                        "country_code": rec.get("countryCode"),
                        "state_province": rec.get("stateProvince"),
                        "event_date": rec.get("eventDate"),
                        "year": rec.get("year"),
                        "month": rec.get("month"),
                        "basis_of_record": rec.get("basisOfRecord")
                        })
                    country = rec.get("countryCode")
                    month = rec.get("month")
                    if country:
                        country_counts[country] += 1
                    if month:
                        month_counts[int(month)] += 1
                    

                # Store the total number of GBIF records (not just the 300 we fetched).
                result["total_sightings"] = total

                # Keep the top 5 countries by sighting count.
                result["top_countries"] = [c for c, _ in country_counts.most_common(5)]

                # Store counts for all 12 months so charts can show the full year.
                result["monthly_sightings"] = {
                    str(m): month_counts.get(m, 0) for m in range(1, 13)
                }
                
                result["occurrences"] = occurrence_records

        except requests.exceptions.RequestException as e:
            # Taxonomy data is still valid even if the occurrence call fails.
            print(f"  GBIF occurrences: request failed for '{scientific_name}': {e}")

    return result


# --- Section 4: IUCN Fetch Function ---

# Maps IUCN two-letter status codes to their full human-readable labels.
# Used as a fallback if the API does not return a label directly.
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
    """Calls the IUCN Red List API v4 for one species and returns its conservation
    status, population trend, and movement pattern (migratory behaviour).

    Makes two API calls:
      1. taxa/scientific_name — finds the latest assessment ID and category code.
      2. assessment/{id} — fetches the full assessment details, including population
         trend (e.g. 'Stable', 'Decreasing') and movement patterns (e.g. 'Full Migrant',
         'Resident').

    Returns None if the species is not found in IUCN or the first request fails.
    If only the second call fails, it returns what Step 1 found with nulls for the rest."""

    # Load the IUCN API token from the .env file.
    load_dotenv()
    token = os.getenv("IUCN_API_KEY")

    # Split the scientific name into genus and species for the v4 query parameters.
    parts = scientific_name.strip().split()
    if len(parts) < 2:
        print(f"  IUCN: cannot parse scientific name '{scientific_name}'")
        return None

    headers = {"Authorization": f"Bearer {token}"}

    # --- Step 1: Find the latest assessment ID and category code ---
    # The taxa endpoint returns a list of all assessments for this species.
    # We look for the one marked latest=True to get the current status.
    url = f"{IUCN_API_URL}/taxa/scientific_name"
    params = {"genus_name": parts[0], "species_name": parts[1], "token": token}

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        # Scan the assessments list for the most recent entry.
        assessment_id = None
        status_code = None
        for assessment in data.get("assessments", []):
            if assessment.get("latest"):
                assessment_id = assessment.get("assessment_id")
                status_code = assessment.get("red_list_category_code")
                break

        if not assessment_id:
            print(f"  IUCN: no current assessment found for '{scientific_name}'")
            return None

    except requests.exceptions.RequestException as e:
        print(f"  IUCN step 1: request failed for '{scientific_name}': {e}")
        return None

    # --- Step 2: Fetch full assessment details ---
    # The assessment endpoint returns the complete assessment record, which includes
    # population trend and movement patterns that are not in the Step 1 response.
    detail_url = f"{IUCN_API_URL}/assessment/{assessment_id}"

    try:
        detail_response = requests.get(
            detail_url, headers=headers, params={"token": token}, timeout=10
        )
        detail_response.raise_for_status()
        detail = detail_response.json()

        # Population trend is a nested object — pull out the English description.
        pop_trend_obj = detail.get("population_trend") or {}
        if isinstance(pop_trend_obj, dict):
            population_trend = pop_trend_obj.get("description", {}).get("en")
        else:
            population_trend = pop_trend_obj

        # The full Red List category label is also in the detail response.
        # Fall back to our lookup table if the API does not include it.
        category_obj = detail.get("red_list_category") or {}
        if isinstance(category_obj, dict):
            status_label = category_obj.get("description", {}).get("en")
        else:
            status_label = None
        if not status_label:
            status_label = IUCN_STATUS_LABELS.get(status_code)

        # Movement patterns (e.g. "Full Migrant", "Resident") live in the
        # supplementary_info block of the full assessment.
        supp = detail.get("supplementary_info") or {}
        movement_patterns = supp.get("movement_patterns")

        return {
            "conservation_status": status_code,
            "conservation_status_label": status_label,
            "population_trend": population_trend,
            "movement_patterns": movement_patterns,
        }

    except requests.exceptions.RequestException as e:
        # Step 2 failed — return what we know from Step 1 with nulls for detail fields.
        print(f"  IUCN step 2: request failed for '{scientific_name}': {e}")
        return {
            "conservation_status": status_code,
            "conservation_status_label": IUCN_STATUS_LABELS.get(status_code),
            "population_trend": None,
            "movement_patterns": None,
        }


# --- Section 5: Wikipedia Fetch Function ---

def fetch_wikipedia(scientific_name):
    """Searches Wikipedia by scientific name and returns a description, intro paragraph,
    and a dictionary of article sections (e.g. Description, Habitat, Breeding).

    Makes three API calls:
      1. MediaWiki query/search — finds the most relevant Wikipedia article title.
      2. REST page/summary — fetches the one-line description and intro paragraph.
      3. MediaWiki query/extracts — fetches the full article as plain text, which is
         then parsed into individual sections.

    Returns None if no article is found or the first two requests both fail.
    If only the section fetch fails, title/description/extract are still returned."""

    # --- Step 1: Search for the article by scientific name ---
    # Wikipedia's search API returns the most relevant articles for a given query.
    search_params = {
        "action": "query",
        "list": "search",
        "srsearch": scientific_name,
        "srlimit": 1,     # we only need the single best result
        "format": "json",
    }

    try:
        search_response = requests.get(
            WIKI_API_URL, params=search_params, headers=WIKI_HEADERS, timeout=10
        )
        search_response.raise_for_status()
        search_data = search_response.json()

        search_hits = search_data.get("query", {}).get("search", [])
        if not search_hits:
            print(f"  Wikipedia: no article found for '{scientific_name}'")
            return None

        wiki_title = search_hits[0]["title"]

    except requests.exceptions.RequestException as e:
        print(f"  Wikipedia search: request failed for '{scientific_name}': {e}")
        return None

    # --- Step 2: Fetch the article summary ---
    # The REST summary endpoint returns a plain-text description and intro paragraph.
    # Wikipedia article titles use underscores in URLs, so we replace spaces.
    url_title = wiki_title.replace(" ", "_")
    summary_url = f"{WIKI_REST_URL}/page/summary/{url_title}"

    try:
        summary_response = requests.get(
            summary_url, headers=WIKI_HEADERS, timeout=10
        )
        summary_response.raise_for_status()
        summary = summary_response.json()

        description = summary.get("description")
        extract = summary.get("extract")

    except requests.exceptions.RequestException as e:
        print(f"  Wikipedia summary: request failed for '{scientific_name}': {e}")
        return None

    # --- Step 3: Fetch the full article text to extract individual sections ---
    # The extracts API returns the complete article as plain text with section headers
    # in the format == Section Name ==. We parse these to build a sections dictionary
    # so the dashboard can display specific biology sections (description, habitat, etc.).
    wiki_sections = {}
    try:
        extract_params = {
            "action": "query",
            "prop": "extracts",
            "titles": wiki_title,
            "explaintext": 1,        # return plain text, not HTML
            "exsectionformat": "wiki", # use == Section == style headers
            "format": "json",
        }
        extract_response = requests.get(
            WIKI_API_URL, params=extract_params, headers=WIKI_HEADERS, timeout=15
        )
        extract_response.raise_for_status()
        extract_data = extract_response.json()

        # The pages dict uses the Wikipedia page ID as its key.
        # We get the first (and only) page returned.
        pages = extract_data.get("query", {}).get("pages", {})
        page = next(iter(pages.values()), {})
        full_text = page.get("extract", "")

        if full_text:
            # Split on '\n== ' to find only top-level section headers (== Section ==).
            # This avoids matching subsection headers (=== Sub ===).
            section_chunks = full_text.split('\n== ')

            # These standard Wikipedia sections contain no useful biology content.
            skip_sections = {
                "references", "further reading", "external links",
                "see also", "notes", "footnotes", "bibliography",
            }

            # Each chunk after the first starts with "Section Name ==\ncontent...".
            for chunk in section_chunks[1:]:
                if ' ==' not in chunk:
                    continue

                # The section name is everything before the first ' =='.
                header_end = chunk.index(' ==')
                section_name = chunk[:header_end].strip()

                # The section content starts on the line after the closing ==.
                content_start = chunk.index('\n') + 1 if '\n' in chunk else len(chunk)
                content = chunk[content_start:].strip()

                # Only store sections that have content and are not boilerplate.
                if section_name.lower() not in skip_sections and content:
                    wiki_sections[section_name] = content

    except requests.exceptions.RequestException as e:
        # Section fetch failed — we still return title, description, and extract.
        print(f"  Wikipedia sections: request failed for '{scientific_name}': {e}")

    return {
        "wiki_title": wiki_title,
        "wiki_description": description,
        "wiki_extract": extract,
        "wiki_sections": wiki_sections if wiki_sections else None,
    }


# --- Section 6: Snowflake Load Functions ---

def insert_gbif_row(cur, species_label, scientific_name, gbif_data):
    """Inserts one species' GBIF data into GBIF_RAW in Snowflake.
    Stores taxonomy fields (class, order, family, genus) and occurrence fields
    (total sightings, top countries, monthly breakdown) for migration analysis.
    If GBIF returned no data, all fields are stored as NULL."""

    # If the GBIF fetch returned None, use an empty dict so all fields become NULL.
    gbif_data = gbif_data or {}

    # Convert the top_countries list and monthly_sightings dict to JSON strings
    # before passing them to Snowflake's PARSE_JSON() function, which expects a string.
    top_countries = gbif_data.get("top_countries")
    monthly_sightings = gbif_data.get("monthly_sightings")
    top_countries_json = json.dumps(top_countries) if top_countries is not None else None
    monthly_sightings_json = json.dumps(monthly_sightings) if monthly_sightings is not None else None

    # Use SELECT instead of VALUES so we can call PARSE_JSON() on the VARIANT columns.
    cur.execute(
        """
        INSERT INTO GBIF_RAW
            (SPECIES_LABEL, SCIENTIFIC_NAME, GBIF_KEY,
             TAXONOMY_CLASS, TAXONOMY_ORDER, TAXONOMY_FAMILY, TAXONOMY_GENUS,
             TOTAL_SIGHTINGS, TOP_COUNTRIES, MONTHLY_SIGHTINGS)
        SELECT %s, %s, %s, %s, %s, %s, %s, %s,
               CASE WHEN %s IS NOT NULL THEN PARSE_JSON(%s) ELSE NULL END,
               CASE WHEN %s IS NOT NULL THEN PARSE_JSON(%s) ELSE NULL END
        """,
        (
            species_label,
            scientific_name,
            gbif_data.get("gbif_key"),
            gbif_data.get("taxonomy_class"),
            gbif_data.get("taxonomy_order"),
            gbif_data.get("taxonomy_family"),
            gbif_data.get("taxonomy_genus"),
            gbif_data.get("total_sightings"),
            top_countries_json, top_countries_json,
            monthly_sightings_json, monthly_sightings_json,
        ),
    )


def insert_iucn_row(cur, scientific_name, iucn_data):
    """Inserts one species' IUCN conservation data into IUCN_RAW in Snowflake.
    Stores conservation status, population trend, and movement patterns.
    If IUCN returned no data for this species, all fields are stored as NULL."""

    # If the IUCN fetch returned None, use an empty dict so all fields become NULL.
    iucn_data = iucn_data or {}

    cur.execute(
        """
        INSERT INTO IUCN_RAW
            (SCIENTIFIC_NAME, CONSERVATION_STATUS,
             CONSERVATION_STATUS_LABEL, POPULATION_TREND, MOVEMENT_PATTERNS)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            scientific_name,
            iucn_data.get("conservation_status"),
            iucn_data.get("conservation_status_label"),
            iucn_data.get("population_trend"),
            iucn_data.get("movement_patterns"),
        ),
    )


def insert_diet_row(cur, scientific_name, diet_data):
    """Inserts one species' diet data into the DIET_RAW table in Snowflake.
    The three list fields are stored as JSON using Snowflake's VARIANT type.
    If no diet data exists for this species, all fields are stored as NULL."""

    if diet_data:
        # Convert each list to a JSON string, but use None if the list is empty.
        # Snowflake rejects PARSE_JSON('[]') in a VALUES clause, so we store NULL
        # instead of an empty array — NULL means "no data" which is clearer anyway.
        prey_names = diet_data["prey_common_names"]
        prey_classes = diet_data["prey_classes"]
        top_prey = diet_data["top_prey"]

        prey_names_json = json.dumps(prey_names) if prey_names else None
        prey_classes_json = json.dumps(prey_classes) if prey_classes else None
        top_prey_json = json.dumps(top_prey) if top_prey else None

        # Use SELECT instead of VALUES so PARSE_JSON() can be called on non-NULL fields.
        cur.execute(
            """
            INSERT INTO DIET_RAW
                (SCIENTIFIC_NAME, PREY_COMMON_NAMES, PREY_CLASSES, TOP_PREY)
            SELECT %s,
                   CASE WHEN %s IS NOT NULL THEN PARSE_JSON(%s) ELSE NULL END,
                   CASE WHEN %s IS NOT NULL THEN PARSE_JSON(%s) ELSE NULL END,
                   CASE WHEN %s IS NOT NULL THEN PARSE_JSON(%s) ELSE NULL END
            """,
            (
                scientific_name,
                prey_names_json, prey_names_json,
                prey_classes_json, prey_classes_json,
                top_prey_json, top_prey_json,
            ),
        )
    else:
        # No diet data found — insert a row with NULLs so the JOIN in Section 7
        # still includes this species in the final SPECIES_ENRICHMENT table.
        cur.execute(
            """
            INSERT INTO DIET_RAW
                (SCIENTIFIC_NAME, PREY_COMMON_NAMES, PREY_CLASSES, TOP_PREY)
            VALUES (%s, NULL, NULL, NULL)
            """,
            (scientific_name,),
        )


def insert_wiki_row(cur, scientific_name, wiki_data):
    """Inserts one species' Wikipedia data into the WIKI_RAW table in Snowflake.
    Stores the article title, one-line description, intro paragraph, and a dictionary
    of article sections (e.g. Description, Habitat, Breeding).
    If Wikipedia returned no data for this species, all fields are stored as NULL."""

    # If the Wikipedia fetch returned None, use an empty dict so all fields become NULL.
    wiki_data = wiki_data or {}

    # Convert the sections dictionary to a JSON string before passing to PARSE_JSON().
    wiki_sections = wiki_data.get("wiki_sections")
    wiki_sections_json = json.dumps(wiki_sections) if wiki_sections is not None else None

    # Use SELECT instead of VALUES so PARSE_JSON() can be called on the VARIANT column.
    cur.execute(
        """
        INSERT INTO WIKI_RAW
            (SCIENTIFIC_NAME, WIKI_TITLE, WIKI_DESCRIPTION, WIKI_EXTRACT, WIKI_SECTIONS)
        SELECT %s, %s, %s, %s,
               CASE WHEN %s IS NOT NULL THEN PARSE_JSON(%s) ELSE NULL END
        """,
        (
            scientific_name,
            wiki_data.get("wiki_title"),
            wiki_data.get("wiki_description"),
            wiki_data.get("wiki_extract"),
            wiki_sections_json, wiki_sections_json,
        ),
    )


def insert_gbif_occurrences(cur, occurrence_records):
    """Insert occurrence records into GBIF_OCCURRENCES."""

    if not occurrence_records:
        return

    insert_sql = """
        INSERT INTO GBIF_OCCURRENCES (
            OCCURRENCE_ID,
            GBIF_KEY,
            SPECIES_LABEL,
            SCIENTIFIC_NAME,
            DECIMAL_LATITUDE,
            DECIMAL_LONGITUDE,
            COUNTRY_CODE,
            STATE_PROVINCE,
            EVENT_DATE,
            YEAR,
            MONTH,
            BASIS_OF_RECORD
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    rows = [
        (
            r["occurrence_id"],
            r["gbif_key"],
            r["species_label"],
            r["scientific_name"],
            r["decimal_latitude"],
            r["decimal_longitude"],
            r["country_code"],
            r["state_province"],
            r["event_date"],
            r["year"],
            r["month"],
            r["basis_of_record"],
        )
        for r in occurrence_records
    ]

    cur.executemany(insert_sql, rows)






# --- Section 7: Snowflake Combine Function ---

def combine_in_snowflake(conn):
    """Joins all four raw Snowflake tables (GBIF_RAW, IUCN_RAW, DIET_RAW, WIKI_RAW)
    into one unified SPECIES_ENRICHMENT table. Any existing rows in SPECIES_ENRICHMENT
    are cleared first so the pipeline can be safely re-run without creating duplicates."""

    cur = conn.cursor()

    # Clear the table before inserting so re-running the pipeline stays safe.
    print("Clearing SPECIES_ENRICHMENT table...")
    cur.execute("TRUNCATE TABLE SPECIES_ENRICHMENT")

    # Join all four raw tables on scientific name and insert the combined result.
    # LEFT JOINs are used so every species from GBIF_RAW appears in the output
    # even if IUCN, diet, or Wikipedia data is missing for that species.
    print("Combining raw tables into SPECIES_ENRICHMENT...")
    cur.execute(
        """
        INSERT INTO SPECIES_ENRICHMENT (
            SPECIES_LABEL, SCIENTIFIC_NAME,
            GBIF_KEY, TAXONOMY_CLASS, TAXONOMY_ORDER, TAXONOMY_FAMILY, TAXONOMY_GENUS,
            CONSERVATION_STATUS, CONSERVATION_STATUS_LABEL, POPULATION_TREND,
            MOVEMENT_PATTERNS,
            PREY_COMMON_NAMES, PREY_CLASSES, TOP_PREY,
            TOTAL_SIGHTINGS, TOP_COUNTRIES, MONTHLY_SIGHTINGS,
            WIKI_TITLE, WIKI_DESCRIPTION, WIKI_EXTRACT, WIKI_SECTIONS
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
            i.MOVEMENT_PATTERNS,
            PARSE_JSON(d.PREY_COMMON_NAMES),
            d.PREY_CLASSES,
            d.TOP_PREY,
            g.TOTAL_SIGHTINGS,
            g.TOP_COUNTRIES,
            g.MONTHLY_SIGHTINGS,
            w.WIKI_TITLE,
            w.WIKI_DESCRIPTION,
            w.WIKI_EXTRACT,
            w.WIKI_SECTIONS
        FROM GBIF_RAW g
        LEFT JOIN IUCN_RAW i ON g.SCIENTIFIC_NAME = i.SCIENTIFIC_NAME
        LEFT JOIN DIET_RAW d ON g.SCIENTIFIC_NAME = d.SCIENTIFIC_NAME
        LEFT JOIN WIKI_RAW w ON g.SCIENTIFIC_NAME = w.SCIENTIFIC_NAME
        """
    )

    # Report how many species ended up in the combined table.
    cur.execute("SELECT COUNT(*) FROM SPECIES_ENRICHMENT")
    row_count = cur.fetchone()[0]
    print(f"SPECIES_ENRICHMENT populated: {row_count} species rows inserted.")


# --- Section 8: MongoDB Load Function ---

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
    # build a dictionary from each row instead of referencing columns by position.
    columns = [col[0].lower() for col in cur.description]
    rows = cur.fetchall()

    # Build a MongoDB document for each species row.
    documents = []
    for row in rows:
        record = dict(zip(columns, row))

        # Nest related fields into sub-documents so the structure is clean and
        # easy to navigate in MongoDB Atlas and in the FastAPI /predict endpoint.
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
                "movement_patterns": record["movement_patterns"],
            },
            "diet": {
                "prey_common_names": _parse_variant(record["prey_common_names"]),
                "prey_classes": _parse_variant(record["prey_classes"]),
                "top_prey": _parse_variant(record["top_prey"]),
            },
            "migration": {
                # Total sightings is an integer so no parsing needed.
                "total_sightings": record["total_sightings"],
                # Top countries and monthly sightings are stored as VARIANT in Snowflake.
                "top_countries": _parse_variant(record["top_countries"]),
                "monthly_sightings": _parse_variant(record["monthly_sightings"]),
            },
            "wikipedia": {
                "title": record["wiki_title"],
                "description": record["wiki_description"],
                "extract": record["wiki_extract"],
                "sections": _parse_variant(record["wiki_sections"]),
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


# --- Section 9: Main Orchestration Function ---

def run_pipeline(test_mode=False):
    """Runs the full enrichment pipeline from start to finish.
    Fetches data from GBIF (taxonomy + occurrences), IUCN Red List (two-step),
    Wikipedia, and the Avian Diet Database for all 525 species. Loads the raw data
    into Snowflake, combines it into one table, and stores the final result in MongoDB.
    If test_mode is True, only the first 10 species are processed."""

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

    # In test mode, only process the first 10 species so issues can be caught quickly.
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
    cur.execute("TRUNCATE TABLE WIKI_RAW")

    # --- Step 4: Fetch and insert data for every species ---
    print("\n=== Step 4: Fetching and loading species data ===")
    total = len(species_list)

    for i, species in enumerate(species_list, start=1):
        label = species["label"]
        sci_name = species["scientific_name"]
        print(f"[{i}/{total}] {label} ({sci_name})")

        # Fetch from all external sources.
        # GBIF makes two calls: taxonomy + occurrences.
        # IUCN makes two calls: assessment list + full assessment detail.
        # Wikipedia makes two calls: search + summary.
        # Diet data comes from the pre-loaded local file (no API call).
        gbif_data = fetch_gbif(sci_name)
        if gbif_data and gbif_data.get("occurrences"):
            for occ in gbif_data["occurrences"]: 
                occ["species_label"] = label
        iucn_data = fetch_iucn(sci_name)
        wiki_data = fetch_wikipedia(sci_name)
        diet_data = diet_lookup.get(sci_name)

        # Insert each piece of data into its raw Snowflake table.
        insert_gbif_row(cur, label, sci_name, gbif_data)
        if gbif_data:
            insert_gbif_occurrences(
                cur,
                gbif_data.get("occurrences", [])
            )
        insert_iucn_row(cur, sci_name, iucn_data)
        insert_diet_row(cur, sci_name, diet_data)
        insert_wiki_row(cur, sci_name, wiki_data)

        # Pause briefly between species to be polite to the APIs.
        time.sleep(API_DELAY)

    # --- Step 5: Combine the four raw tables into SPECIES_ENRICHMENT ---
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
        help="Run in test mode — processes only the first 10 species.",
    )
    args = parser.parse_args()
    run_pipeline(test_mode=args.test)
