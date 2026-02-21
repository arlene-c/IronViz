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
          className={`px-4 py-2 rounded ${view === "admin" ? "bg-blue-700 text-white" : "bg-blue-100 text-blue-800"}`}
        >
          Admin View
        </button>

        <button
          onClick={() => setView("research")}
          className={`px-4 py-2 rounded ${view === "research" ? "bg-green-700 text-white" : "bg-green-100 text-green-800"}`}
        >
          Research View
        </button>
      </div>

      {view === "admin" ? <AdminDashboard /> : <ResearchDashboard />}
    </div>
  );
}
