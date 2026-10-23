from pymongo import MongoClient
from dotenv import load_dotenv
import pandas as pd
import os

# ==========================================
# Load Environment Variables
# ==========================================

load_dotenv()

mongo_uri = os.getenv("MONGODB_URI")

client = MongoClient(mongo_uri)

print("Mongo URI: printed")

# Change if your database name is different
db = client["avianvision"]

# ==========================================
# Export Occurrences
# ==========================================

print("Exporting occurrences...")

occurrences = db["species_observations"]

occ_cursor = occurrences.find(
    {},
    {
        "_id": 0,
        "species_label": 1,
        "scientific_name": 1,
        "gbif_key": 1,
        "lat": 1,
        "lon": 1,
        "country": 1,
        "event_date": 1,
        "month": 1,
        "year": 1
    }
)

occ_df = pd.DataFrame(list(occ_cursor))

occ_df.to_csv("occurrences.csv", index=False)

print(f"✅ Exported {len(occ_df):,} occurrence records")

# ==========================================
# Export Species Enrichment
# ==========================================

print("\nExporting species enrichment...")

species_collection = db["species_info"]

records = []

for doc in species_collection.find({}):

    diet = doc.get("diet", {})
    taxonomy = doc.get("taxonomy", {})
    conservation = doc.get("conservation", {})

    prey_classes = diet.get("prey_classes", [])
    top_prey = diet.get("top_prey", [])

    record = {
        # Identification
        "species_label": doc.get("species_label"),
        "scientific_name": doc.get("scientific_name"),
        "gbif_key": doc.get("gbif_key"),

        # Taxonomy
        "class": taxonomy.get("class"),
        "order": taxonomy.get("order"),
        "family": taxonomy.get("family"),
        "genus": taxonomy.get("genus"),

        # Conservation
        "status": conservation.get("status"),
        "status_label": conservation.get("status_label"),
        "population_trend": conservation.get("population_trend"),
        "movement_patterns": conservation.get("movement_patterns"),

        # Diet
        "primary_prey_class": (
            prey_classes[0]
            if len(prey_classes) > 0
            else "Unknown"
        ),

        "prey_classes": "|".join(
            str(x) for x in prey_classes
        ),

        "top_prey": "|".join(
            prey.get("prey", "")
            for prey in top_prey
        )
    }

    records.append(record)

species_df = pd.DataFrame(records)

species_df.to_csv("species_enrichment.csv", index=False)

print(f"✅ Exported {len(species_df):,} species records")

# ==========================================
# Finished
# ==========================================

print("\nDone!")
print("Created:")
print(" - occurrences.csv")
print(" - species_enrichment.csv")