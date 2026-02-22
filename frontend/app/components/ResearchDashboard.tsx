"use client";

import { useEffect, useMemo, useState } from "react";
import ProjectionBands from "./ProjectionBands";
import SimilarityMap from "./SimilarityMap";

type SimilarityNode = {
  grant_id: string;
  for4_code: string;
  for4_name: string;
  x_coord: number;
  y_coord: number;
  funding: number;
  institution_group: string;
};

type ForecastRow = {
  FOR4_CODE: string;
  FOR4_NAME: string;
  year: number;
  aau_forecast: number;
  aau_forecast_low?: number | null;
  aau_forecast_high?: number | null;
};

export default function ResearchDashboard() {
  const [similarity, setSimilarity] = useState<SimilarityNode[]>([]);
  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [simRes, forecastRes] = await Promise.all([
          fetch("/api/models/similarity", { cache: "no-store" }),
          fetch("/api/models/forecast", { cache: "no-store" }),
        ]);
        if (!simRes.ok || !forecastRes.ok) {
          throw new Error(`Similarity ${simRes.status}, Forecast ${forecastRes.status}`);
        }
        const [simJson, forecastJson] = await Promise.all([simRes.json(), forecastRes.json()]);
        if (isMounted) {
          setSimilarity(Array.isArray(simJson.data) ? simJson.data : []);
          setForecast(Array.isArray(forecastJson.data) ? forecastJson.data : []);
        }
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Failed to load research insights");
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
  }, []);

  const topForecastFields = useMemo(
    () =>
      [...forecast]
        .filter((d) => Number(d.year) === 2026)
        .sort((a, b) => (Number(b.aau_forecast) || 0) - (Number(a.aau_forecast) || 0))
        .slice(0, 5),
    [forecast],
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold">Research Discovery Console</h1>
        <p className="text-sm text-gray-600 mt-1">
          Explore nearby fields, identify high-growth themes, and inspect 2026 funding trajectories.
        </p>
        {loading && <p className="text-sm text-gray-500 mt-2">Loading research insights...</p>}
        {error && <p className="text-sm text-red-600 mt-2">Error: {error}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Similarity nodes</p>
          <p className="text-2xl font-bold">{similarity.length}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Forecast rows</p>
          <p className="text-2xl font-bold">{forecast.length}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Top 2026 forecast</p>
          <p className="text-2xl font-bold">
            ${Math.round(Number(topForecastFields[0]?.aau_forecast || 0)).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <SimilarityMap data={similarity} />
        </div>
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-1">Top 2026 Field Forecasts</h2>
          <p className="text-sm text-gray-600 mb-4">Ranked by predicted AAU funding.</p>
          <ul className="text-xs text-gray-600 mb-4 list-disc pl-5 space-y-1">
            <li>Use this list to select fields with stronger near-term external momentum.</li>
            <li>Pair top forecast fields with nearby similarity clusters for idea positioning.</li>
          </ul>
          <ol className="space-y-2">
            {topForecastFields.map((row, idx) => (
              <li key={`${row.FOR4_CODE}-${row.year}`} className="flex justify-between items-start gap-3 border-b pb-2 last:border-b-0">
                <div>
                  <p className="font-semibold">{idx + 1}. {row.FOR4_NAME}</p>
                  <p className="text-xs text-gray-500">Code: {row.FOR4_CODE}</p>
                </div>
                <span className="font-bold">${Math.round(Number(row.aau_forecast) || 0).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <ProjectionBands data={forecast} />
    </div>
  );
}
