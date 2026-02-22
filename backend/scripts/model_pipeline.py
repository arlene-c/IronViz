from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "backend" / "data"
INPUTS_DIR = DATA_DIR / "model_inputs" / "v1"
MODELS_DIR = DATA_DIR / "models" / "v1"


def _normalize(series: pd.Series) -> pd.Series:
    s = series.astype(float)
    span = s.max() - s.min()
    if span == 0:
        return pd.Series(np.zeros(len(s)), index=s.index)
    return (s - s.min()) / span


def _fit_line(years: np.ndarray, values: np.ndarray) -> tuple[float, float]:
    slope, intercept = np.polyfit(years.astype(float), values.astype(float), 1)
    return float(slope), float(intercept)


def _predict_line(slope: float, intercept: float, years: np.ndarray) -> np.ndarray:
    return slope * years.astype(float) + intercept


@dataclass
class PipelineMetrics:
    forecast_mae_2024: float | None
    forecast_mape_2024: float | None
    opportunity_score_growth_corr: float | None
    similarity_nodes: int
    similarity_avg_neighbors: float
    radar_axes: int


def build_inputs() -> dict[str, Any]:
    INPUTS_DIR.mkdir(parents=True, exist_ok=True)

    field_summary_path = DATA_DIR / "field_summary.csv"
    forecast_path = DATA_DIR / "forecast.json"
    sankey_path = DATA_DIR / "sankey.json"

    field_summary = pd.read_csv(field_summary_path)
    forecast = pd.read_json(forecast_path)
    sankey = pd.read_json(sankey_path)

    required_field_summary = {
        "FOR4_CODE",
        "FOR4_NAME",
        "growth_rate",
        "AAU_total",
        "under_target_gap",
    }
    missing = sorted(required_field_summary - set(field_summary.columns))
    if missing:
        raise ValueError(f"field_summary.csv missing columns: {missing}")

    field_summary["FOR4_CODE"] = field_summary["FOR4_CODE"].astype(str).str.strip()
    field_summary["FOR4_NAME"] = field_summary["FOR4_NAME"].astype(str).str.strip()

    forecast["FOR4_CODE"] = forecast["FOR4_CODE"].astype(str).str.strip()

    field_summary.to_csv(INPUTS_DIR / "field_summary_snapshot.csv", index=False)
    forecast.to_json(INPUTS_DIR / "forecast_snapshot.json", orient="records", indent=2)
    sankey.to_json(INPUTS_DIR / "sankey_snapshot.json", orient="records", indent=2)

    manifest = {
        "version": "v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "field_summary_rows": int(len(field_summary)),
            "forecast_rows": int(len(forecast)),
            "sankey_rows": int(len(sankey)),
            "field_summary_columns": sorted(field_summary.columns.tolist()),
            "forecast_columns": sorted(forecast.columns.tolist()),
            "sankey_columns": sorted(sankey.columns.tolist()),
        },
    }
    (INPUTS_DIR / "dataset_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def _build_forecast_model(forecast_snapshot: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float | None]]:
    actual = forecast_snapshot[forecast_snapshot["aau_funding"].notna()].copy()
    actual["year"] = actual["year"].astype(int)

    rows: list[dict[str, Any]] = []
    holdout_errors: list[float] = []
    holdout_pct_errors: list[float] = []

    for field_code, group in actual.groupby("FOR4_CODE"):
        g = group.sort_values("year")
        X = g["year"].values.reshape(-1, 1)
        y = g["aau_funding"].astype(float).values
        field_name = g["FOR4_NAME"].dropna().iloc[0] if g["FOR4_NAME"].notna().any() else field_code

        if len(g) < 3:
            continue

        slope, intercept = _fit_line(X[:, 0], y)
        preds = _predict_line(slope, intercept, np.array([2025, 2026])).clip(min=0)

        residual_std = None
        if len(g) >= 4:
            fit_residuals = y - _predict_line(slope, intercept, X[:, 0])
            residual_std = float(np.std(fit_residuals, ddof=1))

        for target_year, pred_val in zip([2025, 2026], preds):
            rows.append(
                {
                    "FOR4_CODE": str(field_code),
                    "FOR4_NAME": str(field_name),
                    "year": int(target_year),
                    "aau_forecast": float(pred_val),
                    "aau_forecast_low": float(max(0, pred_val - (1.96 * residual_std))) if residual_std else None,
                    "aau_forecast_high": float(pred_val + (1.96 * residual_std)) if residual_std else None,
                    "trend_slope": slope,
                    "points_used": int(len(g)),
                }
            )

        # Holdout on 2024 when possible (train <=2023)
        g_train = g[g["year"] <= 2023]
        g_holdout = g[g["year"] == 2024]
        if len(g_train) >= 3 and len(g_holdout) == 1:
            h_slope, h_intercept = _fit_line(
                g_train["year"].values.astype(float),
                g_train["aau_funding"].astype(float).values,
            )
            pred_2024 = float(_predict_line(h_slope, h_intercept, np.array([2024]))[0])
            actual_2024 = float(g_holdout["aau_funding"].iloc[0])
            holdout_errors.append(abs(pred_2024 - actual_2024))
            if actual_2024 > 0:
                holdout_pct_errors.append(abs(pred_2024 - actual_2024) / actual_2024)

    forecast_out = pd.DataFrame(rows).sort_values(["FOR4_CODE", "year"]).reset_index(drop=True)
    metrics = {
        "forecast_mae_2024": float(np.mean(holdout_errors)) if holdout_errors else None,
        "forecast_mape_2024": float(np.mean(holdout_pct_errors)) if holdout_pct_errors else None,
    }
    return forecast_out, metrics


def _build_opportunity_model(field_summary_snapshot: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float | None]]:
    df = field_summary_snapshot.copy()
    for col in ["growth_rate", "under_target_gap", "AAU_total"]:
        if col not in df.columns:
            raise ValueError(f"field_summary snapshot missing: {col}")
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    df["growth_norm"] = _normalize(df["growth_rate"])
    df["under_target_gap_norm"] = _normalize(df["under_target_gap"])
    df["scale_norm"] = _normalize(np.log1p(df["AAU_total"]))

    weights = {"growth_norm": 0.5, "under_target_gap_norm": 0.35, "scale_norm": 0.15}
    df["opportunity_score_v1"] = (
        weights["growth_norm"] * df["growth_norm"]
        + weights["under_target_gap_norm"] * df["under_target_gap_norm"]
        + weights["scale_norm"] * df["scale_norm"]
    )

    out = df[
        [
            "FOR4_CODE",
            "FOR4_NAME",
            "opportunity_score_v1",
            "growth_rate",
            "under_target_gap",
            "AAU_total",
            "growth_norm",
            "under_target_gap_norm",
            "scale_norm",
        ]
    ].copy()
    out["contrib_growth"] = weights["growth_norm"] * out["growth_norm"]
    out["contrib_under_target"] = weights["under_target_gap_norm"] * out["under_target_gap_norm"]
    out["contrib_scale"] = weights["scale_norm"] * out["scale_norm"]
    out = out.sort_values("opportunity_score_v1", ascending=False).reset_index(drop=True)

    corr = out["opportunity_score_v1"].corr(out["growth_rate"])
    metrics = {"opportunity_score_growth_corr": float(corr) if pd.notna(corr) else None}
    return out, metrics


