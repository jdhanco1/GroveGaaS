"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  DashboardResponse,
  DashboardGenerator,
  DashboardIssue,
  DashboardStatus,
} from "@/lib/dashboard-types";

const POLL_INTERVAL_MS = 5_000;

// Most-urgent-first ordering used by the "Status (urgency)" sort.
const STATUS_URGENCY: Record<DashboardStatus, number> = {
  OVERDUE: 0,
  NEEDS_FUEL_SOON: 1,
  RUNNING: 2,
  IDLE: 3,
};

const STATUS_META: Record<DashboardStatus, { label: string; pill: string; bar: string; ring: string }> = {
  OVERDUE: {
    label: "Overdue",
    pill: "bg-red-100 text-red-700",
    bar: "bg-red-500",
    ring: "ring-red-300",
  },
  NEEDS_FUEL_SOON: {
    label: "Needs fuel soon",
    pill: "bg-amber-100 text-amber-700",
    bar: "bg-amber-500",
    ring: "ring-amber-300",
  },
  RUNNING: {
    label: "Running",
    pill: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-500",
    ring: "ring-emerald-200",
  },
  IDLE: {
    label: "Idle",
    pill: "bg-slate-100 text-slate-600",
    bar: "bg-slate-300",
    ring: "ring-slate-200",
  },
};

type SortMode = "urgency" | "label" | "customer" | "remaining";
type Filter = "ALL" | DashboardStatus | "PROBLEMS";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "urgency", label: "Most urgent first" },
  { value: "remaining", label: "Time remaining" },
  { value: "label", label: "Generator name" },
  { value: "customer", label: "Customer" },
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

