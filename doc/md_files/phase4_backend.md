# Phase 4 — Backend

**Status:** Not Started

---

## Overview

Phase 4 focuses on building the backend of AvianVision using FastAPI. This includes 
creating all API endpoints, connecting MongoDB Atlas for storing prediction results, 
and integrating the trained EfficientNetB0 model and enrichment pipeline into a 
single working backend system.

---

## Main Tasks

- [ ] Set up FastAPI
- [ ] Create initial API endpoints (/predict, /birds, /species, /stats, /health)
- [ ] Connect MongoDB Atlas to FastAPI
- [ ] Begin connecting the EfficientNetB0 model to FastAPI
- [ ] Finish and test all FastAPI endpoints
- [ ] Verify predictions are saved correctly to MongoDB Atlas
- [ ] Test the full pipeline end-to-end
- [ ] Document the backend
- [ ] Create Phase 5 design

---

## Dependencies

- Phase 2 must be complete — the registered model must be ready to connect
- Phase 3 must be complete — the enrichment pipeline must be ready to connect
- MongoDB Atlas account must be active

---

## Tools & Libraries

| Tool / Library | Purpose |
|---------------|---------|
| FastAPI | Building and serving the backend API |
| MongoDB Atlas | Storing prediction results and submission data |
| Python | Backend scripting |
| EfficientNetB0 (MLflow) | Loaded model for making predictions |
| Snowflake | Queried by the enrichment pipeline on prediction |
| Uvicorn | Running the FastAPI server |

---

## Key Decisions

**Decision:** Use FastAPI as the backend framework
**Reason:** FastAPI is lightweight, fast, and well suited for serving machine learning 
models. It has built-in support for automatic API documentation and integrates cleanly 
with Python-based ML workflows.

**Decision:** Use MongoDB Atlas for storing predictions
**Reason:** Prediction results are unstructured and vary depending on species and 
enrichment data availability. MongoDB's document-based structure handles this 
variability better than a relational database would.

**Decision:** Create five initial API endpoints (/predict, /birds, /species, /stats, /health)
**Reason:** These endpoints cover the core functionality needed for the frontend — 
making predictions, retrieving species information, viewing stats, and checking 
system health.

---

## Known Risks & Mitigations

**Risk:** Model inference is too slow when called through the API
**Mitigation:** Load the model once at server startup rather than reloading it 
on every request. If speed is still an issue, explore caching recent predictions.

**Risk:** MongoDB Atlas connection fails in certain environments
**Mitigation:** Test the connection early in Phase 4 before building dependent 
endpoints. Store connection strings securely in the .env file.

**Risk:** Enrichment pipeline query adds too much latency to the /predict endpoint
**Mitigation:** If Snowflake queries are slow, consider running enrichment 
asynchronously so the prediction result is returned immediately while enrichment 
data loads separately.

**Risk:** End-to-end pipeline testing reveals issues from earlier phases
**Mitigation:** Week 4 buffer time is available if Phase 2 or 3 issues surface 
during backend integration testing.

---

## Results & Notes

[Filled in after the phase is complete.]

---

*Last updated: 2026-09-22*