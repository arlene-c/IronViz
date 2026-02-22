import { readDataArtifact } from "@/lib/data-artifacts";
import { readModelArtifact } from "@/lib/model-artifacts";

export type DecisionRequest = {
  idea_text: string;
  cmu_campus_code: string;
  for4_code: string;
  project_length_months: number;
  budget_mode: "manual" | "auto";
  requested_budget?: number;
  already_received?: number;
  subject_allocations?: Array<{ area: string; amount: number }>;
};

type OpportunityRow = {
  FOR4_CODE: string | number;
  FOR4_NAME: string;
  opportunity_score_v1: number;
  growth_rate: number;
  under_target_gap: number;
  AAU_total: number;
};

type ForecastRow = {
  FOR4_CODE: string | number;
  FOR4_NAME: string;
  year: number;
  aau_forecast: number;
  aau_forecast_low?: number | null;
  aau_forecast_high?: number | null;
};

type SankeyRow = {
  source: string;
  target: string;
  value: number;
  cmu_field_total?: number;
  FOR4_CODE?: string | number;
  growth_weighted_value?: number;
};

type FunderRecommendation = {
  funder_name: string;
  expected_award_amount: number;
  award_timing_window: string;
  cmu_win_probability: number;
  fit_score: number;
  source_type?: "field_observed" | "similar_field_fallback" | "global_fallback" | "baseline_fallback";
};

type SimilarityNeighborRow = {
  grant_id: string;
  neighbor_grant_id: string;
  neighbor_for4_name?: string;
  similarity: number;
};

type ForTaxonomyRecord = {
  for4_code: string;
  for4_name: string;
  for2_code: string;
  for2_name: string;
  support_pairs: number;
  for4_total_pairs: number;
  confidence: number;
};

