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
        select: { clientTimestamp: true, generatorRunning: true, actorType: true, actorId: true },
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

  // Collect every actor id we need a display name for in one pass.
  const workerIds = new Set<string>();
  const customerIds = new Set<string>();
  const adminIds = new Set<string>();
  const collectActor = (actorType: "WORKER" | "CUSTOMER" | "ADMIN", actorId: string) => {
    if (actorType === "WORKER") workerIds.add(actorId);
    else if (actorType === "CUSTOMER") customerIds.add(actorId);
    else adminIds.add(actorId);
  };
  for (const g of generators) {
    const last = g.scanEvents[0];
    if (last) collectActor(last.actorType, last.actorId);
    for (const issue of g.issueReports) {
      collectActor(issue.scanEvent.actorType, issue.scanEvent.actorId);
    }
  }
  const [workers, customers, admins] = await Promise.all([
    prisma.worker.findMany({ where: { id: { in: [...workerIds] } }, select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { id: { in: [...customerIds] } }, select: { id: true, name: true } }),
    prisma.adminUser.findMany({ where: { id: { in: [...adminIds] } }, select: { id: true, name: true } }),
  ]);
  const actorNameById = new Map([
    ...workers.map((worker) => [worker.id, worker.name] as const),
    ...customers.map((customer) => [customer.id, customer.name] as const),
    ...admins.map((admin) => [admin.id, admin.name] as const),
  ]);

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
      lastRefuelByName: lastEvent ? (actorNameById.get(lastEvent.actorId) ?? null) : null,
      problemReported: g.issueReports.length > 0,
      openIssues: g.issueReports.map((issue) => ({
        id: issue.id,
        note: issue.note,
        reportedByType: issue.scanEvent.actorType,
        reportedByName: actorNameById.get(issue.scanEvent.actorId) ?? null,
        reportedAt: issue.scanEvent.clientTimestamp.toISOString(),
        needsHelp: issue.needsHelp,
        workerNote: issue.workerNote,
      })),
    };
  });

  return NextResponse.json({ generators: result, fetchedAt: new Date().toISOString() });
}
