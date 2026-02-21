"use client";

<<<<<<< HEAD
import dynamic from "next/dynamic";

// DYNAMIC IMPORT IS MANDATORY FOR PLOTLY IN NEXT.JS!
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const data = [
  { x: 1, y: 2, institution: "CMU", funding: 100, name: "Robotics A" },
  { x: 2, y: 1, institution: "MIT", funding: 200, name: "AI Grant B" },
  { x: 1.5, y: 1.5, institution: "Stanford", funding: 150, name: "Climate C" },
];
=======
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

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
>>>>>>> 66f539b5e985224c8e803bfbd6c0eab03cce9574

type Props = {
  data?: SimilarityNode[];
};

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

  const markerSize = useMemo(() => rows.map((d) => Math.max(8, Math.sqrt((d.funding ?? 0) / 2_000_000))), [rows]);
  const markerColor = useMemo(() => rows.map((d) => (d.institution_group === "CMU" ? "#16a34a" : "#2563eb")), [rows]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded shadow transition-colors duration-200">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
        Idea Similarity Map
      </h2>
      {loading && <p className="text-sm text-gray-500 mb-2">Loading model data...</p>}
      {error && <p className="text-sm text-red-600 mb-2">Error: {error}</p>}

<<<<<<< HEAD
      <div className="w-full overflow-hidden flex justify-center">
        <Plot
          data={[
            {
              x: data.map((d) => d.x),
              y: data.map((d) => d.y),
              text: data.map((d) => `<b>${d.institution}</b><br>${d.name}<br>$${d.funding}M`),
              mode: "markers",
              type: "scatter",
              hoverinfo: "text",
              marker: { 
                size: data.map((d) => d.funding / 5), 
                // Highlight CMU grants in a specific color
                color: data.map((d) => d.institution === "CMU" ? "#ef4444" : "#3b82f6"),
                opacity: 0.8
              }
            }
          ]}
          layout={{
            width: 800,
            height: 400,
            margin: { t: 20, b: 20, l: 20, r: 20 },
            // These make the graph blend into dark mode!
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#888888" },
            // Hide the grid lines so it looks like a floating spatial map
            xaxis: { showgrid: false, zeroline: false, showticklabels: false },
            yaxis: { showgrid: false, zeroline: false, showticklabels: false },
          }}
          config={{ responsive: true, displayModeBar: false }}
        />
      </div>
=======
      <Plot
        data={[
          {
            x: rows.map((d) => d.x_coord),
            y: rows.map((d) => d.y_coord),
            text: rows.map((d) => d.for4_name),
            mode: "markers",
            type: "scatter",
            marker: { size: markerSize, color: markerColor, opacity: 0.8 },
          },
        ]}
        layout={{ width: 800, height: 400, margin: { l: 30, r: 20, t: 10, b: 30 } }}
      />
>>>>>>> 66f539b5e985224c8e803bfbd6c0eab03cce9574
    </div>
  );
}
