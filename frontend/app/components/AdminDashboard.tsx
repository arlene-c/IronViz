"use client";

import { useEffect, useMemo, useState } from "react";
import FunderFlowRanking from "./FunderFlowRanking";
import OpportunityQuadrant from "./OpportunityQuadrant";
import UnderTargetedTreemap, { OpportunityRow } from "./UnderTargetedTreemap";

type SankeyRow = {
  source: string;
  target: string;
  value: number;
  cmu_field_total?: number;
};

export default function AdminDashboard() {
  const [opportunity, setOpportunity] = useState<OpportunityRow[]>([]);
  const [sankey, setSankey] = useState<SankeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [oppRes, sankeyRes] = await Promise.all([
          fetch("/api/models/opportunity", { cache: "no-store" }),
          fetch("/api/data/sankey", { cache: "no-store" }),
        ]);
        if (!oppRes.ok || !sankeyRes.ok) {
          throw new Error(`Opportunity ${oppRes.status}, Sankey ${sankeyRes.status}`);
        }
        const [oppJson, sankeyJson] = await Promise.all([oppRes.json(), sankeyRes.json()]);
        if (isMounted) {
          setOpportunity(Array.isArray(oppJson.data) ? oppJson.data : []);
          setSankey(Array.isArray(sankeyJson.data) ? sankeyJson.data : []);
        }
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Failed to load admin insights");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const topOpportunities = useMemo(
    () =>
      [...opportunity]
        .sort((a, b) => (Number(b.opportunity_score_v1) || 0) - (Number(a.opportunity_score_v1) || 0))
        .slice(0, 5),
    [opportunity],
  );

  const stats = useMemo(() => {
    const avgGap =
      opportunity.length > 0
        ? opportunity.reduce((acc, row) => acc + (Number(row.under_target_gap) || 0), 0) / opportunity.length
        : 0;
    const totalAau = opportunity.reduce((acc, row) => acc + (Number(row.AAU_total) || 0), 0);
    const topScore = topOpportunities[0]?.opportunity_score_v1 ?? 0;
    return { avgGap, totalAau, topScore };
  }, [opportunity, topOpportunities]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold">Admin Strategy Console</h1>
        <p className="text-sm text-gray-600 mt-1">
          Prioritize where CMU is under-indexed while external momentum is highest.
        </p>
        {loading && <p className="text-sm text-gray-500 mt-2">Loading admin insights...</p>}
        {error && <p className="text-sm text-red-600 mt-2">Error: {error}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Fields analyzed</p>
          <p className="text-2xl font-bold">{opportunity.length}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Total AAU funding</p>
          <p className="text-2xl font-bold">${Math.round(stats.totalAau).toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Top opportunity score</p>
          <p className="text-2xl font-bold">{Number(stats.topScore).toFixed(3)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <OpportunityQuadrant data={opportunity} />
        </div>
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-1">Top 5 Opportunity Rankings</h2>
          <p className="text-sm text-gray-600 mb-4">Fast shortlist for strategic action.</p>
          <ul className="text-xs text-gray-600 mb-4 list-disc pl-5 space-y-1">
            <li>Start outreach from rank 1 to 3 to maximize expected return quickly.</li>
            <li>Use rank plus gap value to justify resource shifts in admin planning.</li>
          </ul>
          <ol className="space-y-2">
            {topOpportunities.map((row, idx) => (
              <li key={row.FOR4_CODE} className="flex justify-between items-start gap-3 border-b pb-2 last:border-b-0">
                <div>
                  <p className="font-semibold">{idx + 1}. {row.FOR4_NAME}</p>
                  <p className="text-xs text-gray-500">Gap: {(Number(row.under_target_gap) || 0).toFixed(4)}</p>
                </div>
                <span className="font-bold">{(Number(row.opportunity_score_v1) || 0).toFixed(3)}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-gray-500 mt-4">Average under-target gap: {stats.avgGap.toFixed(4)}</p>
        </div>
      </div>

      <UnderTargetedTreemap data={opportunity} />
      <FunderFlowRanking data={sankey} />
    </div>
  );
}
