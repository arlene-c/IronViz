"use client";

import { ResponsiveContainer, Tooltip, Treemap } from "recharts";

export type OpportunityRow = {
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

type TreemapRow = {
  name: string;
  size: number;
  gap: number;
};

export default function UnderTargetedTreemap({ data }: Props) {
  const rows: TreemapRow[] = data
    .map((d) => ({
      name: d.FOR4_NAME,
      size: Math.max(1, Number(d.AAU_total) || 0),
      gap: Number(d.under_target_gap) || 0,
    }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 25);

  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-1">Under-Targeted Field Treemap</h2>
      <p className="text-sm text-gray-600 mb-4">Top 25 by under-target gap, sized by AAU funding.</p>
      <ResponsiveContainer width="100%" height={420}>
        <Treemap data={rows} dataKey="size" stroke="#fff" fill="#3b82f6">
          <Tooltip />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
