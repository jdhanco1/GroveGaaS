import { prisma } from "@/lib/prisma";
import { deriveGeneratorStatus, type FuelStatus } from "@/lib/status";
import Link from "next/link";

const STATUS_STYLES: Record<FuelStatus, string> = {
  IDLE: "bg-slate-100 text-slate-600",
  RUNNING: "bg-green-100 text-green-700",
  NEEDS_FUEL_SOON: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
};

export default async function GeneratorsPage() {
  const generators = await prisma.generator.findMany({
    orderBy: { label: "asc" },
    include: {
      generatorType: true,
      assignments: { where: { unassignedAt: null }, include: { customer: true } },
      scanEvents: { where: { type: "REFUEL" }, select: { clientTimestamp: true } },
    },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Generator Inventory</h1>
          <p className="text-sm text-slate-500">All generators, their live status, and current assignment.</p>
        </div>
        <Link
          href="/admin/generators/new"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add generator
        </Link>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">Label</th>
            <th className="py-2">Type</th>
            <th className="py-2">Status</th>
            <th className="py-2">Assigned to</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {generators.map((g) => {
            const derived = deriveGeneratorStatus(g.generatorType.runtimeMinutes, g.scanEvents);
            return (
              <tr key={g.id} className="border-b border-slate-100">
                <td className="py-2">{g.label}</td>
                <td className="py-2">{g.generatorType.name}</td>
                <td className="py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[derived.status]}`}>
                    {derived.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-2">{g.assignments[0]?.customer.name ?? "—"}</td>
                <td className="py-2 text-right">
                  <Link href={`/admin/generators/${g.id}`} className="text-slate-600 hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
