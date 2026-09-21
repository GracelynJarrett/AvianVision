# AvianVision

AvianVision is a capstone project where a machine learning model is trained to identify 
525 bird species from uploaded images. Once a species is identified, the system 
automatically pulls in additional information about that bird — such as its migration 
patterns, diet, and conservation status — to give the user a richer result.

> **Status:** In Progress — Neumont University Capstone Project (2026)

---

## What It Does

1. A user uploads an image of a bird
2. AvianVision's model analyzes the image and identifies the species
3. If the model is not confident enough in its prediction, the bird is flagged as unknown 
   rather than returning an incorrect result
4. The identified species is looked up across multiple data sources to return enrichment 
   information alongside the prediction

---

## Tech Stack

| Area | Technology |
|------|-----------|
| Machine Learning Model | EfficientNetB0 (transfer learning) |
| Experiment Tracking | MLflow |
| Data Warehouse | Snowflake |
| Backend | FastAPI + MongoDB Atlas |
| Frontend | Next.js |
| Dataset | Hugging Face — 525 bird species |
| Enrichment Sources | GBIF, IUCN Red List, Avian Diet Database |

---

## Project Structure
AvianVision/
├── data/ # Dataset metadata and mapping files
├── docs/ # Project documentation and logs
├── models/ # Trained model weights and MLflow artifacts
├── notebooks/ # Exploratory analysis and experiments
├── configs/ # YAML configuration files
├── src/ # Source code
├── tests/ # Tests
├── CLAUDE.md # AI assistant instructions
└── requirements.txt

---

## Author

**Gracelyn Jarrett**
Applied AI and Data Engineering — Neumont University
gjarrett@student.neumont.edu