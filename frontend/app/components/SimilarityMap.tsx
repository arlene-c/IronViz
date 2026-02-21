"use client";

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
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">
        Idea Similarity Map
      </h2>
      {loading && <p className="text-sm text-gray-500 mb-2">Loading model data...</p>}
      {error && <p className="text-sm text-red-600 mb-2">Error: {error}</p>}

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
    </div>
  );
}
