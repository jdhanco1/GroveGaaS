import { prisma } from "@/lib/prisma";
import { countGeneratorsInOperation } from "@/lib/reports";
import Link from "next/link";

export default async function AdminOverviewPage() {
  const [generatorCount, customerCount, workerCount, openIssues, needsHelp, inOperation] = await Promise.all([
    prisma.generator.count(),
    prisma.customer.count({ where: { active: true } }),
    prisma.worker.count({ where: { active: true } }),
    prisma.issueReport.count({ where: { status: "OPEN" } }),
    prisma.issueReport.count({ where: { status: "OPEN", needsHelp: true } }),
    countGeneratorsInOperation(),
  ]);

  const cards: { label: string; value: number; href: string; accent: string; sub?: string }[] = [
    {
      label: "Open issues",
      value: openIssues,
      href: "/admin/issues",
      accent: openIssues > 0 ? "text-purple-600" : "text-slate-900",
      sub: needsHelp > 0 ? `${needsHelp} need${needsHelp === 1 ? "s" : ""} help` : undefined,
    },
    { label: "In operation now", value: inOperation, href: "/dashboard", accent: "text-emerald-600" },
    { label: "Generators", value: generatorCount, href: "/admin/generators", accent: "text-slate-900" },
    { label: "Customers", value: customerCount, href: "/admin/customers", accent: "text-slate-900" },
    { label: "Workers", value: workerCount, href: "/admin/workers", accent: "text-slate-900" },
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">Everything actionable, one click away.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${c.accent}`}>{c.value}</p>
            <p className="mt-1 text-xs text-slate-400 group-hover:text-slate-500">{c.sub ?? "View →"}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          Open live dashboard
        </Link>
        <Link
          href="/dashboard/map"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Open map view
        </Link>
        <Link
          href="/admin/generators/new"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          + Add generator
        </Link>
      </div>
    </div>
  );
}
