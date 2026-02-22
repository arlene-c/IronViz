import { NextRequest, NextResponse } from "next/server";
import { modelsDir, readModelArtifact } from "@/lib/model-artifacts";
import { readFile } from "node:fs/promises";
import path from "node:path";

type SimilarityNode = {
  grant_id: string;
  for4_code: string;
  for4_name: string;
  funding: number;
  x_coord: number;
  y_coord: number;
};

type ForecastRow = {
  FOR4_CODE: string;
  FOR4_NAME: string;
  year: number;
  aau_forecast: number;
};

type OpportunityRow = {
  FOR4_CODE: string;
  AAU_total: number;
};

type TaxonomyRecord = {
  for4_code: string;
  for4_name: string;
  for2_code: string;
  for2_name: string;
};

const STOP_WORDS = new Set([
  "and",
  "of",
  "the",
  "for",
  "in",
  "to",
  "with",
  "studies",
  "science",
  "sciences",
  "systems",
]);

const TOKEN_NORMALIZATION: Record<string, string> = {
  centred: "centered",
  center: "centered",
  centres: "centered",
  computing: "compute",
  computational: "compute",
  computer: "compute",
  computers: "compute",
  chemistry: "chem",
  chemical: "chem",
  chemicals: "chem",
  intelligence: "ai",
  artificial: "ai",
};

function tokenize(label: string): Set<string> {
  const tokens = label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => TOKEN_NORMALIZATION[t] ?? t)
    .filter((t) => !STOP_WORDS.has(t));
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  const union = a.size + b.size - overlap;
  return union > 0 ? overlap / union : 0;
}

export async function GET(request: NextRequest) {
  try {
    const [nodes, forecast, opportunity] = await Promise.all([
      readModelArtifact<SimilarityNode[]>("similarity_map_v1.json"),
      readModelArtifact<ForecastRow[]>("forecast_v1.json"),
      readModelArtifact<OpportunityRow[]>("opportunity_scores_v1.json"),
    ]);
    const taxonomyPath = path.resolve(process.cwd(), "..", "backend", "data", "for_taxonomy_v1.json");
    const taxonomyRaw = JSON.parse(await readFile(taxonomyPath, "utf-8")) as { records?: TaxonomyRecord[] };
    const taxonomyRecords = Array.isArray(taxonomyRaw.records) ? taxonomyRaw.records : [];

    const for4Code = (request.nextUrl.searchParams.get("for4_code") || "").trim();
    const topN = Math.max(3, Math.min(8, Number(request.nextUrl.searchParams.get("top_n") || 6)));

    const byCode = new Map(nodes.map((n) => [n.for4_code, n]));
    const fallbackPrimary = nodes[0];
    const primary = (for4Code && byCode.get(for4Code)) || fallbackPrimary;

    if (!primary) {
      return NextResponse.json({ version: "v1", data: [], source: modelsDir() });
    }

    const forecast2026 = new Map(
      forecast
        .filter((r) => Number(r.year) === 2026)
        .map((r) => [String(r.FOR4_CODE), Number(r.aau_forecast) || 0]),
    );
    const aauTotal = new Map(opportunity.map((r) => [String(r.FOR4_CODE), Number(r.AAU_total) || 0]));
    const taxonomyByFor4 = new Map(
      taxonomyRecords.map((r) => [String(r.for4_code), { for2_code: String(r.for2_code), for2_name: r.for2_name }]),
    );

    const primaryFor2 = taxonomyByFor4.get(primary.for4_code)?.for2_code ?? "";
    const primaryTokens = tokenize(primary.for4_name);
    const maxDistance = Math.sqrt(2 * 2 + 2 * 2); // conservative bound for typical 2D coords near [-1,1]

    const scored = nodes
      .filter((n) => n.for4_code !== primary.for4_code)
      .map((candidate) => {
        const candidateFor2 = taxonomyByFor4.get(candidate.for4_code)?.for2_code ?? "";
        const sameFor2 = primaryFor2 !== "" && primaryFor2 === candidateFor2 ? 1 : 0;

        const lexical = jaccard(primaryTokens, tokenize(candidate.for4_name));
        const dx = Number(primary.x_coord) - Number(candidate.x_coord);
        const dy = Number(primary.y_coord) - Number(candidate.y_coord);
        const distance = Math.sqrt(dx * dx + dy * dy);
        const mapProximity = Math.max(0, 1 - distance / maxDistance);

        // Hybrid ease: taxonomy closeness dominates, then map proximity, then lexical overlap.
        const composite = 0.55 * sameFor2 + 0.3 * mapProximity + 0.15 * lexical;
        // Avoid artificial 0/100; keep visible headroom for uncertainty.
        const pivotEase = 0.08 + 0.84 * Math.max(0, Math.min(1, composite));

        const availableFunding =
          forecast2026.get(candidate.for4_code) ??
          aauTotal.get(candidate.for4_code) ??
          Number(candidate.funding) ??
          0;

        return {
          for4_code: candidate.for4_code,
          for4_name: candidate.for4_name,
          pivot_ease: pivotEase,
          raw_similarity: mapProximity,
          same_for2: Boolean(sameFor2),
          lexical_overlap: lexical,
          available_funding: Number(availableFunding) || 0,
        };
      })
      .sort((a, b) => b.pivot_ease - a.pivot_ease);

    const adjacent = scored.slice(0, topN);

    return NextResponse.json({
      version: "v1",
      primary: {
        for4_code: primary.for4_code,
        for4_name: primary.for4_name,
      },
      adjacent,
      source: modelsDir(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load adjacent expansion model artifact", detail: String(error) },
      { status: 500 },
    );
  }
}
