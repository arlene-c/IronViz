"use client";

import { useState } from "react";
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
  code: string;
  for2: string;
  size: number;
  gap: number;
};

export default function UnderTargetedTreemap({ data }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const rows: TreemapRow[] = data
    .map((d) => ({
      name: d.FOR4_NAME,
      code: d.FOR4_CODE,
      for2: String(d.FOR4_CODE).slice(0, 2),
      size: Math.max(1, Number(d.AAU_total) || 0),
      gap: Number(d.under_target_gap) || 0,
    }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 25);

  return (
<<<<<<< HEAD
    <div className="bg-white dark:bg-gray-800 p-6 rounded shadow border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white transition-colors duration-200">
      <h2 className="text-xl font-semibold mb-1">Under-Targeted Field Treemap</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Top 25 by under-target gap, sized by AAU funding.</p>
      <ResponsiveContainer width="100%" height={420}>
        <Treemap data={rows} dataKey="size" stroke="#1f2937" fill={chartTheme.treemap.fill}>
=======
    <div
      className="p-6 rounded shadow border bg-gradient-to-br from-pink-50 via-white to-orange-50 dark:bg-slate-900 dark:border-slate-700"
      style={{ borderColor: chartTheme.treemap.cardBorder }}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-xl font-semibold">Under-Targeted Field Treemap</h2>
        <button className="text-xs border rounded px-2 py-1 bg-white/80 hover:bg-white" onClick={() => setZoomed(true)}>
          Zoom
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">Top 25 by under-target gap, sized by AAU funding.</p>
      <ul className="text-xs text-gray-600 mb-4 list-disc pl-5 space-y-1">
        <li>Larger boxes signal larger external funding potential.</li>
        <li>Prioritize boxes with high positive under-target gap for catch-up strategy.</li>
      </ul>
      <ResponsiveContainer width="100%" height={420}>
        <Treemap data={rows} dataKey="size" stroke={chartTheme.treemap.stroke} fill="#60a5fa">
>>>>>>> 18350c96a22622323c348f44fd146e57b640548c
          <Tooltip
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as TreemapRow;
              return (
                <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow text-sm text-gray-900 dark:text-white">
                  <p className="font-semibold">{p.name}</p>
                  <p>FOR2: {p.for2}xx</p>
                  <p>AAU Funding: {formatCompactUsd(p.size)}</p>
                  <p>Under-target gap: {formatSigned(p.gap, 4)}</p>
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
      <p className="text-[11px] text-gray-500 mt-2">Sizing reflects AAU funding; tooltip includes FOR2 group.</p>
      {zoomed && (
        <div className="fixed inset-0 z-50 bg-black/50 p-6">
          <div className="bg-white dark:bg-slate-900 rounded shadow-xl h-full w-full p-4 border dark:border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Under-Targeted Treemap (Zoomed)</h3>
              <button className="text-xs border rounded px-2 py-1" onClick={() => setZoomed(false)}>
                Close
              </button>
            </div>
            <ResponsiveContainer width="100%" height="95%">
              <Treemap data={rows} dataKey="size" stroke={chartTheme.treemap.stroke} fill="#60a5fa">
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as TreemapRow;
                    return (
                      <div className="bg-white p-3 border rounded shadow text-sm">
                        <p className="font-semibold">{p.name}</p>
                        <p>FOR2: {p.for2}xx</p>
                        <p>AAU Funding: {formatCompactUsd(p.size)}</p>
                        <p>Under-target gap: {formatSigned(p.gap, 4)}</p>
                      </div>
                    );
                  }}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}