# IronViz

IronViz is a dual-workspace grant analytics app with two user views:

- Admin Strategy Console: portfolio prioritization, under-targeted fields, funding flow, and competitiveness radar models.
- Research Discovery Console: similarity mapping, projection bands, and adjacent expansion/pivot recommendations.

The app combines a Next.js frontend with a Python data/model artifact pipeline.

## Repository Structure

- `frontend/`: Next.js UI, API routes, and visualization components.
- `backend/data/`: source datasets and generated model artifacts.
- `backend/scripts/`: model pipeline, validation, and dev watcher.
- `backend/notebooks/analysis.ipynb`: exploratory/modeling notebook.

## Prerequisites

- Node.js 18+ (recommended: Node 20+)
- npm 9+
- Python 3.10+

Python packages required for the pipeline:

- `numpy`
- `pandas`

## Setup

From the repo root:

```bash
# 1) Install root tooling (concurrently + shared deps)
npm install

# 2) Install frontend app deps
npm --prefix frontend install

# 3) Install Python deps for backend pipeline
python3 -m pip install numpy pandas
```

## Environment Variables

Create a `.env.local` file in the repo root if you use DB-backed features:

```bash
MONGODB_URI="<your_mongodb_connection_string>"
```

## Run the App (Recommended)

Run frontend + backend pipeline watcher together:

```bash
npm run dev
```

This starts:

- Frontend on `http://localhost:3001`
- Backend dev runner (`backend/scripts/dev_backend.py`) that rebuilds model artifacts when input data changes.

## Run Components Separately

Frontend only:

```bash
npm --prefix frontend run dev
```

Backend model watcher only:

```bash
python3 backend/scripts/dev_backend.py
```

## Build and Start (Production-style)

```bash
npm run build
npm run start
```

## Data / Model Pipeline

Manual pipeline run:

```bash
python3 backend/scripts/model_pipeline.py
```

Validate generated artifacts:

```bash
python3 backend/scripts/validate_model_artifacts.py
```

Artifacts output directory:

- `backend/data/models/v1/forecast_v1.json`
- `backend/data/models/v1/opportunity_scores_v1.json`
- `backend/data/models/v1/similarity_map_v1.json`
- `backend/data/models/v1/similarity_neighbors_v1.json`
- `backend/data/models/v1/radar_competitiveness_v1.json`
- `backend/data/models/v1/model_meta.json`

## How to Use the Site

1. Open `http://localhost:3001`.
2. Switch between **Admin** and **Researcher** modes from the top-level toggle.

### Admin View

Use this view to answer: where should CMU catch up vs where should it double down?

- Opportunity Quadrant: growth vs under-target gap.
- Under-Targeted Treemap: largest under-indexed fields.
- Funder Flow Ranking: flow-oriented prioritization.
- Radar Comparisons:
  - `Opportunity` profile (CMU vs AAU in expansion targets)
  - `Strength` profile (where CMU has relative advantage)

### Research View

Use this view to answer: where can a proposal pivot with minimal friction?

- Similarity Map: conceptual neighborhood exploration.
- Projection Bands: near-term funding trajectory by field.
- Adjacent Expansion Matrix: pivot ease vs available funding with ranked pivot paths.

## Useful Commands

```bash
# Lint frontend
npm --prefix frontend run lint

# Run a targeted eslint check
./frontend/node_modules/.bin/eslint frontend/app/components/<ComponentName>.tsx
```

## Troubleshooting

- `ModuleNotFoundError: No module named pandas/numpy`
  - Install Python deps with `python3 -m pip install numpy pandas`.

- Frontend runs but charts are empty or stale
  - Run pipeline manually:
    - `python3 backend/scripts/model_pipeline.py`
    - `python3 backend/scripts/validate_model_artifacts.py`

- Port mismatch
  - `npm run dev` uses port `3001` for frontend by design.

## Notes

- Some generated artifact files under `backend/data/model_inputs/v1/` and `backend/data/models/v1/` may change as source datasets change.
- Commit regenerated artifacts intentionally when model/data updates are part of your change.
