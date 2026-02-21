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
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-700 cursor-help"
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
      className="dark:bg-gray-800 p-6 rounded shadow transition-colors duration-200 border"
      style={{ background: chartTheme.similarity.cardBackground, borderColor: chartTheme.similarity.cardBorder }}
    >
      <h2 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
        Idea Similarity Map
        <HelpTip text="Points that are closer are more conceptually similar. Larger circles indicate higher field funding. Green points indicate stronger CMU-relative positioning." />
      </h2>
      <p className="text-xs text-gray-600 mb-3">
        Insight: Clustered points suggest nearby research themes you can leverage for proposals.
        <HelpTip text="Try targeting funders active in neighboring clusters to improve proposal fit." />
      </p>
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
            width: 800,
            height: 400,
            margin: { t: 20, b: 20, l: 20, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#888888" },
            xaxis: {
              title: { text: "Similarity Dimension 1" },
              showgrid: true,
              gridcolor: chartTheme.similarity.grid,
              zeroline: true,
              zerolinecolor: chartTheme.similarity.zero,
              showticklabels: true,
            },
            yaxis: {
              title: { text: "Similarity Dimension 2" },
              showgrid: true,
              gridcolor: chartTheme.similarity.grid,
              zeroline: true,
              zerolinecolor: chartTheme.similarity.zero,
              showticklabels: true,
            },
          }}
          config={{ responsive: true, displayModeBar: false }}
        />
      </div>
    </div>
  );
}
