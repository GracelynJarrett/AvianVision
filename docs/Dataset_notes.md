# This document talks about what Enrichment datasets are being used in this project. What infomation we will be gathering from each data sorce and how we will accase the data. 
    I will also keep updata on if we are able to accase the dataset or not. 

Last updated October 18, 2026


# GBIF
    Gloabl Biodiversity Information facility can be accased through python libarys and gives the users accase to: 
        Species name
        Observation date
        Latitude/Longitude
        Country/Region
        Observer/source information
        Millions of bird observations worldwide

    * Notes
        as of right now I have only been able to accase the species name, I will need to add in the Species, Occurrences, Locations, and Observers labiarys to accase all the data

    - If still cant accase the observation data, creat an account and dowload the data - https://www.gbif.org/dataset/4fa7b334-ce0d-4e88-aaae-2e0c138d049e/download

---

# Avian Diet database
    Avian Diet database contations information about what kind of diet the speces haves, there main food sorce and how much of there diet is that food sorce. I downloaded a txt file to accase the data.

    *Notes
        I have accase to Avian Diet but its maily american birds so I need to either a) work with what I have or b) find adtision diet information for bird speaces. 

---

# IUCN Red List API
    IUCN haves a list of the bird speces Conservationstatuse, population trend, threats, and the red list Category. All of these informoation can be accase through an API.
        red list cateforys:
            LC - Least Concern
            NT - Near Threatened
            VU - Vulnerable
            EN - Endangered
            CR - Critically Endangered

    *Notes
        I have tryed the API link but it saids its for v3 which has been retiered, I need accase to v4. I emailed IUCN and they gave me instutions on how to update it but I will need to test it out first. 

---

# Wikipedia API
    I can accase wikipedia through an API, the API is able to gather the folowing informaiton:
        Species history
        Physical description
        Plumage information
        Habitat
        Diet
        Breeding behavior
        Images
        Scientific classification

    * Notes
        As of right now I have not tryed to accase wikipedia thoughthe API, I will need to test that out. 

---

# Ebird - IF GBIF does not work
    Ebird is a platform that keeps track of bird sitings and when the bird was spoted. I can accase Ebird though either downloading data or though an API. Data includes:
        Bredding range
        non-bredding range
        migration range
        Seasonal ocurrece

    *Note
        I have sent in a requete to Ebird for premition to downlaod thire data but I have not heard back from them yet. 

