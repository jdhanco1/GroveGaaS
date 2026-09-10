import { prisma } from "@/lib/prisma";
import { deriveGeneratorStatus, type FuelStatus } from "@/lib/status";
import { generateQrDataUrl, scanUrlForToken } from "@/lib/qr";
import {
  saveGenerator,
  assignGenerator,
  unassignGenerator,
  attachMaintenanceTag,
  resolveMaintenanceTag,
  deleteGenerator,
} from "../actions";
import { notFound } from "next/navigation";

const STATUS_STYLES: Record<FuelStatus, string> = {
  IDLE: "bg-slate-100 text-slate-600",
  RUNNING: "bg-green-100 text-green-700",
  NEEDS_FUEL_SOON: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
};

export default async function GeneratorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [generator, types, customers, tags] = await Promise.all([
    prisma.generator.findUnique({
      where: { id },
      include: {
        generatorType: true,
        scanEvents: { where: { type: "REFUEL" }, select: { clientTimestamp: true, generatorRunning: true } },
        assignments: {
          orderBy: { assignedAt: "desc" },
          include: { customer: true },
        },
        maintenanceTags: { include: { tag: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.generatorType.findMany({ orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.maintenanceTag.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!generator) notFound();

  const derived = deriveGeneratorStatus(generator.generatorType.runtimeMinutes, generator.scanEvents);
  const scanUrl = scanUrlForToken(generator.qrToken);
  const qrDataUrl = await generateQrDataUrl(scanUrl);
  const activeAssignment = generator.assignments.find((a) => !a.unassignedAt);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{generator.label}</h1>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[derived.status]}`}>
            {derived.status.replace(/_/g, " ")}
          </span>
        </div>
        <form action={deleteGenerator}>
          <input type="hidden" name="id" value={generator.id} />
          <button className="text-sm text-red-600 hover:underline">Delete generator</button>
        </form>
      </div>

      <section className="grid grid-cols-2 gap-8">
        <form action={saveGenerator} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium text-slate-900">Details</h2>
          <input type="hidden" name="id" value={generator.id} />
          <div>
            <label className="block text-sm font-medium text-slate-700">Label</label>
            <input
              name="label"
              defaultValue={generator.label}
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Generator type</label>
            <select
              name="generatorTypeId"
              defaultValue={generator.generatorTypeId}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500">
            Location shown on the map comes from the assigned customer below — there&apos;s no separate
            generator location to set.
          </p>
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Save
          </button>
        </form>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-center">
          <h2 className="font-medium text-slate-900">QR Label</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR code for ${generator.label}`} className="mx-auto" />
          <p className="break-all text-xs text-slate-500">{scanUrl}</p>
          <a
            href={qrDataUrl}
            download={`${generator.label}-qr.png`}
            className="inline-block rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Download
          </a>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-900">Assignment</h2>
        {activeAssignment ? (
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700">
                Currently assigned to <strong>{activeAssignment.customer.name}</strong> since{" "}
                {activeAssignment.assignedAt.toLocaleDateString()}
              </p>
              <p className="text-xs text-slate-500">
                {activeAssignment.customer.latitude != null && activeAssignment.customer.longitude != null
                  ? `Map location: ${activeAssignment.customer.latitude.toFixed(5)}, ${activeAssignment.customer.longitude.toFixed(5)} (from customer)`
                  : "This customer has no map location set yet."}
              </p>
            </div>
            <form action={unassignGenerator}>
              <input type="hidden" name="assignmentId" value={activeAssignment.id} />
              <input type="hidden" name="generatorId" value={generator.id} />
              <button className="text-sm text-red-600 hover:underline">Unassign</button>
            </form>
          </div>
        ) : (
          <form action={assignGenerator} className="mt-2 flex items-end gap-3">
            <input type="hidden" name="generatorId" value={generator.id} />
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700">Assign to customer</label>
              <select name="customerId" required className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Assign
            </button>
          </form>
        )}

        {generator.assignments.length > 0 && (
          <details className="mt-4 text-sm text-slate-500">
            <summary className="cursor-pointer">Assignment history</summary>
            <ul className="mt-2 space-y-1">
              {generator.assignments.map((a) => (
                <li key={a.id}>
                  {a.customer.name}: {a.assignedAt.toLocaleDateString()} –{" "}
                  {a.unassignedAt ? a.unassignedAt.toLocaleDateString() : "present"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-900">Maintenance</h2>
        <form action={attachMaintenanceTag} className="mt-2 flex items-end gap-3">
          <input type="hidden" name="generatorId" value={generator.id} />
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700">Tag</label>
            <select name="maintenanceTagId" required className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Due date</label>
            <input name="dueAt" type="date" className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Attach
          </button>
        </form>

        <ul className="mt-4 space-y-2 text-sm">
          {generator.maintenanceTags.map((mt) => (
            <li key={mt.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2">
              <span className={mt.resolvedAt ? "text-slate-400 line-through" : "text-slate-700"}>
                {mt.tag.name} {mt.dueAt ? `— due ${mt.dueAt.toLocaleDateString()}` : ""}
              </span>
              {!mt.resolvedAt && (
                <form action={resolveMaintenanceTag}>
                  <input type="hidden" name="id" value={mt.id} />
                  <input type="hidden" name="generatorId" value={generator.id} />
                  <button className="text-slate-600 hover:underline">Mark resolved</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
