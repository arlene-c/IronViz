from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


def build_taxonomy(for2_csv: Path, for4_csv: Path, out_json: Path) -> None:
    for2 = pd.read_csv(for2_csv, dtype={"GRANT_ID": str, "FOR2_CODE": str, "FOR2_NAME": str})
    for4 = pd.read_csv(for4_csv, dtype={"GRANT_ID": str, "FOR4_CODE": str, "FOR4_NAME": str})

    for2 = for2[["GRANT_ID", "FOR2_CODE", "FOR2_NAME"]].dropna(subset=["GRANT_ID", "FOR2_CODE"]).copy()
    for4 = for4[["GRANT_ID", "FOR4_CODE", "FOR4_NAME"]].dropna(subset=["GRANT_ID", "FOR4_CODE"]).copy()

    for2["FOR2_CODE"] = for2["FOR2_CODE"].astype(str).str.strip().str.zfill(2)
    for4["FOR4_CODE"] = (
        for4["FOR4_CODE"].astype(str).str.strip().str.replace(r"\D", "", regex=True).str.zfill(4)
    )

    merged = for4.merge(for2, on="GRANT_ID", how="inner")
    if merged.empty:
        raise ValueError("No GRANT_ID overlap between FOR4 and FOR2 source files.")

    pair_counts = (
        merged.groupby(["FOR4_CODE", "FOR4_NAME", "FOR2_CODE", "FOR2_NAME"], dropna=False)
        .size()
        .reset_index(name="pair_count")
    )

    totals = (
        pair_counts.groupby(["FOR4_CODE", "FOR4_NAME"], dropna=False)["pair_count"]
        .sum()
        .reset_index(name="for4_total")
    )

    ranked = pair_counts.merge(totals, on=["FOR4_CODE", "FOR4_NAME"], how="left")
    ranked = ranked.sort_values(["FOR4_CODE", "pair_count"], ascending=[True, False])

    best = ranked.drop_duplicates(subset=["FOR4_CODE"], keep="first").copy()
    best["confidence"] = (best["pair_count"] / best["for4_total"]).round(6)
    best = best.sort_values("FOR4_CODE")

    records = [
        {
            "for4_code": row.FOR4_CODE,
            "for4_name": row.FOR4_NAME,
            "for2_code": row.FOR2_CODE,
            "for2_name": row.FOR2_NAME,
            "support_pairs": int(row.pair_count),
            "for4_total_pairs": int(row.for4_total),
            "confidence": float(row.confidence),
        }
        for row in best.itertuples(index=False)
    ]

    payload = {
        "version": "v1",
        "source": {
            "for2_csv": str(for2_csv),
            "for4_csv": str(for4_csv),
            "join_key": "GRANT_ID",
            "mapping_rule": "Most frequent FOR2 per FOR4 by shared grants",
        },
        "counts": {
            "for2_rows": int(len(for2)),
            "for4_rows": int(len(for4)),
            "joined_rows": int(len(merged)),
            "for4_mapped": int(len(records)),
        },
        "records": records,
    }

    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build FOR4 -> FOR2 taxonomy artifact.")
    parser.add_argument("--for2-csv", required=True, help="Path to DIMENSIONS_FIELD_OF_RESEARCH_TWO_DIGIT.csv")
    parser.add_argument("--for4-csv", required=True, help="Path to DIMENSIONS_FIELD_OF_RESEARCH_FOUR_DIGIT.csv")
    parser.add_argument(
        "--out-json",
        default=str(Path("backend") / "data" / "for_taxonomy_v1.json"),
        help="Output path for taxonomy artifact JSON",
    )
    args = parser.parse_args()

    build_taxonomy(Path(args.for2_csv), Path(args.for4_csv), Path(args.out_json))
    print(f"Wrote taxonomy artifact: {args.out_json}")


if __name__ == "__main__":
    main()
