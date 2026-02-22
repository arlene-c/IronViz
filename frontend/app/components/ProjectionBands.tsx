"use client";

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
  const topFields = [...data]
    .filter((d) => d.year === 2026)
    .sort((a, b) => (Number(b.aau_forecast) || 0) - (Number(a.aau_forecast) || 0))
    .slice(0, 3)
    .map((d) => d.FOR4_CODE);

  const filtered = data
    .filter((d) => topFields.includes(d.FOR4_CODE))
    .map((d) => ({
      ...d,
      label: `${d.FOR4_NAME} (${d.year})`,
    }));

  const ForecastTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const points = payload.filter((p: any) => p.value !== null && p.value !== undefined);
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow text-sm text-gray-900 dark:text-white">
        <p className="font-semibold">{label}</p>
        {points.map((p: any) => (
          <p key={p.dataKey}>
            {p.name}: {formatCompactUsd(Number(p.value))}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded shadow border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white transition-colors duration-200">
      <h2 className="text-xl font-semibold mb-1">Projection Bands (AAU Forecast)</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Top 3 fields by predicted 2026 AAU funding.</p>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={filtered}>
          <CartesianGrid strokeDasharray="3 3" stroke="#555" />
          <XAxis dataKey="label" minTickGap={20} stroke="#888" />
          <YAxis tickFormatter={(v) => formatCompactUsd(Number(v))} stroke="#888" />
          <Tooltip content={<ForecastTooltip />} />
          <Legend />
          <Line type="monotone" dataKey="aau_forecast" stroke={chartTheme.projection.forecast} dot={false} name="Forecast" />
          <Line type="monotone" dataKey="aau_forecast_low" stroke={chartTheme.projection.low} dot={false} name="Low band" />
          <Line type="monotone" dataKey="aau_forecast_high" stroke={chartTheme.projection.high} dot={false} name="High band" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}