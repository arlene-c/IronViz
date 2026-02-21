"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactUsd, formatPercent } from "@/lib/format";

type Role = "admin" | "research";
type FieldOption = { code: string; name: string; opportunity_score: number };
type CampusOption = { code: string; label: string };

type ResearcherResult = {
  summary: {
    field_code: string;
    field_name: string;
    opportunity_score: number;
    under_target_gap?: number;
  };
  budget: {
    mode: "manual" | "auto";
    recommended_low: number;
    recommended_mid: number;
    recommended_high: number;
    selected_budget: number;
    already_received: number;
    remaining_need: number;
  };
  top_funders: Array<{
    funder_name: string;
    expected_award_amount: number;
    award_timing_window: string;
    cmu_win_probability: number;
    fit_score: number;
  }>;
  risk_flags: string[];
};

type AdminResult = {
  projects_analyzed: number;
  total_remaining_need: number;
  expected_funding_inflow: number;
  coverage_ratio: number;
  portfolio_rankings: Array<{
    field_code: string;
    field_name: string;
    remaining_need: number;
    expected_inflow: number;
    priority_score: number;
    top_funder: string;
    top_funder_probability: number;
  }>;
  portfolio_actions: Array<{ rank: number; action: string; rationale: string }>;
};

type SavedIdea = {
  id: string;
  created_at: string;
  idea_text: string;
  field_code: string;
  field_name: string;
  campus_code: string;
  project_length_months: number;
  budget_mode: "manual" | "auto";
  requested_budget?: number;
  already_received?: number;
  result?: ResearcherResult;
};

type PortfolioProject = {
  id: string;
  idea_text: string;
  field_code: string;
  field_name?: string;
  campus_code: string;
  project_length_months: number;
  budget_mode: "manual" | "auto";
  requested_budget?: number;
  already_received?: number;
};

const SAVED_IDEAS_KEY = "ironviz_saved_ideas_v1";

function HelpTip({ text }: { text: string }) {
  return (
    <span
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-700 cursor-help"
      title={text}
    >
      ?
    </span>
  );
}

function likelihoodReason(prob: number, fit: number) {
  if (prob >= 0.65) return "High likelihood: strong fit + historical momentum.";
  if (prob >= 0.4) return "Moderate likelihood: viable fit but competitive.";
  if (fit < 0.45) return "Low likelihood: weak field-funder fit.";
  return "Low likelihood: CMU has limited historical strength here.";
}

type Props = { role: Role };

