# AvianVision Schedule Log

## About This Document

This document tracks the high-level project schedule for AvianVision, based on the tasks 
outlined in the approved project proposal. It serves as a quick reference to see what was 
planned, when it was planned, and whether the project is on track.

For day-to-day task tracking, see Trello. For detailed notes on what was done each day, 
see the Project Log. For any changes to the original plan, see the Change Log.

---

## Week 0 — Prep

- [x] Request IUCN API key
- [x] Set up Trello
- [x] Research Claude MCP
- [x] Review Next.js through tutorials
- [x] Watch MongoDB Atlas setup tutorials
- [ ] Set up Snowflake account *(Delayed — pushed to end of Week 3)*

---

## Week 1 — Project Setup + Phase 1

**Project Setup:**
- [x] Set up GitHub repository
- [x] Create file structure
- [x] Create documentation files
- [ ] Create AI instruction file (CLAUDE.md)
- [ ] Create project MD file
- [ ] Create all phase MD files

**Phase 1 — Dataset & Preprocessing:**
- [ ] Access Hugging Face bird dataset
- [ ] Verify dataset integrity
- [ ] Set up image preprocessing pipeline
- [ ] Set up MLflow for experiment tracking

---

## Week 2 — Phase 2 Start

- [ ] Set up EfficientNetB0
- [ ] Set up YAML config files
- [ ] Begin training experiments
- [ ] Log all experiments in MLflow

---

## Week 3 — Phase 2 Continued

- [ ] Continue hyperparameter experiments
- [ ] Validate models on validation dataset
- [ ] Select best-performing model (80%+ accuracy)
- [ ] Evaluate best model on test dataset
- [ ] Set confidence threshold for unknown category
- [ ] Register best model in MLflow
- [ ] Set up Snowflake account *(moved from Week 0)*

---

## Week 4 — Phase 2 Wrap-Up + Buffer

- [ ] Continue working on Phase 2 if needed
- [ ] Review and document model results
- [ ] Verify best model is properly registered in MLflow
- [ ] Start setting up Snowflake and loading datasets
- [ ] Start working on the enrichment pipeline

---

## Week 5 — Phase 3 (Data Enrichment Pipeline)

- [ ] Load enrichment data into Snowflake
  - [ ] GBIF — bird range and migration data
  - [ ] IUCN Red List API — endangered status, population trend, habitat
  - [ ] Avian Diet Database — bird diet information
- [ ] Set up pipeline to query Snowflake on prediction
- [ ] Test enrichment pipeline
- [ ] Flag missing data as "data not available"

---

## Week 6 — Phase 3 Wrap-Up + Phase 4 Start

**Phase 3:**
- [ ] Finalize and document the enrichment pipeline

**Phase 4 — Backend:**
- [ ] Set up FastAPI
- [ ] Create initial API endpoints (/predict, /birds, /species, /stats, /health)
- [ ] Connect MongoDB Atlas to FastAPI
- [ ] Begin connecting EfficientNetB0 to FastAPI

---

## Week 7 — Phase 4 Complete

- [ ] Finish and test all FastAPI endpoints
- [ ] Verify predictions save correctly to MongoDB Atlas
- [ ] Test full pipeline end-to-end
- [ ] Document the backend
- [ ] Create Phase 5 design

---

## Week 8 — Phase 5 (Frontend/Dashboard)

- [ ] Build the Next.js dashboard
- [ ] Create the prediction page
- [ ] Display prediction results and confidence score
- [ ] Display enrichment data
- [ ] Build the model metrics page
- [ ] Connect dashboard to FastAPI endpoints

---

## Week 9 — Frontend + Buffer + Stretch Goals + Presentation Prep

**Frontend:**
- [ ] Build interactive range map (GBIF occurrence data)
- [ ] Build bird diet page

**Buffer:**
- [ ] Catch up if any phase runs over schedule
- [ ] Final testing of the full system

**Stretch Goals:**
- [ ] Begin implementing stretch requirements if on schedule

**Presentation Prep:**
- [ ] Check presentation requirements
- [ ] Start building the presentation
- [ ] Plan outfit
- [ ] Last-minute fixes and polish

---

## Week 10 — Presentation

- [ ] Present AvianVision
- [ ] Watch other student presentations
- [ ] Collect feedback on AvianVision