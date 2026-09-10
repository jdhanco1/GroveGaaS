import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveGeneratorStatus } from "@/lib/status";

export async function GET() {
  const generators = await prisma.generator.findMany({
    where: { active: true },
    include: {
      generatorType: true,
      scanEvents: {
        where: { type: "REFUEL" },
        select: { clientTimestamp: true, generatorRunning: true, actorId: true },
        orderBy: { clientTimestamp: "desc" },
      },
      assignments: { where: { unassignedAt: null }, include: { customer: true } },
      issueReports: { where: { status: "OPEN" } },
    },
  });

  const lastActorIds = new Set<string>();
  for (const g of generators) {
    const last = g.scanEvents[0];
    if (last) lastActorIds.add(last.actorId);
  }
  const workers = await prisma.worker.findMany({ where: { id: { in: [...lastActorIds] } } });
  const workerNameById = new Map(workers.map((w) => [w.id, w.name]));

  const result = generators.map((g) => {
    const derived = deriveGeneratorStatus(g.generatorType.runtimeMinutes, g.scanEvents);
    const lastEvent = g.scanEvents[0] ?? null;
    return {
      id: g.id,
      label: g.label,
      generatorTypeName: g.generatorType.name,
      latitude: g.latitude,
      longitude: g.longitude,
      customerName: g.assignments[0]?.customer.name ?? null,
      status: derived.status,
      deadline: derived.deadline ? derived.deadline.toISOString() : null,
      minutesRemaining: derived.minutesRemaining,
      refuelCountToday: derived.refuelCountToday,
      lastRefuelAt: lastEvent ? lastEvent.clientTimestamp.toISOString() : null,
      lastRefuelByName: lastEvent ? (workerNameById.get(lastEvent.actorId) ?? null) : null,
      problemReported: g.issueReports.length > 0,
    };
  });

  return NextResponse.json({ generators: result, fetchedAt: new Date().toISOString() });
}