export default function DecisionAssistant({ role }: Props) {
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Researcher form
  const [ideaText, setIdeaText] = useState("");
  const [campusCode, setCampusCode] = useState("");
  const [fieldCode, setFieldCode] = useState("");
  const [lengthMonths, setLengthMonths] = useState(24);
  const [budgetMode, setBudgetMode] = useState<"manual" | "auto">("auto");
  const [requestedBudget, setRequestedBudget] = useState<number>(0);
  const [alreadyReceived, setAlreadyReceived] = useState<number>(0);
  const [subjectAllocations, setSubjectAllocations] = useState<Array<{ area: string; amount: number }>>([
    { area: "", amount: 0 },
  ]);
  const [researcherResult, setResearcherResult] = useState<ResearcherResult | null>(null);

  // Admin controls
  const [adminCurrentFunding, setAdminCurrentFunding] = useState<number>(0);
  const [planningHorizon, setPlanningHorizon] = useState<number>(18);
  const [portfolio, setPortfolio] = useState<PortfolioProject[]>([]);
  const [adminResult, setAdminResult] = useState<AdminResult | null>(null);
  const [quickProject, setQuickProject] = useState<PortfolioProject>({
    id: "",
    idea_text: "",
    field_code: "",
    campus_code: "",
    project_length_months: 24,
    budget_mode: "auto",
    requested_budget: 0,
    already_received: 0,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/decision/options", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!mounted) return;
        const fieldList = Array.isArray(json.fields) ? json.fields : [];
        const campusList = Array.isArray(json.campuses) ? json.campuses : [];
        setFields(fieldList);
        setCampuses(campusList);
        setFieldCode(fieldList[0]?.code || "");
        setCampusCode(campusList[0]?.code || "");
        setQuickProject((prev) => ({
          ...prev,
          field_code: fieldList[0]?.code || "",
          campus_code: campusList[0]?.code || "",
        }));
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load options");
      } finally {
        if (mounted) setLoadingOptions(false);
      }
    })();

    try {
      const raw = localStorage.getItem(SAVED_IDEAS_KEY);
      if (raw) setSavedIdeas(JSON.parse(raw));
    } catch {
      // ignore local parse errors
    }

    return () => {
      mounted = false;
    };
  }, []);

  const selectedField = useMemo(() => fields.find((f) => f.code === fieldCode), [fields, fieldCode]);

  const persistSavedIdeas = (ideas: SavedIdea[]) => {
    setSavedIdeas(ideas);
    localStorage.setItem(SAVED_IDEAS_KEY, JSON.stringify(ideas));
  };

  const runResearcher = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/decision/researcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea_text: ideaText,
          cmu_campus_code: campusCode,
          for4_code: fieldCode,
          project_length_months: lengthMonths,
          budget_mode: budgetMode,
          requested_budget: budgetMode === "manual" ? requestedBudget : undefined,
          already_received: alreadyReceived,
          subject_allocations: subjectAllocations.filter((s) => s.area && Number(s.amount) > 0),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResearcherResult(json.result ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision run failed");
    } finally {
      setRunning(false);
    }
  };

  const saveCurrentIdea = () => {
    const item: SavedIdea = {
      id: `${Date.now()}`,
      created_at: new Date().toISOString(),
      idea_text: ideaText || "Untitled research idea",
      field_code: fieldCode,
      field_name: selectedField?.name || fieldCode,
      campus_code: campusCode,
      project_length_months: lengthMonths,
      budget_mode: budgetMode,
      requested_budget: budgetMode === "manual" ? requestedBudget : undefined,
      already_received: alreadyReceived,
      result: researcherResult ?? undefined,
    };
    persistSavedIdeas([item, ...savedIdeas].slice(0, 100));
  };

  const addInboxIdeaToPortfolio = (idea: SavedIdea) => {
    setPortfolio((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        idea_text: idea.idea_text,
        field_code: idea.field_code,
        field_name: idea.field_name,
        campus_code: idea.campus_code,
        project_length_months: idea.project_length_months,
        budget_mode: idea.budget_mode,
        requested_budget: idea.requested_budget,
        already_received: idea.already_received,
      },
    ]);
  };

  const addQuickProject = () => {
    if (!quickProject.field_code || !quickProject.campus_code) return;
    const fieldName = fields.find((f) => f.code === quickProject.field_code)?.name || quickProject.field_code;
    setPortfolio((prev) => [
      ...prev,
      { ...quickProject, id: `${Date.now()}-${Math.random()}`, field_name: fieldName, idea_text: quickProject.idea_text || fieldName },
    ]);
    setQuickProject((prev) => ({ ...prev, idea_text: "", requested_budget: 0, already_received: 0 }));
  };

  const removePortfolioProject = (id: string) => {
    setPortfolio((prev) => prev.filter((p) => p.id !== id));
  };

  const runAdmin = async () => {
    setRunning(true);
    setError(null);
    try {
      const payload = portfolio.map((p) => ({
        idea_text: p.idea_text || "Portfolio project",
        cmu_campus_code: p.campus_code,
        for4_code: p.field_code,
        project_length_months: p.project_length_months,
        budget_mode: p.budget_mode,
        requested_budget: p.budget_mode === "manual" ? p.requested_budget : undefined,
        already_received: p.already_received ?? 0,
      }));
      const res = await fetch("/api/decision/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planning_horizon_months: planningHorizon,
          current_funding: adminCurrentFunding,
          portfolio: payload,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAdminResult(json.result ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Admin decision run failed");
    } finally {
      setRunning(false);
    }
  };

  const updateAllocation = (idx: number, patch: Partial<{ area: string; amount: number }>) => {
    setSubjectAllocations((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const adminInboxItems = useMemo(() => {
    const withRaw = savedIdeas.map((idea) => {
      const remaining = Number(idea.result?.budget.remaining_need || idea.requested_budget || 0);
      const opp = Number(idea.result?.summary.opportunity_score || 0.2);
      const raw = remaining * (1 + opp);
      return { ...idea, urgency_raw: raw };
    });
    const max = Math.max(1, ...withRaw.map((x) => x.urgency_raw));
    return withRaw
      .map((x) => ({ ...x, urgency_percent: Math.round((x.urgency_raw / max) * 100) }))
      .sort((a, b) => b.urgency_percent - a.urgency_percent);
  }, [savedIdeas]);

  const coverageData = useMemo(() => {
    if (!adminResult) return [];
    const covered = Math.min(adminResult.total_remaining_need, adminResult.expected_funding_inflow);
    const gap = Math.max(0, adminResult.total_remaining_need - covered);
    return [
      { name: "Covered", value: covered, color: "#16a34a" },
      { name: "Gap", value: gap, color: "#ef4444" },
    ];
  }, [adminResult]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold">{role === "research" ? "Researcher Decision Assistant" : "Admin Decision Assistant"}</h1>
        <p className="text-sm text-gray-600 mt-1">
          {role === "research"
            ? "Submit ideas, estimate funding, and save ideas for admin."
            : "Review inbox ideas, build one portfolio list, then run funding plan."}
        </p>
        {loadingOptions && <p className="text-sm text-gray-500 mt-2">Loading options...</p>}
        {error && <p className="text-sm text-red-600 mt-2">Error: {error}</p>}
      </div>

      {role === "research" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 bg-white p-6 rounded shadow space-y-3">
            <h2 className="font-semibold text-lg">Idea Form</h2>
            <label className="text-sm text-gray-700">Idea description<HelpTip text="Write 1-3 sentences about the project scope and goal." />
              <textarea className="w-full border rounded p-2 text-sm mt-1" rows={4} value={ideaText} onChange={(e) => setIdeaText(e.target.value)} />
            </label>
            <label className="text-sm text-gray-700">CMU campus<HelpTip text="Campus affects historical likelihood and capacity signals." />
              <select className="w-full border rounded p-2 text-sm mt-1" value={campusCode} onChange={(e) => setCampusCode(e.target.value)}>
                {campuses.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
              </select>
            </label>
            <label className="text-sm text-gray-700">Research field<HelpTip text="Pick the closest FOR4 field; this drives model matching." />
              <select className="w-full border rounded p-2 text-sm mt-1" value={fieldCode} onChange={(e) => setFieldCode(e.target.value)}>
                {fields.map((f) => (<option key={f.code} value={f.code}>{f.name}</option>))}
              </select>
            </label>
            <label className="text-sm text-gray-700">Project length (months)
              <input className="w-full border rounded p-2 text-sm mt-1" type="number" min={6} max={60} value={lengthMonths} onChange={(e) => setLengthMonths(Number(e.target.value || 24))} />
            </label>
            <div className="text-sm">
              <p className="text-gray-700">Budget mode<HelpTip text="Use generated estimate or override with your own requested budget." /></p>
              <div className="flex gap-3 mt-1">
                <label><input type="radio" checked={budgetMode === "auto"} onChange={() => setBudgetMode("auto")} /> Generated</label>
                <label><input type="radio" checked={budgetMode === "manual"} onChange={() => setBudgetMode("manual")} /> Manual</label>
              </div>
            </div>
            {budgetMode === "manual" && (
              <label className="text-sm text-gray-700">Manual requested budget (USD)
                <input className="w-full border rounded p-2 text-sm mt-1" type="number" min={0} value={requestedBudget} onChange={(e) => setRequestedBudget(Number(e.target.value || 0))} />
              </label>
            )}
            <label className="text-sm text-gray-700">Already received (USD)
              <input className="w-full border rounded p-2 text-sm mt-1" type="number" min={0} value={alreadyReceived} onChange={(e) => setAlreadyReceived(Number(e.target.value || 0))} />
            </label>
            <div className="border rounded p-2 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Subject allocations<HelpTip text="Optional breakdown by subject area; helps constrain budget recommendations." /></p>
              {subjectAllocations.map((a, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2">
                  <input className="border rounded p-1 text-xs" placeholder="Subject area" value={a.area} onChange={(e) => updateAllocation(idx, { area: e.target.value })} />
                  <input className="border rounded p-1 text-xs" type="number" min={0} placeholder="USD" value={a.amount} onChange={(e) => updateAllocation(idx, { amount: Number(e.target.value || 0) })} />
                </div>
              ))}
              <button className="text-xs border rounded px-2 py-1" onClick={() => setSubjectAllocations((prev) => [...prev, { area: "", amount: 0 }])}>+ Add row</button>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 bg-blue-600 text-white rounded p-2 text-sm disabled:opacity-60" onClick={runResearcher} disabled={running || !fieldCode || !campusCode}>{running ? "Running..." : "Run"}</button>
              <button className="flex-1 border rounded p-2 text-sm" onClick={saveCurrentIdea} disabled={!fieldCode || !campusCode}>Save Idea</button>
            </div>
          </div>

          <div className="xl:col-span-2 grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Field</p><p className="font-semibold">{selectedField?.name || "-"}</p></div>
              <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Opportunity</p><p className="font-semibold">{(researcherResult?.summary.opportunity_score || selectedField?.opportunity_score || 0).toFixed(3)}</p></div>
              <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Selected Budget</p><p className="font-semibold">{formatCompactUsd(researcherResult?.budget.selected_budget || 0)}</p></div>
              <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Remaining Need</p><p className="font-semibold">{formatCompactUsd(researcherResult?.budget.remaining_need || 0)}</p></div>
            </div>

            {researcherResult && (
              <>
                <div className="bg-white p-6 rounded shadow">
                  <h3 className="font-semibold mb-2">Funder Likelihood</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={researcherResult.top_funders}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="funder_name" hide />
                      <YAxis tickFormatter={(v) => formatPercent(Number(v))} />
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0]?.payload;
                        return (
                          <div className="bg-white border rounded p-2 text-xs shadow">
                            <p className="font-medium">{p.funder_name}</p>
                            <p>Win chance: {formatPercent(p.cmu_win_probability)}</p>
                            <p>{likelihoodReason(Number(p.cmu_win_probability || 0), Number(p.fit_score || 0))}</p>
                          </div>
                        );
                      }} />
                      <Bar dataKey="cmu_win_probability">
                        {researcherResult.top_funders.map((f, i) => (
                          <Cell key={i} fill={Number(f.cmu_win_probability) < 0.35 ? "#ef4444" : "#22c55e"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white p-6 rounded shadow">
                  <h3 className="font-semibold mb-2">Why funding may be unlikely</h3>
                  <ul className="text-sm list-disc pl-5 space-y-1">
                    {researcherResult.top_funders.slice(0, 3).map((f) => (
                      <li key={f.funder_name}>
                        <span className="font-medium">{f.funder_name}:</span> {likelihoodReason(f.cmu_win_probability, f.fit_score)}
                      </li>
                    ))}
                    {researcherResult.risk_flags.map((r) => (<li key={r}>{r}</li>))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {role === "admin" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 bg-white p-6 rounded shadow space-y-3">
            <h2 className="font-semibold text-lg">Admin Controls</h2>
            <label className="text-sm text-gray-700">Current funding (USD)<HelpTip text="Total funds currently available to cover portfolio gaps." />
              <input className="w-full border rounded p-2 text-sm mt-1" type="number" min={0} value={adminCurrentFunding} onChange={(e) => setAdminCurrentFunding(Number(e.target.value || 0))} />
            </label>
            <label className="text-sm text-gray-700">Planning horizon (months)<HelpTip text="Window for expected grant inflow and sequencing decisions." />
              <input className="w-full border rounded p-2 text-sm mt-1" type="number" min={6} max={48} value={planningHorizon} onChange={(e) => setPlanningHorizon(Number(e.target.value || 18))} />
            </label>

            <div className="border rounded p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Add project to portfolio<HelpTip text="One place to add projects. Use Inbox or quick form below." /></p>
              <input className="w-full border rounded p-2 text-sm" placeholder="Project title/description" value={quickProject.idea_text} onChange={(e) => setQuickProject((p) => ({ ...p, idea_text: e.target.value }))} />
              <select className="w-full border rounded p-2 text-sm" value={quickProject.field_code} onChange={(e) => setQuickProject((p) => ({ ...p, field_code: e.target.value }))}>
                <option value="">Select field...</option>
                {fields.slice(0, 100).map((f) => (<option key={f.code} value={f.code}>{f.name}</option>))}
              </select>
              <select className="w-full border rounded p-2 text-sm" value={quickProject.campus_code} onChange={(e) => setQuickProject((p) => ({ ...p, campus_code: e.target.value }))}>
                <option value="">Select campus...</option>
                {campuses.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded p-2 text-sm" type="number" min={6} max={60} placeholder="Months" value={quickProject.project_length_months} onChange={(e) => setQuickProject((p) => ({ ...p, project_length_months: Number(e.target.value || 24) }))} />
                <input className="border rounded p-2 text-sm" type="number" min={0} placeholder="Already received" value={quickProject.already_received || 0} onChange={(e) => setQuickProject((p) => ({ ...p, already_received: Number(e.target.value || 0) }))} />
              </div>
              <div className="flex gap-2">
                <button className="flex-1 border rounded p-2 text-sm" onClick={addQuickProject}>Add Project</button>
                <button className="flex-1 bg-blue-600 text-white rounded p-2 text-sm disabled:opacity-60" onClick={runAdmin} disabled={running || portfolio.length === 0}>{running ? "Running..." : "Run Plan"}</button>
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 grid grid-cols-1 gap-4">
            <div className="bg-white p-6 rounded shadow">
              <h3 className="font-semibold mb-2">Admin Inbox</h3>
              <p className="text-xs text-gray-600 mb-2">Urgency is shown as a percent relative to the highest-urgency submission in this inbox.</p>
              {adminInboxItems.length === 0 ? (
                <p className="text-sm text-gray-600">No saved ideas yet.</p>
              ) : (
                <div className="space-y-2">
                  {adminInboxItems.slice(0, 8).map((idea) => (
                    <div key={idea.id} className="border rounded p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{idea.field_name || idea.field_code}</p>
                          <p className="text-xs text-gray-600 mt-1">{idea.idea_text}</p>
                          <p className="text-xs text-gray-500 mt-1">Remaining: {formatCompactUsd(idea.result?.budget.remaining_need || idea.requested_budget || 0)}</p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-xs px-2 py-1 rounded ${idea.urgency_percent >= 70 ? "bg-red-100 text-red-700" : idea.urgency_percent >= 40 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}
                            title="Higher urgency % means this idea is more critical versus other inbox ideas."
                          >
                            Urgency {idea.urgency_percent}%
                          </p>
                          <button className="mt-2 text-xs border rounded px-2 py-1" onClick={() => addInboxIdeaToPortfolio(idea)}>Add to portfolio</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded shadow">
              <h3 className="font-semibold mb-2">Portfolio (single list used for planning)</h3>
              {portfolio.length === 0 ? (
                <p className="text-sm text-gray-600">No projects added yet.</p>
              ) : (
                <div className="space-y-2">
                  {portfolio.map((p) => (
                    <div key={p.id} className="border rounded p-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{p.idea_text || p.field_name || p.field_code}</p>
                        <p className="text-xs text-gray-600">{p.field_name || p.field_code} | {p.project_length_months} months | received {formatCompactUsd(p.already_received || 0)}</p>
                      </div>
                      <button className="text-xs border rounded px-2 py-1" onClick={() => removePortfolioProject(p.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {adminResult && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Projects</p><p className="font-semibold">{adminResult.projects_analyzed}</p></div>
                  <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Need</p><p className="font-semibold">{formatCompactUsd(adminResult.total_remaining_need)}</p></div>
                  <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Expected Inflow</p><p className="font-semibold">{formatCompactUsd(adminResult.expected_funding_inflow)}</p></div>
                  <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Coverage</p><p className="font-semibold">{formatPercent(adminResult.coverage_ratio)}</p></div>
                </div>

                <div className="bg-white p-6 rounded shadow">
                  <h3 className="font-semibold mb-2">Coverage & Risk Visuals</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={coverageData} dataKey="value" nameKey="name" outerRadius={80} label>
                            {coverageData.map((c) => <Cell key={c.name} fill={c.color} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={adminResult.portfolio_rankings.slice(0, 6)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="field_name" hide />
                          <YAxis tickFormatter={(v) => formatPercent(Number(v))} />
                          <Tooltip />
                          <Bar dataKey="top_funder_probability" name="Top funder likelihood">
                            {adminResult.portfolio_rankings.slice(0, 6).map((r, i) => (
                              <Cell key={i} fill={r.top_funder_probability < 0.35 ? "#ef4444" : "#22c55e"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded shadow">
                  <h3 className="font-semibold mb-2">Explicit Low-Likelihood Reasons</h3>
                  <ul className="text-sm list-disc pl-5 space-y-1">
                    {adminResult.portfolio_rankings.slice(0, 6).map((r) => (
                      <li key={r.field_code}>
                        <span className="font-medium">{r.field_name}:</span>{" "}
                        {r.top_funder_probability < 0.35
                          ? "Low expected funding likelihood. Primary reason: weak top-funder probability and high competition."
                          : "Moderate/strong likelihood. Main risk is timing and portfolio concentration."}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
