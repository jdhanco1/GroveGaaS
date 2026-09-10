"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DashboardResponse, DashboardGenerator, DashboardStatus } from "@/lib/dashboard-types";

const POLL_INTERVAL_MS = 5_000;

const STATUS_STYLES: Record<DashboardStatus, string> = {
  IDLE: "bg-slate-100 text-slate-500 border-slate-200",
  RUNNING: "bg-green-50 text-green-800 border-green-200",
  NEEDS_FUEL_SOON: "bg-amber-50 text-amber-800 border-amber-300",
  OVERDUE: "bg-red-50 text-red-800 border-red-300",
};

// Most-urgent-first ordering used by the "Status (urgency)" sort.
const STATUS_URGENCY: Record<DashboardStatus, number> = {
  OVERDUE: 0,
  NEEDS_FUEL_SOON: 1,
  RUNNING: 2,
  IDLE: 3,
};

type SortMode = "urgency" | "label" | "customer" | "remaining";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "urgency", label: "Status (most urgent first)" },
  { value: "remaining", label: "Time remaining" },
  { value: "label", label: "Generator name (A–Z)" },
  { value: "customer", label: "Customer (A–Z)" },
];

function sortGenerators(generators: DashboardGenerator[], sortBy: SortMode): DashboardGenerator[] {
  const sorted = [...generators];
  switch (sortBy) {
    case "label":
      sorted.sort((a, b) => a.label.localeCompare(b.label));
      break;
    case "customer":
      sorted.sort((a, b) => (a.customerName ?? "").localeCompare(b.customerName ?? ""));
      break;
    case "remaining":
      sorted.sort((a, b) => (a.minutesRemaining ?? Infinity) - (b.minutesRemaining ?? Infinity));
      break;
    case "urgency":
    default:
      sorted.sort((a, b) => {
        const byStatus = STATUS_URGENCY[a.status] - STATUS_URGENCY[b.status];
        if (byStatus !== 0) return byStatus;
        return (a.minutesRemaining ?? Infinity) - (b.minutesRemaining ?? Infinity);
      });
      break;
  }
  return sorted;
}

/** Formats a duration in seconds as (-)HH:MM:SS. */
function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.round(Math.abs(totalSeconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${sign}${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>("urgency");
  const [now, setNow] = useState(() => Date.now());

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
    // Refresh right away when the kiosk/tab comes back into view rather than waiting a full interval.
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, []);

  // Ticks every second so each card's HH:MM:SS timer stays live between polls.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const generators = useMemo(() => data?.generators ?? [], [data]);
  const sortedGenerators = useMemo(() => sortGenerators(generators, sortBy), [generators, sortBy]);
  const needsFuelSoon = generators.filter((g) => g.status === "NEEDS_FUEL_SOON");
  const overdue = generators.filter((g) => g.status === "OVERDUE");
  const problems = generators.filter((g) => g.problemReported);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Generator Dashboard</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Sort by
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <Link href="/dashboard/map" className="text-sm text-slate-600 hover:underline">
            Map view →
          </Link>
        </div>
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
        {sortedGenerators.map((g) => {
          const liveSeconds = g.deadline ? (new Date(g.deadline).getTime() - now) / 1000 : null;
          return (
            <Link
              key={g.id}
              href={`/dashboard/generators/${g.id}`}
              className={`block rounded-lg border-2 p-4 transition hover:shadow-md ${STATUS_STYLES[g.status]}`}
            >
              <div className="flex items-start justify-between">
                <p className="font-semibold">{g.label}</p>
                {g.problemReported && <span title="Problem reported">⚠️</span>}
              </div>
              <p className="text-xs opacity-75">{g.generatorTypeName}</p>
              <p className="mt-2 text-sm font-medium">{g.status.replace(/_/g, " ")}</p>
              {liveSeconds !== null && (
                <p className="font-mono text-xs opacity-75">
                  {formatDuration(liveSeconds)} {liveSeconds >= 0 ? "remaining" : "overdue"}
                </p>
              )}
              <p className="text-xs opacity-75">Refuels today: {g.refuelCountToday}</p>
              {g.lastRefuelAt && (
                <p className="text-xs opacity-75">
                  Last refuel: {new Date(g.lastRefuelAt).toLocaleString()}
                  {g.lastRefuelByName ? ` by ${g.lastRefuelByName}` : ""}
                </p>
              )}
              {g.customerName && <p className="mt-1 text-xs opacity-75">{g.customerName}</p>}
            </Link>
          );
        })}
        {generators.length === 0 && <p className="col-span-4 text-slate-400">No generators yet.</p>}
      </div>
    </div>
  );
}