type ForTaxonomyArtifact = {
  version: string;
  records: ForTaxonomyRecord[];
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function normalizeCode(code: string | number | undefined | null): string {
  return String(code ?? "").trim();
}

/** Extract the raw FOR4 code from a grant_id like "field-3001" → "3001" */
function grantIdToCode(grantId: string): string {
  return grantId.replace(/^field-/, "").trim();
}

/** Build the canonical grant_id key for a FOR4 code */
function codeToGrantId(code: string): string {
  return `field-${normalizeCode(code)}`;
}

function for2FromFor4(code: string | number): string {
  const digits = normalizeCode(code).replace(/\D/g, "");
  return digits.slice(0, 2);
}

function budgetFromField(field: OpportunityRow, months: number): number {
  const lengthFactor = Math.max(0.5, Math.min(2.5, months / 18));
  const base = (Number(field.AAU_total) || 0) * 0.0045 * lengthFactor;
  return Math.max(200_000, Math.min(6_000_000, base));
}

function budgetBasis(field: OpportunityRow, months: number) {
  const lengthFactor = Math.max(0.5, Math.min(2.5, months / 18));
  return {
    method: "Field-level historical AAU funding signal (2020-2024 aggregate) with project-length scaling.",
    base_field_aau_total: Number(field.AAU_total) || 0,
    length_factor: lengthFactor,
    note: "Uses aggregated historical field funding, not individual project-level grant records.",
  };
}

function timingWindowFromForecast(forecast2026: number, growthRate: number): string {
  if (forecast2026 > 200_000_000 || growthRate > 0.75) return "6-12 months";
  if (forecast2026 > 50_000_000 || growthRate > 0.2) return "9-15 months";
  return "12-24 months";
}

function deriveRiskFlags(remainingNeed: number, field: OpportunityRow, funders: FunderRecommendation[]): string[] {
  const flags: string[] = [];
  if (remainingNeed > 3_000_000) flags.push("Large uncovered budget remains after current funding.");
  if ((field.under_target_gap ?? 0) > 0.03) flags.push("CMU appears under-targeted in this field relative to external funding.");
  if ((funders[0]?.cmu_win_probability ?? 0) < 0.35) flags.push("Top funder likelihood is currently low; broaden the proposal set.");
  if (funders.length < 3) flags.push("Limited funder diversity for this field.");
  return flags;
}

/**
 * Aggregate sankey rows for a list of FOR4 codes into a ranked funder list.
 * Each code can carry an optional weight (defaults to 1.0).
 */
function aggregateFundersFromCodes(
  sankey: SankeyRow[],
  weightedCodes: Array<{ code: string; weight: number }>,
): Array<{ funder: string; flow: number; cmuTotal: number }> {
  const agg = new Map<string, { flow: number; cmuTotal: number }>();

  for (const { code, weight } of weightedCodes) {
    const w = Math.max(0, weight);
    const rows = sankey.filter((r) => normalizeCode(r.FOR4_CODE) === code);
    for (const r of rows) {
      const key = r.source || "Unknown funder";
      const prev = agg.get(key) ?? { flow: 0, cmuTotal: 0 };
      prev.flow += Number(r.value || 0) * w;
      prev.cmuTotal += Number(r.cmu_field_total || 0) * w;
      agg.set(key, prev);
    }
  }

  return [...agg.entries()]
    .map(([funder, m]) => ({ funder, ...m }))
    .sort((a, b) => b.flow + b.cmuTotal - (a.flow + a.cmuTotal))
    .slice(0, 6);
}

export async function loadDecisionContext() {
  const [opportunity, forecast, sankey, neighbors, forTaxonomy] = await Promise.all([
    readModelArtifact<OpportunityRow[]>("opportunity_scores_v1.json"),
    readModelArtifact<ForecastRow[]>("forecast_v1.json"),
    readDataArtifact<SankeyRow[]>("sankey.json"),
    readModelArtifact<SimilarityNeighborRow[]>("similarity_neighbors_v1.json"),
    readDataArtifact<ForTaxonomyArtifact>("for_taxonomy_v1.json"),
  ]);

  const campuses = [
    { code: "grid.147455.6", label: "CMU Pittsburgh Main Campus" },
    { code: "grid.448660.8", label: "CMU Software Engineering Institute" },
    { code: "grid.452171.4", label: "CMU Silicon Valley" },
    { code: "grid.484692.5", label: "CMU Robotics Institute Unit" },
    { code: "grid.508475.b", label: "CMU Heinz/Policy Unit" },
    { code: "grid.509981.c", label: "CMU Qatar / Global Unit" },
    { code: "grid.512173.3", label: "CMU Africa / Global Unit" },
  ];

  return { opportunity, forecast, sankey, campuses, neighbors, forTaxonomy };
}

export async function runResearcherDecision(request: DecisionRequest) {
  const { opportunity, forecast, sankey, neighbors, forTaxonomy } = await loadDecisionContext();

  const code = normalizeCode(request.for4_code);
  const targetGrantId = codeToGrantId(code);

  const field = opportunity.find((r) => normalizeCode(r.FOR4_CODE) === code);
  if (!field) throw new Error("Unknown FOR4 code.");
  const for2ByFor4 = new Map(
    (forTaxonomy.records || []).map((r) => [normalizeCode(r.for4_code), normalizeCode(r.for2_code)]),
  );

  const months = Number(request.project_length_months || 12);
  const recommendedMid = budgetFromField(field, months);
  const basis = budgetBasis(field, months);
  const subjectTotal = (request.subject_allocations || []).reduce((acc, s) => acc + Math.max(0, Number(s.amount || 0)), 0);
  const recommendedMidAdjusted = Math.max(recommendedMid, subjectTotal);
  const recommendedLow = Math.round(recommendedMidAdjusted * 0.7);
  const recommendedHigh = Math.round(recommendedMidAdjusted * 1.4);
  const selectedBudget =
    request.budget_mode === "manual" && Number(request.requested_budget) > 0
      ? Number(request.requested_budget)
      : Math.round(recommendedMidAdjusted);
  const alreadyReceived = Math.max(0, Number(request.already_received || 0));
  const remainingNeed = Math.max(0, Math.round(selectedBudget - alreadyReceived));

  const fieldForecast = forecast
    .filter((r) => normalizeCode(r.FOR4_CODE) === code && Number(r.year) === 2026)
    .sort((a, b) => (Number(b.aau_forecast) || 0) - (Number(a.aau_forecast) || 0))[0];
  const forecast2026 = Number(fieldForecast?.aau_forecast || 0);

  // ── Step 1: Direct field sankey lookup ──────────────────────────────────────
  const directFunders = aggregateFundersFromCodes(sankey, [{ code, weight: 1.0 }]);

  let sortedFunders = directFunders;
  let funderDataMode: FunderRecommendation["source_type"] = "field_observed";
  let funderFallbackNote = "";
  let neighborNamesUsed: string[] = [];

  // ── Step 2: Precomputed neighbor fallback ────────────────────────────────────
  // Triggered when direct data is sparse (< 3 funders).
  if (sortedFunders.length < 3) {
    const precomputedNeighbors = neighbors
      .filter(
        (n) =>
          n.grant_id === targetGrantId &&
          Number(n.similarity ?? 0) >= 0.15,
      )
      .sort((a, b) => Number(b.similarity) - Number(a.similarity))
      .slice(0, 10);

    if (precomputedNeighbors.length > 0) {
      const weightedCodes = precomputedNeighbors.map((n) => ({
        // FIX: strip the "field-" prefix so the code matches sankey FOR4_CODE values
        code: grantIdToCode(n.neighbor_grant_id),
        // Square the similarity to up-weight close matches and down-weight weak ones
        weight: Math.max(0.02, Number(n.similarity) ** 2),
      }));

      const neighborFunders = aggregateFundersFromCodes(sankey, weightedCodes);

      if (neighborFunders.length > 0) {
        // Blend: keep any direct rows, then fill from neighbors
        const existing = new Set(sortedFunders.map((f) => f.funder));
        const blended = [...sortedFunders];
        for (const f of neighborFunders) {
          if (!existing.has(f.funder)) blended.push(f);
        }
        sortedFunders = blended
          .sort((a, b) => b.flow + b.cmuTotal - (a.flow + a.cmuTotal))
          .slice(0, 6);

        funderDataMode = "similar_field_fallback";
        neighborNamesUsed = precomputedNeighbors
          .slice(0, 4)
          .map((n) => n.neighbor_for4_name ?? grantIdToCode(n.neighbor_grant_id));
        funderFallbackNote = `Used precomputed similar-field neighbors: ${neighborNamesUsed.join(", ")}.`;
      }
    }
  }

  // ── Step 3: Coordinate-space fallback ────────────────────────────────────────
  // Triggered when direct and precomputed similar-field links are sparse.
  // Uses sibling FOR4 fields under the same FOR2 and weights by historical AAU totals.
  if (sortedFunders.length < 3) {
    const targetFor2 = for2ByFor4.get(code) || for2FromFor4(code);
    const siblings = opportunity
      .filter((r) => {
        const siblingCode = normalizeCode(r.FOR4_CODE);
        const siblingFor2 = for2ByFor4.get(siblingCode) || for2FromFor4(siblingCode);
        return siblingCode !== code && siblingFor2 === targetFor2;
      })
      .map((r) => ({
        code: normalizeCode(r.FOR4_CODE),
        name: r.FOR4_NAME,
        aauTotal: Math.max(0, Number(r.AAU_total || 0)),
      }))
      .sort((a, b) => b.aauTotal - a.aauTotal)
      .slice(0, 12);

    if (siblings.length > 0) {
      const siblingTotal = siblings.reduce((acc, s) => acc + s.aauTotal, 0);
      const weightedCodes = siblings.map((s) => ({
        code: s.code,
        weight: siblingTotal > 0 ? s.aauTotal / siblingTotal : 1 / siblings.length,
      }));
      const siblingFunders = aggregateFundersFromCodes(sankey, weightedCodes);

      if (siblingFunders.length > 0) {
        const existing = new Set(sortedFunders.map((f) => f.funder));
        const blended = [...sortedFunders];
        for (const f of siblingFunders) {
          if (!existing.has(f.funder)) blended.push(f);
        }
        sortedFunders = blended
          .sort((a, b) => b.flow + b.cmuTotal - (a.flow + a.cmuTotal))
          .slice(0, 6);

        funderDataMode = "similar_field_fallback";
        neighborNamesUsed = siblings.slice(0, 4).map((s) => s.name);
        funderFallbackNote = `No direct/similarity links were sufficient. Used FOR2 sibling fallback (${targetFor2}xx) weighted by historical AAU totals from: ${neighborNamesUsed.join(", ")}.`;
      }
    }
  }

  // ── Step 4: Hard baseline — last resort only ─────────────────────────────────
  // Step 4: Global all-field fallback (CMU + AAU signal)
  if (sortedFunders.length < 3) {
    const globalAgg = new Map<string, { flow: number; cmuTotal: number }>();
    for (const row of sankey) {
      const key = row.source || "Unknown funder";
      const prev = globalAgg.get(key) ?? { flow: 0, cmuTotal: 0 };
      prev.flow += Number(row.value || 0);
      prev.cmuTotal += Number(row.cmu_field_total || 0);
      globalAgg.set(key, prev);
    }

    const globalTop = [...globalAgg.entries()]
      .map(([funder, m]) => ({ funder, ...m }))
      .sort((a, b) => b.flow + b.cmuTotal - (a.flow + a.cmuTotal))
      .slice(0, 6);

    if (globalTop.length > 0) {
      const existing = new Set(sortedFunders.map((f) => f.funder));
      const blended = [...sortedFunders];
      for (const f of globalTop) {
        if (!existing.has(f.funder)) blended.push(f);
      }
      sortedFunders = blended
        .sort((a, b) => b.flow + b.cmuTotal - (a.flow + a.cmuTotal))
        .slice(0, 6);

      funderDataMode = "global_fallback";
      funderFallbackNote =
        "Used global fallback from all fields (combined AAU flow + CMU historical presence) because direct/similar/FOR2 sibling evidence was sparse.";
    }
  }

  if (sortedFunders.length === 0) {
    const baseline = [
      "NSF",
      "NIH",
      "Department of Energy",
      "Department of Defense",
      "Private Foundations",
      "Industry Partnerships",
    ];
    sortedFunders = baseline.map((f, i) => ({
      funder: f,
      flow: Math.max(1, 100 - i * 10),
      cmuTotal: Math.max(1, 60 - i * 8),
    }));
    funderDataMode = "baseline_fallback";
    funderFallbackNote =
      "No direct field, similar-field, FOR2 sibling, or global historical links were available. Using baseline funder priors.";
  }

  // ── Score and shape funder recommendations ───────────────────────────────────
  const topFlow = sortedFunders[0]?.flow || 1;
  const topCmu = Math.max(1, ...sortedFunders.map((f) => f.cmuTotal));
  const timing = timingWindowFromForecast(forecast2026, Number(field.growth_rate || 0));

  const funders: FunderRecommendation[] = sortedFunders.map((f) => {
    const fit = clamp01(f.flow / topFlow);
    const cmuPresence = clamp01(Math.log1p(f.cmuTotal) / Math.log1p(topCmu));
    const gapPenalty = clamp01(Number(field.under_target_gap || 0) * 6);
    const winFloor = clamp01(0.12 + 0.12 * cmuPresence + 0.08 * clamp01(Number(field.opportunity_score_v1 || 0)));
    const win = Math.max(winFloor, clamp01(0.2 + 0.45 * fit + 0.25 * cmuPresence - 0.2 * gapPenalty));
    const expected = Math.round(Math.min(Math.max(80_000, f.flow * 0.25), Math.max(120_000, remainingNeed * 0.7)));
    return {
      funder_name: f.funder,
      expected_award_amount: expected,
      award_timing_window: timing,
      cmu_win_probability: win,
      fit_score: fit,
      source_type: funderDataMode,
    };
  });

  const topFunders = funders.slice(0, 5);
  const riskFlags = deriveRiskFlags(remainingNeed, field, topFunders);

  const grantPlan = topFunders.slice(0, 3).map((f, i) => ({
    phase: i + 1,
    target_funder: f.funder_name,
    why: `Fit ${Math.round(f.fit_score * 100)}% | Win probability ${Math.round(f.cmu_win_probability * 100)}%`,
    suggested_action: i === 0 ? "Submit primary proposal" : i === 1 ? "Submit backup in parallel" : "Hold as contingency",
  }));

  // Direct sankey row count — useful for debugging fallback triggers
  const directSankeyRows = sankey.filter((r) => normalizeCode(r.FOR4_CODE) === code).length;

  return {
    request,
    summary: {
      field_code: code,
      field_name: field.FOR4_NAME,
      opportunity_score: Number(field.opportunity_score_v1 || 0),
      growth_rate: Number(field.growth_rate || 0),
      under_target_gap: Number(field.under_target_gap || 0),
      forecast_2026: forecast2026,
    },
    budget: {
      mode: request.budget_mode,
      recommended_low: recommendedLow,
      recommended_mid: Math.round(recommendedMidAdjusted),
      recommended_high: recommendedHigh,
      selected_budget: Math.round(selectedBudget),
      already_received: Math.round(alreadyReceived),
      remaining_need: remainingNeed,
      subject_allocation_total: Math.round(subjectTotal),
      subject_allocations: request.subject_allocations || [],
      basis,
    },
    top_funders: topFunders,
    risk_flags: riskFlags,
    grant_plan: grantPlan,
    likelihood_context: {
      funder_data_mode: funderDataMode,
      fallback_note: funderFallbackNote,
      neighbors_used: neighborNamesUsed,
      field_funder_links_found: directSankeyRows,
    },
  };
}

export async function runAdminDecision(payload: {
  planning_horizon_months: number;
  portfolio: DecisionRequest[];
  current_funding?: number;
}) {
  const projects = await Promise.all(payload.portfolio.map((p) => runResearcherDecision(p)));
  const ranked = projects
    .map((p) => {
      const expectedInflow = p.top_funders.reduce(
        (acc, f) => acc + f.expected_award_amount * f.cmu_win_probability,
        0,
      );
      const priorityScore =
        p.budget.remaining_need *
        (1 + Math.max(0, p.summary.under_target_gap)) *
        (1 + Math.max(0, p.summary.growth_rate));
      return {
        field_code: p.summary.field_code,
        field_name: p.summary.field_name,
        remaining_need: p.budget.remaining_need,
        expected_inflow: Math.round(expectedInflow),
        priority_score: Math.round(priorityScore),
        top_funder: p.top_funders[0]?.funder_name ?? "N/A",
        top_funder_probability: p.top_funders[0]?.cmu_win_probability ?? 0,
      };
    })
    .sort((a, b) => b.priority_score - a.priority_score);

  const totalNeed = ranked.reduce((acc, r) => acc + r.remaining_need, 0);
  const expectedInflow = ranked.reduce((acc, r) => acc + r.expected_inflow, 0);
  const coverageRatio = totalNeed > 0 ? expectedInflow / totalNeed : 0;

  return {
    planning_horizon_months: payload.planning_horizon_months,
    projects_analyzed: ranked.length,
    total_remaining_need: Math.round(totalNeed),
    expected_funding_inflow: Math.round(expectedInflow),
    coverage_ratio: coverageRatio,
    current_funding: Math.round(Number(payload.current_funding || 0)),
    portfolio_rankings: ranked,
    portfolio_actions: ranked.slice(0, 3).map((r, i) => ({
      rank: i + 1,
      action: `Prioritize ${r.field_name} outreach to ${r.top_funder}`,
      rationale: `Need ${r.remaining_need.toLocaleString()} | Expected inflow ${r.expected_inflow.toLocaleString()}`,
    })),
  };
}
