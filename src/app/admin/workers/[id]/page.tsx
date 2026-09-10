import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worker = await prisma.worker.findUnique({ where: { id } });
  if (!worker) notFound();

  const grouped = await prisma.scanEvent.groupBy({
    by: ["generatorId"],
    where: { actorType: "WORKER", actorId: id, type: "REFUEL" },
    _count: { generatorId: true },
    orderBy: { _count: { generatorId: "desc" } },
  });

  const generators = await prisma.generator.findMany({
    where: { id: { in: grouped.map((g) => g.generatorId) } },
    select: { id: true, label: true },
  });
  const labelById = new Map(generators.map((g) => [g.id, g.label]));

  const totalServices = grouped.reduce((sum, g) => sum + g._count.generatorId, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/workers" className="text-sm text-slate-500 hover:underline">
          ← Workers
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{worker.name}</h1>
        <p className="text-sm text-slate-500">
          {totalServices} refuel scan{totalServices === 1 ? "" : "s"} across {grouped.length} generator
          {grouped.length === 1 ? "" : "s"}.
        </p>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">Generator</th>
            <th className="py-2 text-right">Times serviced</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((g) => (
            <tr key={g.generatorId} className="border-b border-slate-100">
              <td className="py-2">
                <Link href={`/admin/generators/${g.generatorId}`} className="text-slate-700 hover:underline">
                  {labelById.get(g.generatorId) ?? "Unknown generator"}
                </Link>
              </td>
              <td className="py-2 text-right">{g._count.generatorId}</td>
            </tr>
          ))}
          {grouped.length === 0 && (
            <tr>
              <td colSpan={2} className="py-4 text-center text-slate-400">
                No refuels recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
