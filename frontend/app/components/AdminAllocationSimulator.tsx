"use client";

import { useMemo, useState } from "react";
import { formatCompactUsd } from "@/lib/format";

type OpportunityRow = {
  FOR4_CODE: string;
  FOR4_NAME: string;
  opportunity_score_v1: number;
  growth_rate: number;
  under_target_gap: number;
  AAU_total: number;
};

type Props = {
  data: OpportunityRow[];
};

export default function AdminAllocationSimulator({ data }: Props) {
  const [budget, setBudget] = useState(10_000_000);

  const allocations = useMemo(() => {
    const candidates = [...data]
      .filter((d) => Number(d.opportunity_score_v1 || 0) > 0)
      .map((d) => {
        const score =
          0.5 * Math.max(0, Number(d.under_target_gap || 0)) +
          0.3 * Math.max(0, Number(d.growth_rate || 0)) +
          0.2 * Math.max(0, Number(d.opportunity_score_v1 || 0));
        return { ...d, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const totalScore = Math.max(1e-6, candidates.reduce((acc, c) => acc + c.score, 0));
    return candidates.map((c) => ({
      code: c.FOR4_CODE,
      name: c.FOR4_NAME,
      share: c.score / totalScore,
      amount: Math.round((c.score / totalScore) * budget),
    }));
  }, [data, budget]);

  return (
    <div className="bg-white p-6 rounded shadow dark:bg-slate-900 dark:border dark:border-slate-700">
      <h2 className="text-xl font-semibold mb-1">Allocation Simulator</h2>
      <p className="text-sm text-gray-600 mb-3">Distribute a planning budget across top opportunity fields.</p>
      <label className="text-sm text-gray-700">
        Total budget to allocate (USD)
        <input
          className="w-full border rounded p-2 text-sm mt-1"
          type="number"
          min={0}
          step={100000}
          value={budget}
          onChange={(e) => setBudget(Math.max(0, Number(e.target.value || 0)))}
        />
      </label>
      <div className="mt-3 space-y-2">
        {allocations.map((a) => (
          <div key={a.code} className="border rounded p-2">
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium">{a.name}</p>
              <p>{formatCompactUsd(a.amount)}</p>
            </div>
            <div className="mt-1 h-2 bg-slate-100 rounded overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${Math.max(2, Math.round(a.share * 100))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

