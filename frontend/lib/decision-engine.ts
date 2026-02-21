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
  similarity: number;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function normalizeCode(code: string | number | undefined | null): string {
  return String(code ?? "").trim();
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

export async function loadDecisionContext() {
  const [opportunity, forecast, sankey, neighbors] = await Promise.all([
    readModelArtifact<OpportunityRow[]>("opportunity_scores_v1.json"),
    readModelArtifact<ForecastRow[]>("forecast_v1.json"),
    readDataArtifact<SankeyRow[]>("sankey.json"),
    readModelArtifact<SimilarityNeighborRow[]>("similarity_neighbors_v1.json"),
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

  return { opportunity, forecast, sankey, campuses, neighbors };
}

export async function runResearcherDecision(request: DecisionRequest) {
  const { opportunity, forecast, sankey, neighbors } = await loadDecisionContext();

  const code = normalizeCode(request.for4_code);
  const field = opportunity.find((r) => normalizeCode(r.FOR4_CODE) === code);
  if (!field) throw new Error("Unknown FOR4 code.");

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

  const funderRows = sankey.filter((r) => normalizeCode(r.FOR4_CODE) === code);
  const funderAgg = new Map<string, { flow: number; cmuTotal: number }>();
  for (const r of funderRows) {
    const key = r.source || "Unknown funder";
    const prev = funderAgg.get(key) || { flow: 0, cmuTotal: 0 };
    prev.flow += Number(r.value || 0);
    prev.cmuTotal += Number(r.cmu_field_total || 0);
    funderAgg.set(key, prev);
  }
  let sortedFunders = [...funderAgg.entries()]
    .map(([funder, m]) => ({ funder, ...m }))
    .sort((a, b) => b.flow - a.flow)
    .slice(0, 6);
  let funderDataMode: "field_observed" | "similar_field_fallback" | "global_fallback" | "baseline_fallback" = "field_observed";
  let funderFallbackNote = "";

  // Similar-field fallback first (preferred over global fallback)
  if (sortedFunders.length < 3) {
    const thisGrantId = `field-${code}`;
    const similar = neighbors
      .filter((n) => n.grant_id === thisGrantId && Number(n.similarity || 0) > 0)
      .sort((a, b) => Number(b.similarity || 0) - Number(a.similarity || 0))
      .slice(0, 5);

    const similarCodes = similar
      .map((s) => String(s.neighbor_grant_id || "").replace("field-", "").trim())
      .filter(Boolean);

    if (similarCodes.length > 0) {
      const simWeights = new Map<string, number>();
      for (const s of similar) {
        const c = String(s.neighbor_grant_id || "").replace("field-", "").trim();
        simWeights.set(c, Number(s.similarity || 0));
      }

      const similarRows = sankey.filter((r) => similarCodes.includes(normalizeCode(r.FOR4_CODE)));
      const simAgg = new Map<string, { flow: number; cmuTotal: number }>();
      for (const r of similarRows) {
        const fieldCode = normalizeCode(r.FOR4_CODE);
        const w = Math.max(0.15, Number(simWeights.get(fieldCode) || 0.25));
        const key = r.source || "Unknown funder";
        const prev = simAgg.get(key) || { flow: 0, cmuTotal: 0 };
        prev.flow += Number(r.value || 0) * w;
        prev.cmuTotal += Number(r.cmu_field_total || 0) * w;
        simAgg.set(key, prev);
      }

      const simTop = [...simAgg.entries()]
        .map(([funder, m]) => ({ funder, ...m }))
        .sort((a, b) => b.flow - a.flow)
        .slice(0, 6);

      const existing = new Set(sortedFunders.map((f) => f.funder));
      let added = 0;
      for (const s of simTop) {
        if (!existing.has(s.funder)) {
          sortedFunders.push(s);
          added += 1;
        }
        if (sortedFunders.length >= 6) break;
      }

      if (added > 0) {
        funderDataMode = "similar_field_fallback";
        funderFallbackNote = `Used similar-field fallback from ${similarCodes.slice(0, 3).join(", ")} before global fallback.`;
      }
    }
  }

  // Fallback when field-specific links are sparse: use broad historical CMU-active funders
  if (sortedFunders.length < 3) {
    const global = new Map<string, { flow: number; cmuTotal: number }>();
    for (const r of sankey) {
      const key = r.source || "Unknown funder";
      const prev = global.get(key) || { flow: 0, cmuTotal: 0 };
      prev.flow += Number(r.value || 0);
      prev.cmuTotal += Number(r.cmu_field_total || 0);
      global.set(key, prev);
    }
    const globalTop = [...global.entries()]
      .map(([funder, m]) => ({ funder, ...m }))
      .sort((a, b) => (b.flow + b.cmuTotal) - (a.flow + a.cmuTotal))
      .slice(0, 8);
    const existing = new Set(sortedFunders.map((f) => f.funder));
    let added = 0;
    for (const g of globalTop) {
      if (!existing.has(g.funder)) {
        sortedFunders.push(g);
        added += 1;
      }
      if (sortedFunders.length >= 6) break;
    }
    if (added > 0) {
      funderDataMode = "global_fallback";
      if (!funderFallbackNote) {
        funderFallbackNote = "Used global AAU/CMU historical funder activity because field-specific funder links were sparse.";
      } else {
        funderFallbackNote += " Added global AAU/CMU historical funders to fill remaining slots.";
      }
    }
  }

  // Hard fallback: if still sparse (e.g. missing sankey data), provide baseline plausible funders.
  if (sortedFunders.length === 0) {
    const baseline = ["NSF", "NIH", "Department of Defense", "DARPA", "Private Foundations"];
    sortedFunders = baseline.map((f, i) => ({
      funder: f,
      flow: Math.max(1, 100 - i * 10),
      cmuTotal: Math.max(1, 60 - i * 8),
    }));
    funderDataMode = "baseline_fallback";
    funderFallbackNote = "Used baseline funder priors because no historical field/funder link data was available in loaded artifacts.";
  }

  const topFlow = sortedFunders[0]?.flow || 1;
  const topCmu = Math.max(1, ...sortedFunders.map((f) => f.cmuTotal));
  const timing = timingWindowFromForecast(forecast2026, Number(field.growth_rate || 0));

  const funders: FunderRecommendation[] = sortedFunders.map((f) => {
    const fit = clamp01(f.flow / topFlow);
    const cmuPresence = clamp01(Math.log1p(f.cmuTotal) / Math.log1p(topCmu));
    const gapPenalty = clamp01(Number(field.under_target_gap || 0) * 6);
    // Keep a realistic non-zero floor based on CMU historical presence + field momentum
    const winFloor = clamp01(0.12 + 0.12 * cmuPresence + 0.08 * clamp01(Number(field.opportunity_score_v1 || 0)));
    const win = Math.max(winFloor, clamp01(0.2 + 0.45 * fit + 0.25 * cmuPresence - 0.2 * gapPenalty));
    const expected = Math.round(Math.min(Math.max(80_000, f.flow * 0.25), Math.max(120_000, remainingNeed * 0.7)));
    return {
      funder_name: f.funder,
      expected_award_amount: expected,
      award_timing_window: timing,
      cmu_win_probability: win,
      fit_score: fit,
      source_type: funderDataMode === "field_observed" ? "field_observed" : funderDataMode,
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
      field_funder_links_found: funderRows.length,
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
