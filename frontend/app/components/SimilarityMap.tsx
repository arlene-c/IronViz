"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { formatCompactUsd } from "@/lib/format";
import { chartTheme } from "@/lib/chart-theme";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type SimilarityNode = {
  grant_id: string;
  for4_code: string;
  for4_name: string;
  x_coord: number;
  y_coord: number;
  funding: number;
  institution_group: string;
};

type Props = {
  data?: SimilarityNode[];
};

function HelpTip({ text }: { text: string }) {
  return (
    <span
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 text-[10px] text-gray-700 dark:text-gray-200 cursor-help"
      title={text}
    >
      ?
    </span>
  );
}

export default function SimilarityMap({ data }: Props) {
  const [rows, setRows] = useState<SimilarityNode[]>([]);
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
        const res = await fetch("/api/models/similarity", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (isMounted) setRows(Array.isArray(json.data) ? json.data : []);
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : "Failed to load model data");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [data]);

  const markerSize = useMemo(
    () => rows.map((d) => Math.max(8, Math.sqrt((d.funding ?? 0) / 2_000_000))),
    [rows],
  );
  const markerColor = useMemo(
    () => rows.map((d) => (d.institution_group === "CMU" ? chartTheme.similarity.cmu : chartTheme.similarity.other)),
    [rows],
  );

  return (
    <div
      className="p-6 rounded shadow transition-colors duration-200 border bg-gradient-to-br from-emerald-50 via-white to-sky-50 dark:bg-slate-900 dark:border-slate-700"
      style={{ borderColor: chartTheme.similarity.cardBorder }}
    >
      <h2 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
        Idea Similarity Map
        <HelpTip text="Points that are closer are more conceptually similar. Larger circles indicate higher field funding. Green points indicate stronger CMU-relative positioning." />
      </h2>
      <div className="flex justify-end mb-2">
        <button
          className="text-xs border rounded px-2 py-1 bg-white/80 hover:bg-white"
          onClick={() => setZoomed(true)}
        >
          Zoom
        </button>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        Insight: Clustered points suggest nearby research themes you can leverage for proposals.
        <HelpTip text="Try targeting funders active in neighboring clusters to improve proposal fit." />
      </p>
      <ul className="text-xs text-gray-600 mb-3 list-disc pl-5 space-y-1">
        <li>Dense clusters indicate domain neighborhoods where adjacent fields share language and methods.</li>
        <li>Use hover details to compare field funding and institutional context before picking collaborators.</li>
      </ul>
      {loading && <p className="text-sm text-gray-500 mb-2">Loading model data...</p>}
      {error && <p className="text-sm text-red-600 mb-2">Error: {error}</p>}

      <div className="w-full overflow-hidden flex justify-center">
        <Plot
          data={[
            {
              x: rows.map((d) => d.x_coord),
              y: rows.map((d) => d.y_coord),
              text: rows.map(
                (d) =>
                  `Field: ${d.for4_name}<br>Code: ${d.for4_code}<br>Group: ${d.institution_group}<br>Funding: ${formatCompactUsd(d.funding)}`,
              ),
              mode: "markers",
              type: "scatter",
              marker: { size: markerSize, color: markerColor, opacity: 0.8 },
              hovertemplate: "%{text}<extra></extra>",
            },
          ]}
          layout={{
            autosize: true,
            height: 400,
            margin: { t: 20, b: 60, l: 70, r: 24 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#888888" },
            xaxis: {
              title: { text: "Similarity Dimension 1", standoff: 12 },
              showgrid: true,
              gridcolor: "#4b5563",
              zeroline: true,
              zerolinecolor: "#4b5563",
              showticklabels: true,
              automargin: true,
            },
            yaxis: {
              title: { text: "Similarity Dimension 2", standoff: 12 },
              showgrid: true,
              gridcolor: "#4b5563",
              zeroline: true,
              zerolinecolor: "#4b5563",
              showticklabels: true,
              automargin: true,
            },
          }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler
          style={{ width: "100%", height: "400px" }}
        />
      </div>
      {zoomed && (
        <div className="fixed inset-0 z-50 bg-black/50 p-6">
          <div className="bg-white dark:bg-slate-900 rounded shadow-xl h-full w-full p-4 border dark:border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Idea Similarity Map (Zoomed)</h3>
              <button className="text-xs border rounded px-2 py-1" onClick={() => setZoomed(false)}>
                Close
              </button>
            </div>
            <div className="h-[calc(100%-36px)]">
              <Plot
                data={[
                  {
                    x: rows.map((d) => d.x_coord),
                    y: rows.map((d) => d.y_coord),
                    text: rows.map(
                      (d) =>
                        `Field: ${d.for4_name}<br>Code: ${d.for4_code}<br>Group: ${d.institution_group}<br>Funding: ${formatCompactUsd(d.funding)}`,
                    ),
                    mode: "markers",
                    type: "scatter",
                    marker: { size: markerSize, color: markerColor, opacity: 0.82 },
                    hovertemplate: "%{text}<extra></extra>",
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { t: 20, b: 70, l: 80, r: 24 },
                  paper_bgcolor: "transparent",
                  plot_bgcolor: "transparent",
                  xaxis: {
                    title: { text: "Similarity Dimension 1", standoff: 14 },
                    showgrid: true,
                    gridcolor: chartTheme.similarity.grid,
                    zeroline: true,
                    zerolinecolor: chartTheme.similarity.zero,
                    showticklabels: true,
                    automargin: true,
                  },
                  yaxis: {
                    title: { text: "Similarity Dimension 2", standoff: 14 },
                    showgrid: true,
                    gridcolor: chartTheme.similarity.grid,
                    zeroline: true,
                    zerolinecolor: chartTheme.similarity.zero,
                    showticklabels: true,
                    automargin: true,
                  },
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}