/** "3m ago", "2h ago", etc. */
function timeAgo(iso: string, now: number): string {
  const diffSec = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

interface StatCardProps {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  accent: string; // tailwind text color for the number
  activeRing: string;
  hint?: string;
}

function StatCard({ label, value, active, onClick, accent, activeRing, hint }: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex flex-col items-start rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        active ? `border-transparent ring-2 ${activeRing}` : "border-slate-200"
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`mt-1 text-3xl font-semibold tabular-nums ${accent}`}>{value}</span>
      <span className="mt-1 text-xs text-slate-400 group-hover:text-slate-500">
        {active ? "Showing only these · click to clear" : (hint ?? "Click to filter")}
      </span>
    </button>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>("urgency");
  const [filter, setFilter] = useState<Filter>("ALL");
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

  const counts = useMemo(
    () => ({
      OVERDUE: generators.filter((g) => g.status === "OVERDUE").length,
      NEEDS_FUEL_SOON: generators.filter((g) => g.status === "NEEDS_FUEL_SOON").length,
      RUNNING: generators.filter((g) => g.status === "RUNNING").length,
      IDLE: generators.filter((g) => g.status === "IDLE").length,
      PROBLEMS: generators.filter((g) => g.problemReported).length,
    }),
    [generators]
  );

  const visible = useMemo(() => {
    const filtered =
      filter === "ALL"
        ? generators
        : filter === "PROBLEMS"
          ? generators.filter((g) => g.problemReported)
          : generators.filter((g) => g.status === filter);
    return sortGenerators(filtered, sortBy);
  }, [generators, filter, sortBy]);

  // Flattened list of open issues with their generator, newest first — powers the issues panel.
  const issues = useMemo(() => {
    const rows: { issue: DashboardIssue; generator: DashboardGenerator }[] = [];
    for (const g of generators) {
      for (const issue of g.openIssues) rows.push({ issue, generator: g });
    }
    rows.sort((a, b) => new Date(b.issue.reportedAt).getTime() - new Date(a.issue.reportedAt).getTime());
    return rows;
  }, [generators]);

  const toggleFilter = (next: Filter) => setFilter((cur) => (cur === next ? "ALL" : next));
  const secondsSinceFetch = data ? Math.round((now - new Date(data.fetchedAt).getTime()) / 1000) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">Generator Dashboard</h1>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
              {secondsSinceFetch !== null && (
                <span className="text-emerald-600/70">· {secondsSinceFetch}s ago</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="hidden sm:inline">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortMode)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <Link
              href="/dashboard/map"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Map view
            </Link>
            <Link
              href="/admin"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Overdue"
            value={counts.OVERDUE}
            active={filter === "OVERDUE"}
            onClick={() => toggleFilter("OVERDUE")}
            accent="text-red-600"
            activeRing="ring-red-400"
          />
          <StatCard
            label="Needs fuel soon"
            value={counts.NEEDS_FUEL_SOON}
            active={filter === "NEEDS_FUEL_SOON"}
            onClick={() => toggleFilter("NEEDS_FUEL_SOON")}
            accent="text-amber-600"
            activeRing="ring-amber-400"
            hint="Under 30 min left"
          />
          <StatCard
            label="Reported problems"
            value={counts.PROBLEMS}
            active={filter === "PROBLEMS"}
            onClick={() => toggleFilter("PROBLEMS")}
            accent="text-purple-600"
            activeRing="ring-purple-400"
            hint="Click to see who reported what"
          />
          <StatCard
            label="Running"
            value={counts.RUNNING}
            active={filter === "RUNNING"}
            onClick={() => toggleFilter("RUNNING")}
            accent="text-emerald-600"
            activeRing="ring-emerald-400"
          />
          <StatCard
            label="Idle"
            value={counts.IDLE}
            active={filter === "IDLE"}
            onClick={() => toggleFilter("IDLE")}
            accent="text-slate-600"
            activeRing="ring-slate-400"
          />
          <StatCard
            label="Total"
            value={generators.length}
            active={filter === "ALL"}
            onClick={() => setFilter("ALL")}
            accent="text-slate-900"
            activeRing="ring-slate-900"
            hint="Show everything"
          />
        </section>

        {filter === "PROBLEMS" && (
          <section className="rounded-xl border border-purple-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-purple-100 px-5 py-3">
              <h2 className="font-semibold text-slate-900">
                Open problems{" "}
                <span className="ml-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                  {issues.length}
                </span>
              </h2>
              <Link href="/admin/issues" className="text-sm font-medium text-purple-700 hover:underline">
                Manage in admin →
              </Link>
            </div>
            {issues.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No open problems right now.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {issues.map(({ issue, generator }) => (
                  <li key={issue.id}>
                    <Link
                      href={`/dashboard/generators/${generator.id}`}
                      className="flex items-start gap-4 px-5 py-3 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">{generator.label}</span>
                          {generator.customerName && (
                            <span className="text-sm text-slate-500">· {generator.customerName}</span>
                          )}
                          {issue.needsHelp && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                              Needs help
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-700">
                          {issue.note || <span className="italic text-slate-400">No description provided</span>}
                        </p>
                        {issue.workerNote && (
                          <p className="mt-0.5 text-xs text-purple-700">Worker note: {issue.workerNote}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          Reported by{" "}
                          <span className="font-medium text-slate-700">{issue.reportedByName ?? "Unknown"}</span>{" "}
                          <span className="text-slate-400">
                            ({issue.reportedByType === "WORKER" ? "worker" : "customer"})
                          </span>{" "}
                          · {timeAgo(issue.reportedAt, now)}
                        </p>
                      </div>
                      <span className="mt-1 text-slate-300">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-500">
              {filter === "ALL"
                ? `All generators (${visible.length})`
                : `${visible.length} of ${generators.length} generators`}
            </h2>
            {filter !== "ALL" && (
              <button
                type="button"
                onClick={() => setFilter("ALL")}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              {generators.length === 0 ? "No generators yet." : "Nothing matches this filter."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((g) => {
                const meta = STATUS_META[g.status];
                const liveSeconds = g.deadline ? (new Date(g.deadline).getTime() - now) / 1000 : null;
                const fuelPct =
                  liveSeconds !== null && g.runtimeMinutes > 0
                    ? Math.max(0, Math.min(100, (liveSeconds / 60 / g.runtimeMinutes) * 100))
                    : null;
                const issueCount = g.openIssues.length;
                return (
                  <Link
                    key={g.id}
                    href={`/dashboard/generators/${g.id}`}
                    className={`group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-0 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ${meta.ring}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{g.label}</p>
                        <p className="truncate text-xs text-slate-500">{g.generatorTypeName}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.pill}`}>
                        {meta.label}
                      </span>
                    </div>

                    {liveSeconds !== null ? (
                      <div className="mt-3">
                        <div className="flex items-baseline justify-between">
                          <span
                            className={`font-mono text-lg font-semibold tabular-nums ${
                              liveSeconds < 0
                                ? "text-red-600"
                                : liveSeconds < 600
                                  ? "text-amber-600"
                                  : "text-slate-900"
                            }`}
                          >
                            {formatDuration(liveSeconds)}
                          </span>
                          <span className="text-xs text-slate-500">{liveSeconds >= 0 ? "remaining" : "overdue"}</span>
                        </div>
                        {fuelPct !== null && (
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all ${meta.bar}`}
                              style={{ width: `${fuelPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">Not running today</p>
                    )}

                    <dl className="mt-3 space-y-1 text-xs text-slate-500">
                      <div className="flex justify-between gap-2">
                        <dt>Refuels today</dt>
                        <dd className="font-medium text-slate-700">{g.refuelCountToday}</dd>
                      </div>
                      {g.lastRefuelAt && (
                        <div className="flex justify-between gap-2">
                          <dt>Last refuel</dt>
                          <dd className="truncate text-right font-medium text-slate-700">
                            {timeAgo(g.lastRefuelAt, now)}
                            {g.lastRefuelByName ? ` · ${g.lastRefuelByName}` : ""}
                          </dd>
                        </div>
                      )}
                      {g.customerName && (
                        <div className="flex justify-between gap-2">
                          <dt>Customer</dt>
                          <dd className="truncate text-right font-medium text-slate-700">{g.customerName}</dd>
                        </div>
                      )}
                    </dl>

                    {issueCount > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700">
                        <span aria-hidden>⚠</span>
                        {issueCount} open problem{issueCount === 1 ? "" : "s"}
                        {g.openIssues.some((i) => i.needsHelp) && <span className="ml-auto">Needs help</span>}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