def _build_similarity_model(field_summary_snapshot: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, float]]:
    df = field_summary_snapshot.copy()
    df["FOR4_CODE"] = df["FOR4_CODE"].astype(str).str.strip()
    df["FOR4_NAME"] = df["FOR4_NAME"].astype(str).fillna("").str.strip()
    df["AAU_total"] = pd.to_numeric(df.get("AAU_total", 0), errors="coerce").fillna(0.0)
    df["cmu_share"] = pd.to_numeric(df.get("cmu_share", 0), errors="coerce").fillna(0.0)
    df["aau_share"] = pd.to_numeric(df.get("aau_share", 0), errors="coerce").fillna(0.0)

    feature_cols = pd.DataFrame(
        {
            "AAU_total_log": np.log1p(df["AAU_total"].astype(float)),
            "cmu_share": df["cmu_share"].astype(float),
            "aau_share": df["aau_share"].astype(float),
            "growth_rate": pd.to_numeric(df.get("growth_rate", 0), errors="coerce").fillna(0.0),
            "under_target_gap": pd.to_numeric(df.get("under_target_gap", 0), errors="coerce").fillna(0.0),
        }
    )
    for col in feature_cols.columns:
        feature_cols[col] = _normalize(feature_cols[col])

    X = feature_cols.values.astype(float)
    X_centered = X - X.mean(axis=0, keepdims=True)
    if X_centered.shape[1] >= 2:
        _, _, vt = np.linalg.svd(X_centered, full_matrices=False)
        basis = vt[:2].T
        coords = X_centered @ basis
    else:
        coords = np.hstack([X_centered, np.zeros((X_centered.shape[0], 1))])

    inst = np.where(df["cmu_share"] > df["aau_share"], "CMU", "AAU")
    map_rows = pd.DataFrame(
        {
            "grant_id": "field-" + df["FOR4_CODE"],
            "for4_code": df["FOR4_CODE"],
            "for4_name": df["FOR4_NAME"],
            "x_coord": coords[:, 0].astype(float),
            "y_coord": coords[:, 1].astype(float),
            "funding": df["AAU_total"].astype(float),
            "institution_group": inst,
            "funder_name": "aggregated",
        }
    )

    row_norm = np.linalg.norm(X, axis=1, keepdims=True)
    row_norm[row_norm == 0] = 1.0
    X_unit = X / row_norm
    sim = X_unit @ X_unit.T
    neighbors_rows: list[dict[str, Any]] = []
    for i, row in map_rows.iterrows():
        sims = sim[i]
        order = np.argsort(-sims)
        # skip self, keep top-5
        top = [j for j in order if j != i][:5]
        for j in top:
            neighbors_rows.append(
                {
                    "grant_id": row["grant_id"],
                    "neighbor_grant_id": map_rows.iloc[j]["grant_id"],
                    "neighbor_for4_name": map_rows.iloc[j]["for4_name"],
                    "similarity": float(sims[j]),
                }
            )
    neighbors = pd.DataFrame(neighbors_rows)
    avg_n = float(neighbors.groupby("grant_id").size().mean()) if not neighbors.empty else 0.0
    metrics = {"similarity_nodes": int(len(map_rows)), "similarity_avg_neighbors": avg_n}
    return map_rows, neighbors, metrics


