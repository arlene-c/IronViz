"use client";

import dynamic from "next/dynamic";

// DYNAMIC IMPORT IS MANDATORY FOR PLOTLY IN NEXT.JS!
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const data = [
  { x: 1, y: 2, institution: "CMU", funding: 100, name: "Robotics A" },
  { x: 2, y: 1, institution: "MIT", funding: 200, name: "AI Grant B" },
  { x: 1.5, y: 1.5, institution: "Stanford", funding: 150, name: "Climate C" },
];

export default function SimilarityMap() {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded shadow transition-colors duration-200">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
        Idea Similarity Map
      </h2>

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
    </div>
  );
}