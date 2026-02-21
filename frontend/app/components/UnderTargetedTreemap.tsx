"use client";

import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { formatCompactUsd, formatSigned } from "@/lib/format";
import { chartTheme } from "@/lib/chart-theme";

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
    <div
      className="p-6 rounded shadow border"
      style={{ background: chartTheme.treemap.cardBackground, borderColor: chartTheme.treemap.cardBorder }}
    >
      <h2 className="text-xl font-semibold mb-1">Under-Targeted Field Treemap</h2>
      <p className="text-sm text-gray-600 mb-4">Top 25 by under-target gap, sized by AAU funding.</p>
      <ResponsiveContainer width="100%" height={420}>
        <Treemap data={rows} dataKey="size" stroke={chartTheme.treemap.stroke} fill={chartTheme.treemap.fill}>
          <Tooltip
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as TreemapRow;
              return (
                <div className="bg-white p-3 border rounded shadow text-sm">
                  <p className="font-semibold">{p.name}</p>
                  <p>AAU Funding: {formatCompactUsd(p.size)}</p>
                  <p>Under-target gap: {formatSigned(p.gap, 4)}</p>
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
