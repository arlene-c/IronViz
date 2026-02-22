"use client";

import { useEffect, useState } from "react";
import AdminDashboard from "./components/AdminDashboard";
import DecisionAssistant from "./components/DecisionAssistant";
import ResearchDashboard from "./components/ResearchDashboard";

export default function Home() {
  const [view, setView] = useState<"admin" | "research">("admin");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (isDark) {
      root.classList.add("dark");
      body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      body.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div
      className={`min-h-screen p-6 transition-colors duration-200 ${
        isDark
          ? "dark bg-slate-950 text-slate-100"
          : "bg-gradient-to-br from-slate-50 via-white to-rose-50 text-gray-900"
      }`}
    >
      
      <div className="flex justify-between items-center mb-6">
        {/* Left Side: Dashboard Toggles */}
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => setView("admin")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              view === "admin" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Strategic View
          </button>

          <button
            onClick={() => setView("research")}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              view === "research" 
                ? "bg-green-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Research View
          </button>

        </div>

        {/* Right Side: Dark Mode Toggle Button */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 px-4 rounded-full font-medium bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white transition-colors border border-gray-300 dark:border-gray-600 shadow-sm hover:opacity-80"
        >
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-6">
        <section>
          <h2 className="text-lg font-semibold mb-3">
            {view === "admin" ? "Admin Decision Workspace" : "Researcher Decision Workspace"}
          </h2>
          <DecisionAssistant role={view} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">
            {view === "admin" ? "Admin Insights & Predictive Analytics" : "Research Insights & Predictive Analytics"}
          </h2>
          {view === "admin" ? <AdminDashboard /> : <ResearchDashboard />}
        </section>
      </div>
    </div>
  );
}
