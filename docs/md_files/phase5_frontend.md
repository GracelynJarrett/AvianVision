# Phase 5 — Frontend/Dashboard

**Status:** Not Started

---

## Overview

Phase 5 focuses on building the user-facing dashboard for AvianVision using Next.js. 
This includes creating the prediction page where users upload images, displaying 
prediction results and enrichment data, building a model metrics page, and connecting 
the dashboard to the FastAPI backend. An interactive range map using GBIF occurrence 
data and a bird diet page are also planned as part of this phase.

---

## Main Tasks

- [ ] Build the Next.js dashboard
- [ ] Create the prediction page
- [ ] Display prediction results and confidence score
- [ ] Display enrichment data
- [ ] Build the model metrics page
- [ ] Connect the dashboard to FastAPI endpoints
- [ ] Build the interactive range map using GBIF occurrence data
- [ ] Build the bird diet page

---

## Dependencies

- Phase 4 must be complete — all FastAPI endpoints must be working before the 
  frontend can connect to them
- Phase 5 design must be created at the end of Phase 4

---

## Tools & Libraries

| Tool / Library | Purpose |
|---------------|---------|
| Next.js | Building the frontend dashboard |
| React | Component-based UI structure (used within Next.js) |
| FastAPI | Backend API the dashboard connects to |
| GBIF Occurrence Data | Powering the interactive bird range map |

---

## Key Decisions

**Decision:** Use Next.js for the frontend
**Reason:** Next.js was selected as part of the original project proposal. It is a 
React-based framework well suited for building interactive dashboards and connects 
cleanly to a FastAPI backend.

**Decision:** Display the confidence score alongside the prediction result
**Reason:** Showing the confidence score gives users transparency about how certain 
the model is in its prediction. This is especially important when a result is close 
to the 45% unknown threshold.

**Decision:** Include an interactive range map using GBIF occurrence data
**Reason:** Displaying where a bird species has been observed on a map adds 
significant value to the enrichment data and makes the dashboard more engaging 
and informative for users.

---

## Known Risks & Mitigations

**Risk:** Limited Next.js experience may slow down frontend development
**Mitigation:** Next.js tutorials were reviewed during Week 0. Week 9 is a buffer 
week in case Phase 5 runs over schedule.

**Risk:** GBIF occurrence data is too large to load efficiently for the range map
**Mitigation:** Filter occurrence data by species and region before loading it 
into the map. Only fetch the data needed for the currently displayed species.

**Risk:** FastAPI endpoints behave differently when called from the frontend 
versus during backend testing
**Mitigation:** Test each endpoint connection from the frontend as it is built 
rather than connecting everything at the end.

**Risk:** The dashboard design created at the end of Phase 4 may need to change 
once building begins
**Mitigation:** Treat the Phase 4 design as a starting point rather than a fixed 
plan. Document any changes in the Change Log.

---

## Results & Notes

[Filled in after the phase is complete.]

---

*Last updated: 2026-09-22*