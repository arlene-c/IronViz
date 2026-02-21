"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type OpportunityRow = {
  FOR4_CODE: string;
  FOR4_NAME: string;
  opportunity_score_v1: number;
  growth_rate: number;
  under_target_gap: number;
  AAU_total: number;
};

export default function OpportunityQuadrant() {
  const [rows, setRows] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch("/api/models/opportunity", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (isMounted) {
          setRows(Array.isArray(json.data) ? json.data : []);
        }
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Failed to load model data");
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

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        field: r.FOR4_NAME,
        targetingGap: r.under_target_gap ?? 0,
        growth: r.growth_rate ?? 0,
        funding: r.AAU_total ?? 0,
        score: r.opportunity_score_v1 ?? 0,
      })),
    [rows],
  );

  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">
        Opportunity Quadrant
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        X: under-target gap | Y: growth rate | bubble: AAU funding
      </p>
      {loading && <p className="text-sm text-gray-500 mb-2">Loading model data...</p>}
      {error && <p className="text-sm text-red-600 mb-2">Error: {error}</p>}

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="targetingGap"
            name="Under-target gap"
          />
          <YAxis
            type="number"
            dataKey="growth"
            name="Growth Rate"
          />
          <ZAxis
            type="number"
            dataKey="funding"
            range={[50, 400]}
          />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={chartData} fill="#2563eb" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
