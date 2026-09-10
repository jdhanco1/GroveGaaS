"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardResponse, DashboardStatus } from "@/lib/dashboard-types";

const POLL_INTERVAL_MS = 20_000;

const STATUS_STYLES: Record<DashboardStatus, string> = {
  IDLE: "bg-slate-100 text-slate-500 border-slate-200",
  RUNNING: "bg-green-50 text-green-800 border-green-200",
  NEEDS_FUEL_SOON: "bg-amber-50 text-amber-800 border-amber-300",
  OVERDUE: "bg-red-50 text-red-800 border-red-300",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // Keep showing the last known data if a poll fails.
      }
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const generators = data?.generators ?? [];
  const needsFuelSoon = generators.filter((g) => g.status === "NEEDS_FUEL_SOON");
  const overdue = generators.filter((g) => g.status === "OVERDUE");
  const problems = generators.filter((g) => g.problemReported);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Generator Dashboard</h1>
        <Link href="/dashboard/map" className="text-sm text-slate-600 hover:underline">
          Map view →
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">Needs fuel in next 30 min</p>
          <p className="text-3xl font-bold text-amber-900">{needsFuelSoon.length}</p>
        </div>
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Overdue</p>
          <p className="text-3xl font-bold text-red-900">{overdue.length}</p>
        </div>
        <div className="rounded-lg border-2 border-slate-300 bg-white p-4">
          <p className="text-sm font-medium text-slate-700">Reported problems</p>
          <p className="text-3xl font-bold text-slate-900">{problems.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {generators.map((g) => (
          <div key={g.id} className={`rounded-lg border-2 p-4 ${STATUS_STYLES[g.status]}`}>
            <div className="flex items-start justify-between">
              <p className="font-semibold">{g.label}</p>
              {g.problemReported && <span title="Problem reported">⚠️</span>}
            </div>
            <p className="text-xs opacity-75">{g.generatorTypeName}</p>
            <p className="mt-2 text-sm font-medium">{g.status.replace(/_/g, " ")}</p>
            {g.minutesRemaining !== null && (
              <p className="text-xs opacity-75">
                {g.minutesRemaining >= 0
                  ? `${Math.round(g.minutesRemaining)} min remaining`
                  : `${Math.round(-g.minutesRemaining)} min overdue`}
              </p>
            )}
            <p className="text-xs opacity-75">Refuels today: {g.refuelCountToday}</p>
            {g.customerName && <p className="mt-1 text-xs opacity-75">{g.customerName}</p>}
          </div>
        ))}
        {generators.length === 0 && <p className="col-span-4 text-slate-400">No generators yet.</p>}
      </div>
    </div>
  );
}
