"use client";

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
  const top = [...data]
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    .slice(0, 10);

  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-1">Top Funder-to-Field Flows</h2>
      <p className="text-sm text-gray-600 mb-4">Ranked by AAU funding volume.</p>
      <div className="overflow-auto">
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
              <tr key={`${row.source}-${row.target}-${idx}`} className="border-b last:border-b-0">
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
    </div>
  );
}
