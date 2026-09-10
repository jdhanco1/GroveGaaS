import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { deriveGeneratorStatus, type FuelStatus } from "@/lib/status";
import AutoRefresh from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<FuelStatus, string> = {
  IDLE: "bg-slate-100 text-slate-600",
  RUNNING: "bg-green-100 text-green-700",
  NEEDS_FUEL_SOON: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
};

// Public, read-only history/service view linked from the (unauthenticated, kiosk-friendly)
// dashboard — mirrors the admin generator detail page's data but with no edit actions.
export default async function GeneratorHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const generator = await prisma.generator.findUnique({
    where: { id },
    include: {
      generatorType: true,
      assignments: { where: { unassignedAt: null }, include: { customer: true } },
      maintenanceTags: { include: { tag: true }, orderBy: { createdAt: "desc" } },
      scanEvents: {
        orderBy: { clientTimestamp: "desc" },
        take: 50,
        include: { issueReport: true },
      },
    },
  });

  if (!generator) notFound();

  const refuelEvents = generator.scanEvents
    .filter((e) => e.type === "REFUEL")
    .map((e) => ({ clientTimestamp: e.clientTimestamp, generatorRunning: e.generatorRunning }));
  const derived = deriveGeneratorStatus(generator.generatorType.runtimeMinutes, refuelEvents);
  const activeCustomer = generator.assignments[0]?.customer;

  const workerIds = new Set<string>();
  const customerIds = new Set<string>();
  for (const e of generator.scanEvents) {
    (e.actorType === "WORKER" ? workerIds : customerIds).add(e.actorId);
  }
  const [workers, customers] = await Promise.all([
    prisma.worker.findMany({ where: { id: { in: [...workerIds] } } }),
    prisma.customer.findMany({ where: { id: { in: [...customerIds] } } }),
  ]);
  const nameById = new Map<string, string>([
    ...workers.map((w) => [w.id, w.name] as const),
    ...customers.map((c) => [c.id, c.name] as const),
  ]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <AutoRefresh />
      <Link href="/dashboard" className="text-sm text-slate-600 hover:underline">
        ← Dashboard
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{generator.label}</h1>
          <p className="text-sm text-slate-500">
            {generator.generatorType.name}
            {activeCustomer ? ` — ${activeCustomer.name}` : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[derived.status]}`}>
          {derived.status.replace(/_/g, " ")}
        </span>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-900">Maintenance / service items</h2>
        {generator.maintenanceTags.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm">
            {generator.maintenanceTags.map((mt) => (
              <li
                key={mt.id}
                className="flex items-center justify-between rounded border border-slate-100 px-3 py-2"
              >
                <span className={mt.resolvedAt ? "text-slate-400 line-through" : "text-slate-700"}>
                  {mt.tag.name} {mt.dueAt ? `— due ${mt.dueAt.toLocaleDateString()}` : ""}
                </span>
                <span className="text-xs text-slate-400">{mt.resolvedAt ? "Resolved" : "Open"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No maintenance items recorded.</p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-900">Recent activity</h2>
        {generator.scanEvents.length > 0 ? (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {generator.scanEvents.map((e) => (
              <li key={e.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">
                    {e.type === "REFUEL" ? "Refuel" : "Issue reported"}
                  </span>
                  <span className="text-xs text-slate-400">{e.clientTimestamp.toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-500">
                  By {nameById.get(e.actorId) ?? "Unknown"}
                  {e.type === "REFUEL" && e.gallonsAdded != null ? ` — ${e.gallonsAdded} gal added` : ""}
                  {e.type === "REFUEL" && e.generatorRunning === false ? " — generator turned off" : ""}
                </p>
                {e.note && <p className="mt-1 text-xs text-slate-600">{e.note}</p>}
                {e.issueReport && (
                  <p className="mt-1 text-xs">
                    Status:{" "}
                    <span className={e.issueReport.status === "OPEN" ? "text-red-600" : "text-green-600"}>
                      {e.issueReport.status}
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No activity recorded yet.</p>
        )}
      </section>
    </div>
  );
}
