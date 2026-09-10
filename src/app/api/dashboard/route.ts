import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveGeneratorStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

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
      issueReports: {
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        include: { scanEvent: { select: { actorType: true, actorId: true, clientTimestamp: true } } },
      },
    },
  });

  // Collect every worker/customer id we need a display name for in one pass.
  const workerIds = new Set<string>();
  const customerIds = new Set<string>();
  for (const g of generators) {
    const last = g.scanEvents[0];
    if (last) workerIds.add(last.actorId);
    for (const issue of g.issueReports) {
      (issue.scanEvent.actorType === "WORKER" ? workerIds : customerIds).add(issue.scanEvent.actorId);
    }
  }
  const [workers, customers] = await Promise.all([
    prisma.worker.findMany({ where: { id: { in: [...workerIds] } }, select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { id: { in: [...customerIds] } }, select: { id: true, name: true } }),
  ]);
  const workerNameById = new Map(workers.map((w) => [w.id, w.name]));
  const customerNameById = new Map(customers.map((c) => [c.id, c.name]));

  const result = generators.map((g) => {
    const derived = deriveGeneratorStatus(g.generatorType.runtimeMinutes, g.scanEvents);
    const lastEvent = g.scanEvents[0] ?? null;
    const customer = g.assignments[0]?.customer ?? null;
    return {
      id: g.id,
      label: g.label,
      generatorTypeName: g.generatorType.name,
      runtimeMinutes: g.generatorType.runtimeMinutes,
      // Generators have no location of their own — the map shows where the assigned customer is.
      latitude: customer?.latitude ?? null,
      longitude: customer?.longitude ?? null,
      customerName: customer?.name ?? null,
      status: derived.status,
      deadline: derived.deadline ? derived.deadline.toISOString() : null,
      minutesRemaining: derived.minutesRemaining,
      refuelCountToday: derived.refuelCountToday,
      lastRefuelAt: lastEvent ? lastEvent.clientTimestamp.toISOString() : null,
      lastRefuelByName: lastEvent ? (workerNameById.get(lastEvent.actorId) ?? null) : null,
      problemReported: g.issueReports.length > 0,
      openIssues: g.issueReports.map((issue) => ({
        id: issue.id,
        note: issue.note,
        reportedByType: issue.scanEvent.actorType,
        reportedByName:
          issue.scanEvent.actorType === "WORKER"
            ? (workerNameById.get(issue.scanEvent.actorId) ?? null)
            : (customerNameById.get(issue.scanEvent.actorId) ?? null),
        reportedAt: issue.scanEvent.clientTimestamp.toISOString(),
        needsHelp: issue.needsHelp,
        workerNote: issue.workerNote,
      })),
    };
  });

  return NextResponse.json({ generators: result, fetchedAt: new Date().toISOString() });
}
