# Phase 3 — Data Enrichment Pipeline

**Status:** Not Started

---

## Overview

Phase 3 focuses on building the data enrichment pipeline in Snowflake. When a bird 
species is identified by the model, the pipeline automatically queries Snowflake to 
pull in additional information about that species from three external sources — GBIF, 
the IUCN Red List, and the Avian Diet Database. This gives users a richer result 
beyond just the species name.

---

## Main Tasks

- [ ] Load enrichment data into Snowflake from all three sources
  - [ ] GBIF — bird range and migration data
  - [ ] IUCN Red List API — endangered status, population trend, habitat
  - [ ] Avian Diet Database — bird diet information
- [ ] Set up the pipeline to automatically query Snowflake when a prediction is made
- [ ] Test the enrichment pipeline to make sure data is pulling correctly
- [ ] Flag missing data as "data not available"
- [ ] Finalize and document the enrichment pipeline

---

## Dependencies

- Phase 1 must be complete — bird name mapping CSV must be finalized and verified
- Phase 2 must be complete — the model must be registered before the pipeline can 
  be connected to predictions
- Snowflake account must be active — scheduled for end of Week 3

---

## Tools & Libraries

| Tool / Library | Purpose |
|---------------|---------|
| Snowflake | Data warehouse for storing and querying enrichment data |
| pygbif | Querying GBIF for bird range and migration data |
| IUCN Red List API | Pulling conservation status, population trend, and habitat |
| Avian Diet Database | Bird diet information |
| Python | Pipeline scripting |

---

## Key Decisions

**Decision:** Use Snowflake as the data warehouse for enrichment data
**Reason:** Snowflake is a scalable cloud data warehouse that integrates well with 
Python and FastAPI. It was selected as part of the original project proposal and 
aligns with the Applied AI and Data Engineering degree requirements.

**Decision:** Flag missing data as "data not available" rather than leaving it blank
**Reason:** Not all 525 species will have complete data across all three sources. 
Flagging missing data explicitly ensures users are never shown an empty field without 
explanation, and makes it easier to identify gaps in the enrichment data.

---

## Known Risks & Mitigations

**Risk:** GBIF or IUCN API rate limits slow down data loading
**Mitigation:** Load enrichment data in batches and add delays between API calls 
if needed. Data only needs to be loaded once into Snowflake, so speed is less 
critical than reliability.

**Risk:** Some species have no data in one or more enrichment sources
**Mitigation:** Flag missing fields as "data not available" so the pipeline 
handles gaps gracefully without breaking.

**Risk:** Snowflake trial period expires before the pipeline is fully tested
**Mitigation:** Snowflake is being activated at the end of Week 3, giving 
approximately 30 days of access through Week 7, which covers Phases 3 and 4.

**Risk:** Scientific name mismatches between the bird mapping CSV and the 
enrichment source APIs cause failed lookups
**Mitigation:** The bird name mapping CSV should be fully verified before Phase 3 
begins. Any remaining mismatches should be logged and handled individually.

---

## Results & Notes

[Filled in after the phase is complete.]

---

*Last updated: 2026-09-22*