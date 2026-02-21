from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "backend" / "data" / "models" / "v1"


def _require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing required artifact: {path}")


def _validate_columns(name: str, frame: pd.DataFrame, required: set[str]) -> None:
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError(f"{name} missing columns: {missing}")


def main() -> None:
    required_files = [
        MODELS_DIR / "forecast_v1.json",
        MODELS_DIR / "opportunity_scores_v1.json",
        MODELS_DIR / "similarity_map_v1.json",
        MODELS_DIR / "similarity_neighbors_v1.json",
        MODELS_DIR / "model_meta.json",
    ]
    for f in required_files:
        _require_file(f)

    forecast = pd.read_json(MODELS_DIR / "forecast_v1.json")
    opportunity = pd.read_json(MODELS_DIR / "opportunity_scores_v1.json")
    sim_map = pd.read_json(MODELS_DIR / "similarity_map_v1.json")
    sim_neighbors = pd.read_json(MODELS_DIR / "similarity_neighbors_v1.json")

    _validate_columns(
        "forecast_v1.json",
        forecast,
        {"FOR4_CODE", "FOR4_NAME", "year", "aau_forecast", "trend_slope", "points_used"},
    )
    _validate_columns(
        "opportunity_scores_v1.json",
        opportunity,
        {"FOR4_CODE", "FOR4_NAME", "opportunity_score_v1", "contrib_growth", "contrib_under_target", "contrib_scale"},
    )
    _validate_columns(
        "similarity_map_v1.json",
        sim_map,
        {"grant_id", "for4_code", "for4_name", "x_coord", "y_coord", "funding", "institution_group"},
    )
    _validate_columns(
        "similarity_neighbors_v1.json",
        sim_neighbors,
        {"grant_id", "neighbor_grant_id", "similarity"},
    )

    if forecast.empty or opportunity.empty or sim_map.empty:
        raise ValueError("One or more key artifacts are empty.")

    if (opportunity["opportunity_score_v1"] < 0).any() or (opportunity["opportunity_score_v1"] > 1).any():
        raise ValueError("opportunity_score_v1 should be normalized to [0, 1].")

    meta = json.loads((MODELS_DIR / "model_meta.json").read_text(encoding="utf-8"))
    if meta.get("version") != "v1":
        raise ValueError("model_meta.json has unexpected version.")

    print("Artifact validation passed.")
    print(f"forecast rows: {len(forecast)}")
    print(f"opportunity rows: {len(opportunity)}")
    print(f"similarity nodes: {len(sim_map)}")
    print(f"neighbor links: {len(sim_neighbors)}")


if __name__ == "__main__":
    main()
