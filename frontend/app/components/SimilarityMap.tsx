"use client";

import Plot from "react-plotly.js";

const data = [
  { x: 1, y: 2, institution: "CMU", funding: 100 },
  { x: 2, y: 1, institution: "MIT", funding: 200 },
];

export default function SimilarityMap() {
  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">
        Idea Similarity Map
      </h2>

      <Plot
        data={[
          {
            x: data.map(d => d.x),
            y: data.map(d => d.y),
            mode: "markers",
            type: "scatter",
            marker: { size: data.map(d => d.funding / 10) }
          }
        ]}
        layout={{ width: 800, height: 400 }}
      />
    </div>
  );
}