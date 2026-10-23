# mongodb_client.py
#
# Purpose: Handles connecting to MongoDB Atlas using the connection string stored
# in the project's .env file. Other scripts import the collection getter functions
# from this file whenever they need to read from or write to MongoDB.
#
# Two collections are used:
#   species_info         — one document per species (taxonomy, conservation, diet, etc.)
#   species_observations — one document per individual GBIF sighting record
#
# Usage: Import get_species_info_collection() or get_species_observations_collection()
# in any script that needs to interact with MongoDB.

import os

from dotenv import load_dotenv
from pymongo import MongoClient


def get_species_info_collection():
    """Connects to MongoDB Atlas and returns the species_info collection.
    This collection holds one document per bird species with all enrichment
    data: taxonomy, conservation status, diet, aggregated migration summary,
    and Wikipedia content."""

    # Load the .env file so the MongoDB connection string is available.
    load_dotenv()

    # Read the connection string from the environment.
    # This string contains the username, password, and cluster address — never hardcoded here.
    uri = os.getenv("MONGODB_URI")

    # Connect to MongoDB Atlas using the connection string.
    client = MongoClient(uri)

    # Navigate to the avianvision database, then to the species_info collection.
    # Database and collection names are case-sensitive in MongoDB.
    collection = client["avianvision"]["species_info"]

    return collection


def get_species_observations_collection():
    """Connects to MongoDB Atlas and returns the species_observations collection.
    This collection holds one document per individual GBIF sighting record —
    there can be hundreds of records per species, each with a lat/lon, country,
    and date."""

    # Load the .env file so the MongoDB connection string is available.
    load_dotenv()

    # Read the connection string from the environment.
    uri = os.getenv("MONGODB_URI")

    # Connect to MongoDB Atlas using the connection string.
    client = MongoClient(uri)

    # Navigate to the avianvision database, then to the species_observations collection.
    collection = client["avianvision"]["species_observations"]

    return collection
