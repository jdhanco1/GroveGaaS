import { prisma } from "@/lib/prisma";
import { countGeneratorsInOperation } from "@/lib/reports";
import Link from "next/link";

export default async function AdminOverviewPage() {
  const [generatorCount, customerCount, workerCount, openIssues, inOperation] = await Promise.all([
    prisma.generator.count(),
    prisma.customer.count({ where: { active: true } }),
    prisma.worker.count({ where: { active: true } }),
    prisma.issueReport.count({ where: { status: "OPEN" } }),
    countGeneratorsInOperation(),
  ]);

  const cards = [
    { label: "Generators", value: generatorCount, href: "/admin/generators" },
    { label: "In operation now", value: inOperation, href: "/dashboard" },
    { label: "Customers", value: customerCount, href: "/admin/customers" },
    { label: "Workers", value: workerCount, href: "/admin/workers" },
    { label: "Open issues", value: openIssues, href: "/admin/issues" },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">Everything actionable, one click away.</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400"
          >
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="text-3xl font-semibold text-slate-900">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Open live dashboard
        </Link>
        <Link href="/dashboard/map" className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Open map view
        </Link>
      </div>
    </div>
  );
}
