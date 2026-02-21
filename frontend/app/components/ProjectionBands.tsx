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

  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-1">Projection Bands (AAU Forecast)</h2>
      <p className="text-sm text-gray-600 mb-4">Top 3 fields by predicted 2026 AAU funding.</p>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={filtered}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" minTickGap={20} />
          <YAxis tickFormatter={(v) => `$${(Number(v) / 1_000_000).toFixed(0)}M`} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="aau_forecast" stroke="#2563eb" dot={false} name="Forecast" />
          <Line type="monotone" dataKey="aau_forecast_low" stroke="#93c5fd" dot={false} name="Low band" />
          <Line type="monotone" dataKey="aau_forecast_high" stroke="#1d4ed8" dot={false} name="High band" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
