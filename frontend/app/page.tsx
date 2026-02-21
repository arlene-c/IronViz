"use client";

import { useState } from "react";
import AdminDashboard from "./components/AdminDashboard";
import ResearchDashboard from "./components/ResearchDashboard";

export default function Home() {
  const [view, setView] = useState<"admin" | "research">("admin");

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setView("admin")}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Strategic View
        </button>

        <button
          onClick={() => setView("research")}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Research View
        </button>
      </div>

      {view === "admin" ? <AdminDashboard /> : <ResearchDashboard />}
    </div>
  );
}