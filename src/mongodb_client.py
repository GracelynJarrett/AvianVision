# mongodb_client.py
#
# Purpose: Handles connecting to MongoDB Atlas using the connection string stored
# in the project's .env file. Other scripts import get_species_enrichment_collection()
# from this file whenever they need to read from or write to the enrichment data.
#
# Usage: Import and call get_species_enrichment_collection() in any script that
# needs to interact with the species_enrichment collection in MongoDB.

import os

from dotenv import load_dotenv
from pymongo import MongoClient


def get_species_enrichment_collection():
    """Connects to MongoDB Atlas and returns the species_enrichment collection."""

    # Load the .env file so the MongoDB connection string is available.
    load_dotenv()

    # Read the connection string from the environment.
    # This string contains the username, password, and cluster address — never hardcoded here.
    uri = os.getenv("MONGODB_URI")

    # Connect to MongoDB Atlas using the connection string.
    client = MongoClient(uri)

    # Navigate to the AvianVision database, then to the species_enrichment collection.
    # Make sure "AvianVision" matches the exact database name you created in Atlas
    # (MongoDB database names are case-sensitive).
    collection = client["avainvision"]["species_enrichment"]

    return collection
