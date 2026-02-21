# Model Pipeline (v1)

## Commands

Run baseline pipeline:

```powershell
python backend/scripts/model_pipeline.py
```

Validate model artifacts:

```powershell
python backend/scripts/validate_model_artifacts.py
```

## Outputs

Artifacts are written to:

`backend/data/models/v1/`

- `forecast_v1.json`
- `opportunity_scores_v1.json`
- `similarity_map_v1.json`
- `similarity_neighbors_v1.json`
- `model_meta.json`

Input snapshots are written to:

`backend/data/model_inputs/v1/`

- `field_summary_snapshot.csv`
- `forecast_snapshot.json`
- `sankey_snapshot.json`
- `dataset_manifest.json`
