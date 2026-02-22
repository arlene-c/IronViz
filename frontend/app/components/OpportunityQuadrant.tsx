"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Label,
  ZAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { formatCompactUsd, formatPercent, formatSigned } from "@/lib/format";
import { chartTheme } from "@/lib/chart-theme";

type OpportunityRow = {
  FOR4_CODE: string;
  FOR4_NAME: string;
  opportunity_score_v1: number;
  growth_rate: number;
  under_target_gap: number;
  AAU_total: number;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isUnderTargeted = (data.targetingGap ?? 0) > 0;
    return (
      <div className="bg-white dark:bg-gray-700 p-3 border border-gray-200 dark:border-gray-600 rounded shadow-lg transition-colors">
        <p className="font-bold text-gray-900 dark:text-white">{data.field}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">Gap: {formatSigned(data.targetingGap, 4)}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">Growth: {formatPercent(data.growth, 1)}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">AAU Funding: {formatCompactUsd(data.funding)}</p>
        <p className={`text-xs mt-1 ${isUnderTargeted ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
          {isUnderTargeted ? "CMU is under-targeted here" : "CMU is at/above external focus"}
        </p>
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
  const [zoomed, setZoomed] = useState(false);

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
    <div
      className="p-6 rounded shadow transition-colors duration-200 border bg-gradient-to-br from-rose-50 via-white to-sky-50 dark:bg-slate-900 dark:border-slate-700"
      style={{ borderColor: chartTheme.quadrant.cardBorder }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Opportunity Quadrant</h2>
        <button
          className="text-xs border rounded px-2 py-1 bg-white/80 hover:bg-white"
          onClick={() => setZoomed(true)}
        >
          Zoom
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-3">X: under-target gap | Y: growth rate | bubble: AAU funding</p>
      <ul className="text-xs text-gray-600 mb-3 list-disc pl-5 space-y-1">
        <li>Top-right: fastest-growing fields where CMU looks under-indexed.</li>
        <li>Larger bubbles imply larger external funding pools.</li>
        <li>Use this chart to shortlist target fields before outreach planning.</li>
      </ul>
      {loading && <p className="text-sm text-gray-500 mb-2">Loading model data...</p>}
      {error && <p className="text-sm text-red-600 mb-2">Error: {error}</p>}

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 18, right: 20, bottom: 42, left: 36 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} stroke={chartTheme.quadrant.grid} />
            <XAxis
              type="number"
              dataKey="targetingGap"
              name="Under-target gap"
              stroke="#888888"
              tickFormatter={(tick) => Number(tick).toFixed(2)}
            >
              <Label value="Under-Target Gap (AAU share - CMU share)" position="insideBottom" offset={-8} />
            </XAxis>
            <YAxis
              type="number"
              dataKey="growth"
              name="Growth Rate"
              stroke="#888888"
              tickFormatter={(tick) => `${(tick * 100).toFixed(0)}%`}
              width={60}
              label={{ value: "AAU Growth Rate", angle: -90, position: "insideLeft", offset: -4 }}
            />
            <ZAxis
              type="number"
              dataKey="funding"
              range={[80, 700]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
            
            <ReferenceLine x={0} stroke="#888888" strokeDasharray="3 3" label={{ position: "top", value: "Parity", fill: "#888888" }} />
            <ReferenceLine y={0} stroke="#888888" strokeDasharray="3 3" />

            <Scatter data={chartData} name="Fields">
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.targetingGap > 0 ? chartTheme.quadrant.pointUnder : chartTheme.quadrant.pointStrong} 
                  opacity={0.8}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {zoomed && (
        <div className="fixed inset-0 z-50 bg-black/50 p-6">
          <div className="bg-white dark:bg-slate-900 rounded shadow-xl h-full w-full p-4 border dark:border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Opportunity Quadrant (Zoomed)</h3>
              <button className="text-xs border rounded px-2 py-1" onClick={() => setZoomed(false)}>
                Close
              </button>
            </div>
            <div className="h-[calc(100%-36px)]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 18, right: 20, bottom: 48, left: 46 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} stroke={chartTheme.quadrant.grid} />
                  <XAxis
                    type="number"
                    dataKey="targetingGap"
                    name="Under-target gap"
                    stroke={chartTheme.quadrant.xAxis}
                    tickFormatter={(tick) => Number(tick).toFixed(2)}
                  >
                    <Label value="Under-Target Gap (AAU share - CMU share)" position="insideBottom" offset={-8} />
                  </XAxis>
                  <YAxis
                    type="number"
                    dataKey="growth"
                    name="Growth Rate"
                    stroke={chartTheme.quadrant.yAxis}
                    tickFormatter={(tick) => `${(tick * 100).toFixed(0)}%`}
                    width={70}
                    label={{ value: "AAU Growth Rate", angle: -90, position: "insideLeft", offset: -4 }}
                  />
                  <ZAxis type="number" dataKey="funding" range={[80, 700]} />
                  <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                  <ReferenceLine
                    x={0}
                    stroke={chartTheme.quadrant.refX}
                    strokeDasharray="3 3"
                    label={{ position: "top", value: "Parity", fill: chartTheme.quadrant.xAxis }}
                  />
                  <ReferenceLine y={0} stroke={chartTheme.quadrant.refY} strokeDasharray="3 3" />
                  <Scatter data={chartData} name="Fields">
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`zoom-cell-${index}`}
                        fill={entry.targetingGap > 0 ? chartTheme.quadrant.pointUnder : chartTheme.quadrant.pointStrong}
                        opacity={0.8}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}