"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const mockData = [
  { field: "AI", targetingIndex: 0.4, growth: 0.3, funding: 20000000 },
  { field: "Robotics", targetingIndex: 1.2, growth: 0.4, funding: 15000000 },
  { field: "Climate", targetingIndex: 0.3, growth: 0.5, funding: 18000000 },
];

export default function OpportunityQuadrant() {
  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">
        Opportunity Quadrant
      </h2>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="targetingIndex"
            name="CMU Targeting Index"
          />
          <YAxis
            type="number"
            dataKey="growth"
            name="AAU Growth Rate"
          />
          <ZAxis
            type="number"
            dataKey="funding"
            range={[50, 400]}
          />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={mockData} fill="#2563eb" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}