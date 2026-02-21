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
  ReferenceLine,
  Cell
} from "recharts";

const mockData = [
  { field: "AI", targetingIndex: 0.4, growth: 0.8, funding: 20000000 },
  { field: "Robotics", targetingIndex: 1.2, growth: 0.4, funding: 15000000 },
  { field: "Climate", targetingIndex: 0.3, growth: 0.5, funding: 18000000 },
  { field: "Quantum", targetingIndex: 1.5, growth: 0.9, funding: 10000000 },
  { field: "Bio", targetingIndex: 0.8, growth: 0.2, funding: 8000000 },
];

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

export default function OpportunityQuadrant() {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded shadow transition-colors duration-200">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
        Opportunity Quadrant
      </h2>

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
    </div>
  );
}