def _build_radar_competitiveness_model(
    field_summary_snapshot: pd.DataFrame,
    max_axes: int = 6,
) -> tuple[pd.DataFrame, dict[str, float]]:
    df = field_summary_snapshot.copy()
    required = {"FOR4_CODE", "FOR4_NAME", "AAU_total", "cmu_share", "aau_share", "under_target_gap", "growth_rate"}
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"field_summary snapshot missing for radar model: {missing}")

    for col in ["AAU_total", "cmu_share", "aau_share", "under_target_gap", "growth_rate"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    df["FOR4_CODE"] = df["FOR4_CODE"].astype(str).str.strip()
    df["FOR4_NAME"] = df["FOR4_NAME"].astype(str).fillna("").str.strip()

    df["opportunity_axis_score"] = (
        0.45 * _normalize(df["AAU_total"])
        + 0.40 * _normalize(df["under_target_gap"].clip(lower=0.0))
        + 0.15 * _normalize(df["growth_rate"].clip(lower=0.0))
    )
    opportunity_selected = (
        df.sort_values(["opportunity_axis_score", "AAU_total"], ascending=False)
        .head(max_axes)
        .copy()
        .reset_index(drop=True)
    )

    df["cmu_advantage_raw"] = (df["cmu_share"] - df["aau_share"]).astype(float)
    strengths_pool = df[df["cmu_advantage_raw"] > 0].copy()
    if strengths_pool.empty:
        strengths_pool = df.copy()
    strengths_pool["strength_axis_score"] = (
        0.55 * _normalize(strengths_pool["cmu_advantage_raw"].clip(lower=0.0))
        + 0.30 * _normalize(strengths_pool["cmu_share"])
        + 0.15 * _normalize(np.log1p(strengths_pool["AAU_total"]))
    )
    strengths_selected = (
        strengths_pool.sort_values(["strength_axis_score", "cmu_share"], ascending=False)
        .head(max_axes)
        .copy()
        .reset_index(drop=True)
    )

    def _format_block(block: pd.DataFrame, view: str, score_col: str) -> pd.DataFrame:
        if block.empty:
            return pd.DataFrame(columns=["view", "axis", "for4_code", "cmu", "aau_avg", "gap", "priority_score"])
        cmu_max = float(block["cmu_share"].max()) if float(block["cmu_share"].max()) > 0 else 1.0
        aau_max = float(block["aau_share"].max()) if float(block["aau_share"].max()) > 0 else 1.0
        return pd.DataFrame(
            {
                "view": view,
                "axis": block["FOR4_NAME"],
                "for4_code": block["FOR4_CODE"],
                "cmu": (block["cmu_share"] / cmu_max * 100.0).round(2),
                "aau_avg": (block["aau_share"] / aau_max * 100.0).round(2),
                "gap": block["under_target_gap"].astype(float).round(6),
                "priority_score": block[score_col].astype(float).round(6),
            }
        )

    out = pd.concat(
        [
            _format_block(opportunity_selected, "opportunity", "opportunity_axis_score"),
            _format_block(strengths_selected, "strength", "strength_axis_score"),
        ],
        ignore_index=True,
    )
    metrics = {"radar_axes": int(len(out))}
    return out, metrics


def train_and_evaluate() -> PipelineMetrics:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    field_summary_snapshot = pd.read_csv(INPUTS_DIR / "field_summary_snapshot.csv")
    forecast_snapshot = pd.read_json(INPUTS_DIR / "forecast_snapshot.json")

    forecast_out, forecast_metrics = _build_forecast_model(forecast_snapshot)
    opportunity_out, opp_metrics = _build_opportunity_model(field_summary_snapshot)
    sim_map, sim_neighbors, sim_metrics = _build_similarity_model(field_summary_snapshot)
    radar_out, radar_metrics = _build_radar_competitiveness_model(field_summary_snapshot)

    forecast_out.to_json(MODELS_DIR / "forecast_v1.json", orient="records", indent=2)
    opportunity_out.to_json(MODELS_DIR / "opportunity_scores_v1.json", orient="records", indent=2)
    sim_map.to_json(MODELS_DIR / "similarity_map_v1.json", orient="records", indent=2)
    sim_neighbors.to_json(MODELS_DIR / "similarity_neighbors_v1.json", orient="records", indent=2)
    radar_out.to_json(MODELS_DIR / "radar_competitiveness_v1.json", orient="records", indent=2)

    metrics = PipelineMetrics(
        forecast_mae_2024=forecast_metrics["forecast_mae_2024"],
        forecast_mape_2024=forecast_metrics["forecast_mape_2024"],
        opportunity_score_growth_corr=opp_metrics["opportunity_score_growth_corr"],
        similarity_nodes=sim_metrics["similarity_nodes"],
        similarity_avg_neighbors=sim_metrics["similarity_avg_neighbors"],
        radar_axes=radar_metrics["radar_axes"],
    )
    return metrics


def write_meta(manifest: dict[str, Any], metrics: PipelineMetrics) -> None:
    payload = {
        "version": "v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "pipeline": {
            "name": "baseline_models",
            "forecast_model": "LinearRegression per FOR4_CODE",
            "opportunity_model": "weighted normalized score",
            "similarity_model": "normalized numeric features + cosine + SVD(2d)",
            "radar_model": "Top-axis normalized CMU vs AAU profile",
        },
        "input_manifest": manifest,
        "metrics": {
            "forecast_mae_2024": metrics.forecast_mae_2024,
            "forecast_mape_2024": metrics.forecast_mape_2024,
            "opportunity_score_growth_corr": metrics.opportunity_score_growth_corr,
            "similarity_nodes": metrics.similarity_nodes,
            "similarity_avg_neighbors": metrics.similarity_avg_neighbors,
            "radar_axes": metrics.radar_axes,
        },
    }
    (MODELS_DIR / "model_meta.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    manifest = build_inputs()
    metrics = train_and_evaluate()
    write_meta(manifest, metrics)
    print("Model pipeline complete.")
    print(f"Artifacts: {MODELS_DIR}")
    print(json.dumps(metrics.__dict__, indent=2))


if __name__ == "__main__":
    main()
