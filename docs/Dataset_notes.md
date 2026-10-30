# This document describes what enrichment datasets are being used in this project, what information we will be gathering from each data source, and how we will access the data.
    I will also keep updates on whether we are able to access each dataset or not.

Last updated October 18, 2026


# GBIF
    Global Biodiversity Information Facility can be accessed through Python libraries and gives users access to:
        Species name
        Observation date
        Latitude/Longitude
        Country/Region
        Observer/source information
        Millions of bird observations worldwide

    * Notes
        As of right now I have only been able to access the species name; I will need to add in the Species, Occurrences, Locations, and Observers libraries to access all the data.

    - If still can't access the observation data, create an account and download the data - https://www.gbif.org/dataset/4fa7b334-ce0d-4e88-aaae-2e0c138d049e/download

---

# Avian Diet Database
    The Avian Diet Database contains information about what kind of diet each species has, their main food source, and how much of their diet is that food source. I downloaded a text file to access the data.

    *Notes
        I have access to the Avian Diet Database but it mainly covers American birds, so I need to either a) work with what I have or b) find additional diet information for bird species.

---

# IUCN Red List API
    The IUCN has a list of bird species' conservation status, population trend, threats, and Red List category. All of this information can be accessed through an API.
        Red List categories:
            LC - Least Concern
            NT - Near Threatened
            VU - Vulnerable
            EN - Endangered
            CR - Critically Endangered

    *Notes
        I tried the API link but it says it's for v3, which has been retired; I need access to v4. I emailed IUCN and they gave me instructions on how to update it, but I will need to test it out first.

---

# Wikipedia API
    I can access Wikipedia through an API. The API is able to gather the following information:
        Species history
        Physical description
        Plumage information
        Habitat
        Diet
        Breeding behavior
        Images
        Scientific classification

    * Notes
        As of right now I have not tried to access Wikipedia through the API; I will need to test that out.

---

# eBird - IF GBIF does not work
    eBird is a platform that keeps track of bird sightings and when the bird was spotted. I can access eBird through either downloading data or through an API. Data includes:
        Breeding range
        Non-breeding range
        Migration range
        Seasonal occurrence

    *Note
        I have sent in a request to eBird for permission to download their data, but I have not heard back from them yet.
