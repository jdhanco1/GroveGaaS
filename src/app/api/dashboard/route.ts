import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveGeneratorStatus } from "@/lib/status";

export async function GET() {
  const generators = await prisma.generator.findMany({
    where: { active: true },
    include: {
      generatorType: true,
      scanEvents: { where: { type: "REFUEL" }, select: { clientTimestamp: true } },
      assignments: { where: { unassignedAt: null }, include: { customer: true } },
      issueReports: { where: { status: "OPEN" } },
    },
  });

  const result = generators.map((g) => {
    const derived = deriveGeneratorStatus(g.generatorType.runtimeMinutes, g.scanEvents);
    return {
      id: g.id,
      label: g.label,
      generatorTypeName: g.generatorType.name,
      latitude: g.latitude,
      longitude: g.longitude,
      customerName: g.assignments[0]?.customer.name ?? null,
      status: derived.status,
      minutesRemaining: derived.minutesRemaining,
      refuelCountToday: derived.refuelCountToday,
      problemReported: g.issueReports.length > 0,
    };
  });

  return NextResponse.json({ generators: result, fetchedAt: new Date().toISOString() });
}
