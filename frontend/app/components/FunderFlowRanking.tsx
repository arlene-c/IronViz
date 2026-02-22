"use client";

import { useState } from "react";

type SankeyRow = {
  source: string;
  target: string;
  value: number;
  cmu_field_total?: number;
  growth_weighted_value?: number;
};

type Props = {
  data: SankeyRow[];
};

export default function FunderFlowRanking({ data }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const top = [...data]
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    .slice(0, 10);

  return (
<<<<<<< HEAD
    <div className="bg-white dark:bg-gray-800 p-6 rounded shadow text-gray-900 dark:text-white transition-colors duration-200">
      <h2 className="text-xl font-semibold mb-1">Top Funder-to-Field Flows</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Ranked by AAU funding volume.</p>
      <div className="overflow-x-auto">
=======
    <div className="bg-white p-6 rounded shadow">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-xl font-semibold">Top Funder-to-Field Flows</h2>
        <button className="text-xs border rounded px-2 py-1 bg-white/80 hover:bg-white" onClick={() => setZoomed(true)}>
          Zoom
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">Ranked by AAU funding volume.</p>
      <ul className="text-xs text-gray-600 mb-4 list-disc pl-5 space-y-1">
        <li>Use top rows as initial outreach targets for each high-priority field.</li>
        <li>Compare AAU flow versus CMU total to spot under-leveraged funder relationships.</li>
      </ul>
      <div className="overflow-auto">
>>>>>>> 18350c96a22622323c348f44fd146e57b640548c
        <table className="w-full text-sm">
          <thead className="text-left border-b dark:border-gray-700">
            <tr>
              <th className="py-2 pr-2">Rank</th>
              <th className="py-2 pr-2">Funder</th>
              <th className="py-2 pr-2">Field</th>
              <th className="py-2 pr-2">AAU Flow</th>
              <th className="py-2 pr-2">CMU Field Total</th>
            </tr>
          </thead>
          <tbody>
            {top.map((row, idx) => (
              <tr key={`${row.source}-${row.target}-${idx}`} className="border-b dark:border-gray-700 last:border-b-0">
                <td className="py-2 pr-2 font-semibold">{idx + 1}</td>
                <td className="py-2 pr-2">{row.source}</td>
                <td className="py-2 pr-2">{row.target}</td>
                <td className="py-2 pr-2">${Math.round(Number(row.value) || 0).toLocaleString()}</td>
                <td className="py-2 pr-2">
                  ${Math.round(Number(row.cmu_field_total) || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {zoomed && (
        <div className="fixed inset-0 z-50 bg-black/50 p-6">
          <div className="bg-white rounded shadow-xl h-full w-full p-4 overflow-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Top Funder-to-Field Flows (Zoomed)</h3>
              <button className="text-xs border rounded px-2 py-1" onClick={() => setZoomed(false)}>
                Close
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left border-b">
                <tr>
                  <th className="py-2 pr-2">Rank</th>
                  <th className="py-2 pr-2">Funder</th>
                  <th className="py-2 pr-2">Field</th>
                  <th className="py-2 pr-2">AAU Flow</th>
                  <th className="py-2 pr-2">CMU Field Total</th>
                </tr>
              </thead>
              <tbody>
                {top.map((row, idx) => (
                  <tr key={`zoom-${row.source}-${row.target}-${idx}`} className="border-b last:border-b-0">
                    <td className="py-2 pr-2 font-semibold">{idx + 1}</td>
                    <td className="py-2 pr-2">{row.source}</td>
                    <td className="py-2 pr-2">{row.target}</td>
                    <td className="py-2 pr-2">${Math.round(Number(row.value) || 0).toLocaleString()}</td>
                    <td className="py-2 pr-2">${Math.round(Number(row.cmu_field_total) || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}