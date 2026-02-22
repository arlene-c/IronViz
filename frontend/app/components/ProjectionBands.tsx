"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactUsd } from "@/lib/format";
import { chartTheme } from "@/lib/chart-theme";

type ForecastRow = {
  FOR4_CODE: string;
  FOR4_NAME: string;
  year: number;
  aau_forecast: number;
  aau_forecast_low?: number | null;
  aau_forecast_high?: number | null;
};

type Props = {
  data: ForecastRow[];
};

export default function ProjectionBands({ data }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const focusField = useMemo(
    () =>
      [...data]
        .filter((d) => Number(d.year) === 2026)
        .sort((a, b) => (Number(b.aau_forecast) || 0) - (Number(a.aau_forecast) || 0))[0],
    [data],
  );

  const filtered = useMemo(
    () =>
      data
        .filter((d) => d.FOR4_CODE === focusField?.FOR4_CODE)
        .sort((a, b) => Number(a.year) - Number(b.year))
        .map((d) => ({
          year: Number(d.year),
          forecast: Number(d.aau_forecast || 0),
          low: Number(d.aau_forecast_low ?? d.aau_forecast ?? 0),
          high: Number(d.aau_forecast_high ?? d.aau_forecast ?? 0),
        })),
    [data, focusField],
  );

  const chartColors = isDark
    ? { grid: "#334155", tick: "#cbd5e1", forecast: "#60a5fa", low: "#fca5a5", high: "#93c5fd" }
    : { grid: "#cbd5e1", tick: "#475569", forecast: chartTheme.projection.forecast, low: "#ef4444", high: "#3b82f6" };

  const ForecastTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const points = payload.filter((p: any) => p.value !== null && p.value !== undefined);
    return (
      <div className="bg-white dark:bg-slate-800 p-3 border rounded shadow text-sm dark:border-slate-700">
        <p className="font-semibold">Year {label}</p>
        {points.map((p: any) => (
          <p key={p.dataKey}>
            {p.name}: {formatCompactUsd(Number(p.value))}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div
      className="p-6 rounded shadow border"
      style={{ background: chartTheme.projection.cardBackground, borderColor: chartTheme.projection.cardBorder }}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-xl font-semibold">Projection Bands (AAU Forecast)</h2>
        <button className="text-xs border rounded px-2 py-1 bg-white/80 hover:bg-white" onClick={() => setZoomed(true)}>
          Zoom
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Clean year-by-year projection for top 2026 field: <span className="font-semibold">{focusField?.FOR4_NAME || "N/A"}</span>.
      </p>
      <ul className="text-xs text-gray-600 mb-4 list-disc pl-5 space-y-1">
        <li>Compare trend slope to identify accelerating vs flattening opportunities.</li>
        <li>Forecast/high-low spread gives quick uncertainty context for planning risk.</li>
      </ul>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={filtered}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} tick={{ fill: chartColors.tick }} />
          <YAxis tickFormatter={(v) => formatCompactUsd(Number(v))} tick={{ fill: chartColors.tick }} />
          <Tooltip content={<ForecastTooltip />} />
          <Legend />
          <Line type="monotone" dataKey="forecast" stroke={chartColors.forecast} dot={{ r: 2 }} name="Forecast" />
          <Line type="monotone" dataKey="low" stroke={chartColors.low} dot={false} name="Low band" />
          <Line type="monotone" dataKey="high" stroke={chartColors.high} dot={false} name="High band" />
        </LineChart>
      </ResponsiveContainer>
      {zoomed && (
        <div className="fixed inset-0 z-50 bg-black/50 p-6">
          <div className="bg-white dark:bg-slate-900 rounded shadow-xl h-full w-full p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Projection Bands (Zoomed)</h3>
              <button className="text-xs border rounded px-2 py-1" onClick={() => setZoomed(false)}>
                Close
              </button>
            </div>
            <ResponsiveContainer width="100%" height="95%">
              <LineChart data={filtered}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} tick={{ fill: chartColors.tick }} />
                <YAxis tickFormatter={(v) => formatCompactUsd(Number(v))} tick={{ fill: chartColors.tick }} />
                <Tooltip content={<ForecastTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="forecast" stroke={chartColors.forecast} dot={{ r: 2 }} name="Forecast" />
                <Line type="monotone" dataKey="low" stroke={chartColors.low} dot={false} name="Low band" />
                <Line type="monotone" dataKey="high" stroke={chartColors.high} dot={false} name="High band" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
