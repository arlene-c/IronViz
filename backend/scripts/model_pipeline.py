from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LinearRegression
from sklearn.metrics.pairwise import cosine_similarity


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


@dataclass
class PipelineMetrics:
    forecast_mae_2024: float | None
    forecast_mape_2024: float | None
    opportunity_score_growth_corr: float | None
    similarity_nodes: int
    similarity_avg_neighbors: float


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

        model = LinearRegression()
        model.fit(X, y)

        preds = model.predict(np.array([[2025], [2026]])).clip(min=0)

        residual_std = None
        if len(g) >= 4:
            fit_residuals = y - model.predict(X)
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
                    "trend_slope": float(model.coef_[0]),
                    "points_used": int(len(g)),
                }
            )

        # Holdout on 2024 when possible (train <=2023)
        g_train = g[g["year"] <= 2023]
        g_holdout = g[g["year"] == 2024]
        if len(g_train) >= 3 and len(g_holdout) == 1:
            h_model = LinearRegression()
            h_model.fit(g_train["year"].values.reshape(-1, 1), g_train["aau_funding"].astype(float).values)
            pred_2024 = float(h_model.predict(np.array([[2024]]))[0])
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

    texts = df["FOR4_NAME"].replace("", "unknown-field")
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
    X = vectorizer.fit_transform(texts)

    n_components = 2 if X.shape[1] >= 2 else 1
    svd = TruncatedSVD(n_components=n_components, random_state=42)
    coords = svd.fit_transform(X)
    if n_components == 1:
        coords = np.hstack([coords, np.zeros((coords.shape[0], 1))])

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

    sim = cosine_similarity(X)
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


def train_and_evaluate() -> PipelineMetrics:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    field_summary_snapshot = pd.read_csv(INPUTS_DIR / "field_summary_snapshot.csv")
    forecast_snapshot = pd.read_json(INPUTS_DIR / "forecast_snapshot.json")

    forecast_out, forecast_metrics = _build_forecast_model(forecast_snapshot)
    opportunity_out, opp_metrics = _build_opportunity_model(field_summary_snapshot)
    sim_map, sim_neighbors, sim_metrics = _build_similarity_model(field_summary_snapshot)

    forecast_out.to_json(MODELS_DIR / "forecast_v1.json", orient="records", indent=2)
    opportunity_out.to_json(MODELS_DIR / "opportunity_scores_v1.json", orient="records", indent=2)
    sim_map.to_json(MODELS_DIR / "similarity_map_v1.json", orient="records", indent=2)
    sim_neighbors.to_json(MODELS_DIR / "similarity_neighbors_v1.json", orient="records", indent=2)

    metrics = PipelineMetrics(
        forecast_mae_2024=forecast_metrics["forecast_mae_2024"],
        forecast_mape_2024=forecast_metrics["forecast_mape_2024"],
        opportunity_score_growth_corr=opp_metrics["opportunity_score_growth_corr"],
        similarity_nodes=sim_metrics["similarity_nodes"],
        similarity_avg_neighbors=sim_metrics["similarity_avg_neighbors"],
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
            "similarity_model": "TF-IDF + cosine + SVD(2d)",
        },
        "input_manifest": manifest,
        "metrics": {
            "forecast_mae_2024": metrics.forecast_mae_2024,
            "forecast_mape_2024": metrics.forecast_mape_2024,
            "opportunity_score_growth_corr": metrics.opportunity_score_growth_corr,
            "similarity_nodes": metrics.similarity_nodes,
            "similarity_avg_neighbors": metrics.similarity_avg_neighbors,
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
