"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatSigned } from "@/lib/format";
import { chartTheme } from "@/lib/chart-theme";

export type RadarRow = {
  view?: "opportunity" | "strength";
  axis: string;
  for4_code: string;
  cmu: number;
  aau_avg: number;
  gap: number;
  priority_score: number;
};

type RadarTooltipPayload = {
  axis: string;
  cmu: number;
  aau_avg: number;
  gap: number;
  priority: number;
};

type RadarTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: RadarTooltipPayload }>;
};

type Props = {
  data?: RadarRow[];
};

export default function RadarComparisons({ data }: Props) {
  const [rows, setRows] = useState<RadarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data && data.length > 0) {
      setRows(data);
      setLoading(false);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const res = await fetch("/api/models/radar", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (isMounted) {
          setRows(Array.isArray(json.data) ? json.data : []);
        }
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Failed to load radar model data");
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
  }, [data]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        view: r.view,
        axis: r.axis,
        code: r.for4_code,
        cmu: Number(r.cmu) || 0,
        aau_avg: Number(r.aau_avg) || 0,
        gap: Number(r.gap) || 0,
        priority: Number(r.priority_score) || 0,
        cmu_advantage: Math.max(0, (Number(r.cmu) || 0) - (Number(r.aau_avg) || 0)),
        excellence_index: Math.min(
          100,
          0.7 * (Number(r.cmu) || 0) + 0.3 * Math.max(0, (Number(r.cmu) || 0) - (Number(r.aau_avg) || 0)),
        ),
      })),
    [rows],
  );

  const opportunityData = useMemo(() => {
    const filtered = chartData.filter((d) => d.view === "opportunity");
    return filtered.length > 0 ? filtered : chartData.slice(0, 6);
  }, [chartData]);

  const strengthsData = useMemo(() => {
    const filtered = chartData.filter((d) => d.view === "strength");
    return filtered.length > 0 ? filtered : chartData.slice(0, 6);
  }, [chartData]);

  return (
    <div
      className="p-6 rounded shadow border bg-gradient-to-br from-cyan-50 via-white to-orange-50 dark:bg-slate-900 dark:border-slate-700"
      style={{ borderColor: chartTheme.radar.cardBorder }}
    >
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Radar Comparisons</h2>
      <p className="text-sm text-gray-600 mt-1">Competitiveness Spider Web: CMU vs AAU Average across priority fields.</p>
      <ul className="text-xs text-gray-600 mt-3 mb-3 list-disc pl-5 space-y-1">
        <li>Axes are top priority fields selected from the model pipeline.</li>
        <li>Values are normalized to a 0-100 competitiveness profile.</li>
        <li>Larger cyan area means stronger relative CMU positioning.</li>
      </ul>

      {loading && <p className="text-sm text-gray-500 mb-2">Loading radar model data...</p>}
      {error && <p className="text-sm text-red-600 mb-2">Error: {error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="h-[420px] w-full rounded border border-cyan-100 bg-white/80 p-2">
          <p className="text-xs font-semibold text-slate-700 px-2 pt-1">CMU vs AAU Profile</p>
          <ResponsiveContainer width="100%" height="95%">
            <RadarChart data={opportunityData} outerRadius="72%">
              <defs>
                <filter id="cmu-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <PolarGrid stroke={chartTheme.radar.grid} strokeOpacity={0.7} />
              <PolarAngleAxis dataKey="axis" tick={{ fill: chartTheme.radar.axis, fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }: RadarTooltipProps) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow text-sm text-gray-900 dark:text-white">
                      <p className="font-semibold">{p.axis}</p>
                      <p>CMU index: {p.cmu.toFixed(1)}</p>
                      <p>AAU avg index: {p.aau_avg.toFixed(1)}</p>
                      <p>Under-target gap: {formatSigned(p.gap, 4)}</p>
                      <p>Priority score: {p.priority.toFixed(3)}</p>
                    </div>
                  );
                }}
              />
              <Radar
                name="AAU Average"
                dataKey="aau_avg"
                stroke={chartTheme.radar.aau}
                fill={chartTheme.radar.aau}
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Radar
                name="CMU"
                dataKey="cmu"
                stroke={chartTheme.radar.cmu}
                fill={chartTheme.radar.glow}
                fillOpacity={0.32}
                strokeWidth={2.5}
                style={{ filter: "url(#cmu-glow)" }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-[420px] w-full rounded border border-emerald-100 bg-white/80 p-2">
          <p className="text-xs font-semibold text-slate-700 px-2 pt-1">CMU Strengths & Excellence</p>
          <ResponsiveContainer width="100%" height="95%">
            <RadarChart data={strengthsData} outerRadius="72%">
              <PolarGrid stroke={chartTheme.radar.grid} strokeOpacity={0.7} />
              <PolarAngleAxis dataKey="axis" tick={{ fill: chartTheme.radar.axis, fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }: RadarTooltipProps) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow text-sm text-gray-900 dark:text-white">
                      <p className="font-semibold">{p.axis}</p>
                      <p>CMU index: {p.cmu.toFixed(1)}</p>
                      <p>AAU avg index: {p.aau_avg.toFixed(1)}</p>
                      <p>CMU advantage: {Math.max(0, p.cmu - p.aau_avg).toFixed(1)}</p>
                      <p>Excellence index: {(0.7 * p.cmu + 0.3 * Math.max(0, p.cmu - p.aau_avg)).toFixed(1)}</p>
                      <p>Under-target gap: {formatSigned(p.gap, 4)}</p>
                    </div>
                  );
                }}
              />
              <Radar
                name="Excellence Index"
                dataKey="excellence_index"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.22}
                strokeWidth={2}
              />
              <Radar
                name="CMU Advantage"
                dataKey="cmu_advantage"
                stroke="#0ea5e9"
                fill="#0ea5e9"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">Index is normalized inside selected axes to make shape differences easy to compare.</p>
    </div>
  );
}
