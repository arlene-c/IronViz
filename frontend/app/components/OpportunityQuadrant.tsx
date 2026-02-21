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
  ReferenceLine,
  Cell
} from "recharts";

<<<<<<< HEAD
const mockData = [
  { field: "AI", targetingIndex: 0.4, growth: 0.8, funding: 20000000 },
  { field: "Robotics", targetingIndex: 1.2, growth: 0.4, funding: 15000000 },
  { field: "Climate", targetingIndex: 0.3, growth: 0.5, funding: 18000000 },
  { field: "Quantum", targetingIndex: 1.5, growth: 0.9, funding: 10000000 },
  { field: "Bio", targetingIndex: 0.8, growth: 0.2, funding: 8000000 },
];
=======
type OpportunityRow = {
  FOR4_CODE: string;
  FOR4_NAME: string;
  opportunity_score_v1: number;
  growth_rate: number;
  under_target_gap: number;
  AAU_total: number;
};
>>>>>>> 66f539b5e985224c8e803bfbd6c0eab03cce9574

// Custom tooltip so big funding numbers are readable
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-700 p-3 border border-gray-200 dark:border-gray-600 rounded shadow-lg transition-colors">
        <p className="font-bold text-gray-900 dark:text-white">{data.field}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">Targeting Index: {data.targetingIndex}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">Growth Rate: {(data.growth * 100).toFixed(0)}%</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">AAU Funding: ${(data.funding / 1000000).toFixed(1)}M</p>
      </div>
    );
  }
  return null;
};

type Props = {
  data?: OpportunityRow[];
};

export default function OpportunityQuadrant({ data }: Props) {
  const [rows, setRows] = useState<OpportunityRow[]>([]);
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
  }, [data]);

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
    <div className="bg-white dark:bg-gray-800 p-6 rounded shadow transition-colors duration-200">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
        Opportunity Quadrant
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        X: under-target gap | Y: growth rate | bubble: AAU funding
      </p>
      {loading && <p className="text-sm text-gray-500 mb-2">Loading model data...</p>}
      {error && <p className="text-sm text-red-600 mb-2">Error: {error}</p>}

<<<<<<< HEAD
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis
              type="number"
              dataKey="targetingIndex"
              name="CMU Targeting Index"
              stroke="#888888"
            />
            <YAxis
              type="number"
              dataKey="growth"
              name="AAU Growth Rate"
              stroke="#888888"
              tickFormatter={(tick) => `${(tick * 100).toFixed(0)}%`}
            />
            <ZAxis
              type="number"
              dataKey="funding"
              range={[100, 1000]} // Controls min and max bubble size
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
            
            {/* Quadrant Crosshairs */}
            <ReferenceLine x={1.0} stroke="#666" strokeDasharray="3 3" label={{ position: 'top', value: 'CMU Parity', fill: '#888' }} />
            <ReferenceLine y={0.3} stroke="#666" strokeDasharray="3 3" label={{ position: 'right', value: 'High Growth', fill: '#888' }} />

            <Scatter data={mockData} name="Fields">
              {mockData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  // Red if under-targeted (Index < 1.0), Blue if strong (Index >= 1.0)
                  fill={entry.targetingIndex < 1.0 ? "#ef4444" : "#3b82f6"} 
                  opacity={0.8}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
=======
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
>>>>>>> 66f539b5e985224c8e803bfbd6c0eab03cce9574
    </div>
  );
}
