"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Label,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { formatCompactUsd } from "@/lib/format";

type SimilarityNode = {
  grant_id: string;
  for4_code: string;
  for4_name: string;
  funding: number;
};

type AdjacentRow = {
  for4_code: string;
  for4_name: string;
  pivot_ease: number;
  raw_similarity?: number;
  same_for2?: boolean;
  lexical_overlap?: number;
  available_funding: number;
};

type AdjacentApiResponse = {
  version: string;
  primary: { for4_code: string; for4_name: string };
  adjacent: AdjacentRow[];
};

type MatrixRow = AdjacentRow & {
  pivot_ease_pct: number;
  bubble_size: number;
  pivot_value_index: number;
};

type TooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: MatrixRow }>;
};

type Props = {
  nodes: SimilarityNode[];
};

const easeColor = (easePct: number) => {
  if (easePct >= 80) return "#22c55e";
  if (easePct >= 60) return "#14b8a6";
  if (easePct >= 45) return "#0ea5e9";
  return "#6366f1";
};

export default function AdjacentExpansionWeb({ nodes }: Props) {
  const [ideaLabel, setIdeaLabel] = useState("My Research Idea");
  const [selectedCode, setSelectedCode] = useState("");
  const [adjacent, setAdjacent] = useState<AdjacentRow[]>([]);
  const [primaryName, setPrimaryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fieldOptions = useMemo(
    () => [...nodes].sort((a, b) => a.for4_name.localeCompare(b.for4_name)).map((n) => ({ code: n.for4_code, name: n.for4_name })),
    [nodes],
  );

  useEffect(() => {
    if (!selectedCode && fieldOptions.length > 0) {
      setSelectedCode(fieldOptions[0].code);
    }
  }, [fieldOptions, selectedCode]);

  useEffect(() => {
    if (!selectedCode) return;
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/models/adjacent-expansion?for4_code=${encodeURIComponent(selectedCode)}&top_n=6`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AdjacentApiResponse;
        if (!active) return;
        setPrimaryName(json.primary?.for4_name || selectedCode);
        setAdjacent(Array.isArray(json.adjacent) ? json.adjacent : []);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load adjacent expansion data");
        setAdjacent([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedCode]);

  const matrixData = useMemo(() => {
    if (adjacent.length === 0) return [] as MatrixRow[];

    const maxFunding = Math.max(...adjacent.map((d) => Number(d.available_funding) || 0), 1);
    const minFunding = Math.min(...adjacent.map((d) => Number(d.available_funding) || 0));
    const maxEase = Math.max(...adjacent.map((d) => Number(d.pivot_ease) || 0));
    const minEase = Math.min(...adjacent.map((d) => Number(d.pivot_ease) || 0));

    return adjacent
      .map((d) => {
        const ease = Number(d.pivot_ease) || 0;
        const funding = Number(d.available_funding) || 0;
        const easeNorm = maxEase > minEase ? (ease - minEase) / (maxEase - minEase) : 0.5;
        const fundingNorm = maxFunding > minFunding ? (funding - minFunding) / (maxFunding - minFunding) : 0.5;

        return {
          ...d,
          pivot_ease_pct: ease * 100,
          bubble_size: 120 + fundingNorm * 650,
          pivot_value_index: 100 * (0.65 * easeNorm + 0.35 * fundingNorm),
        };
      })
      .sort((a, b) => b.pivot_value_index - a.pivot_value_index);
  }, [adjacent]);

  const topPivot = matrixData[0];

  return (
    <div className="p-6 rounded shadow border bg-gradient-to-br from-cyan-50 via-white to-indigo-50 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Adjacent Expansion Matrix</h2>
      <p className="text-sm text-gray-600 mt-1">
        A cleaner pivot view: rightward is easier pivoting, upward is larger funding pools, larger bubbles are bigger opportunities.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4 mb-2">
        <label className="text-sm text-gray-700 lg:col-span-2">
          Idea label
          <input
            className="w-full border rounded p-2 text-sm mt-1"
            value={ideaLabel}
            onChange={(e) => setIdeaLabel(e.target.value)}
            placeholder="e.g., Multi-agent Robotics for Sustainable Farming"
          />
        </label>
        <label className="text-sm text-gray-700">
          Primary field
          <select className="w-full border rounded p-2 text-sm mt-1" value={selectedCode} onChange={(e) => setSelectedCode(e.target.value)}>
            {fieldOptions.map((f) => (
              <option key={f.code} value={f.code}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-gray-600 mb-3">
        Idea: <span className="font-semibold">{ideaLabel || "My Research Idea"}</span> in <span className="font-semibold">{primaryName || "-"}</span>
      </p>

      {loading && <p className="text-sm text-gray-500 mb-2">Loading adjacent expansion model...</p>}
      {error && <p className="text-sm text-red-600 mb-2">Error: {error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded border border-cyan-100 bg-white/80 p-3">
          <p className="text-xs font-semibold text-slate-700 mb-1">Pivot Matrix</p>
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 12, bottom: 36, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                <XAxis dataKey="pivot_ease_pct" type="number" domain={[0, 100]} tick={{ fill: "#475569", fontSize: 11 }}>
                  <Label value="Pivot Ease (%)" position="insideBottom" offset={-10} />
                </XAxis>
                <YAxis
                  dataKey="available_funding"
                  type="number"
                  tickFormatter={(v) => formatCompactUsd(Number(v))}
                  tick={{ fill: "#475569", fontSize: 11 }}
                  width={72}
                >
                  <Label value="Available Funding" angle={-90} position="insideLeft" offset={-4} />
                </YAxis>
                <ZAxis dataKey="bubble_size" range={[120, 760]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }: TooltipProps) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="bg-white p-3 border border-slate-200 rounded shadow text-sm text-slate-900">
                        <p className="font-semibold">{p.for4_name}</p>
                        <p>Pivot ease score: {p.pivot_ease_pct.toFixed(1)}%</p>
                        <p>Map proximity: {Number(p.raw_similarity ?? 0).toFixed(3)}</p>
                        <p>Same FOR2 family: {p.same_for2 ? "Yes" : "No"}</p>
                        <p>Lexical overlap: {((Number(p.lexical_overlap ?? 0) || 0) * 100).toFixed(1)}%</p>
                        <p>Available funding: {formatCompactUsd(p.available_funding)}</p>
                        <p>Pivot value index: {p.pivot_value_index.toFixed(1)}</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={matrixData}>
                  {matrixData.map((row) => (
                    <Cell key={row.for4_code} fill={easeColor(row.pivot_ease_pct)} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded border border-indigo-100 bg-white/80 p-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">Recommended Pivot Paths</p>
          <div className="space-y-3">
            {matrixData.map((row, idx) => (
              <div key={row.for4_code} className="rounded border border-slate-200 p-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{idx + 1}. {row.for4_name}</p>
                  <span className="text-[11px] font-semibold text-cyan-700">{row.pivot_value_index.toFixed(0)}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Ease score {row.pivot_ease_pct.toFixed(1)}% • {formatCompactUsd(row.available_funding)}</p>
                <div className="mt-2 h-2 rounded bg-slate-100 overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${Math.max(6, Math.min(100, row.pivot_ease_pct))}%`, backgroundColor: easeColor(row.pivot_ease_pct) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
        <div className="bg-white/80 border border-slate-200 rounded p-3">
          <p className="text-xs text-slate-500">Top pivot target</p>
          <p className="font-semibold text-slate-900">{topPivot?.for4_name || "-"}</p>
        </div>
        <div className="bg-white/80 border border-slate-200 rounded p-3">
          <p className="text-xs text-slate-500">Best pivot ease score</p>
          <p className="font-semibold text-slate-900">{topPivot ? `${topPivot.pivot_ease_pct.toFixed(1)}%` : "-"}</p>
        </div>
        <div className="bg-white/80 border border-slate-200 rounded p-3">
          <p className="text-xs text-slate-500">Funding at top pivot</p>
          <p className="font-semibold text-slate-900">{topPivot ? formatCompactUsd(topPivot.available_funding) : "-"}</p>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 mt-3">
        Conclusion driver: If your current field is crowded, move toward top-right fields to keep pivot effort low while expanding funding reach.
      </p>
    </div>
  );
}
