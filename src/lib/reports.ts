import { prisma } from "@/lib/prisma";
import { deriveGeneratorStatus } from "@/lib/status";

export interface DateRange {
  from: Date;
  to: Date;
}

/** Generators currently RUNNING, NEEDS_FUEL_SOON, or OVERDUE (i.e. actively in the field today). */
export async function countGeneratorsInOperation(): Promise<number> {
  const generators = await prisma.generator.findMany({
    include: {
      generatorType: true,
      scanEvents: { where: { type: "REFUEL" }, select: { clientTimestamp: true, generatorRunning: true } },
    },
  });
  return generators.filter((g) => {
    const derived = deriveGeneratorStatus(g.generatorType.runtimeMinutes, g.scanEvents);
    return derived.status !== "IDLE";
  }).length;
}

/**
 * Approximates total operating minutes: for each refuel, count the time until the
 * next same-day refuel (or now/deadline for the most recent), capped at the
 * generator type's runtimeMinutes — time beyond that would have been overdue, not running.
 * A scan explicitly marked "shut off" contributes no runtime after itself — otherwise the
 * overnight gap between a shutdown scan and the next day's startup scan would be counted
 * as operating time.
 */
export async function getTotalRuntimeMinutes(range?: DateRange): Promise<number> {
  const generators = await prisma.generator.findMany({
    include: {
      generatorType: true,
      scanEvents: {
        where: {
          type: "REFUEL",
          ...(range ? { clientTimestamp: { gte: range.from, lte: range.to } } : {}),
        },
        select: { clientTimestamp: true, generatorRunning: true },
        orderBy: { clientTimestamp: "asc" },
      },
    },
  });

  const now = new Date();
  let totalMinutes = 0;

  for (const g of generators) {
    const runtime = g.generatorType.runtimeMinutes;
    const events = g.scanEvents;
    for (let i = 0; i < events.length; i++) {
      if (events[i].generatorRunning === false) continue;
      const current = events[i].clientTimestamp;
      const next = events[i + 1]?.clientTimestamp ?? now;
      const gapMinutes = (next.getTime() - current.getTime()) / 60_000;
      totalMinutes += Math.min(Math.max(gapMinutes, 0), runtime);
    }
  }

  return Math.round(totalMinutes);
}

interface GallonsOptions extends Partial<DateRange> {
  customerId?: string;
}

/** Sum of gallons used: actual worker-entered amount if provided, else the tank capacity (assumed topped off). */
export async function getTotalGallonsUsed(options: GallonsOptions = {}): Promise<number> {
  const events = await prisma.scanEvent.findMany({
    where: {
      type: "REFUEL",
      ...(options.from && options.to ? { clientTimestamp: { gte: options.from, lte: options.to } } : {}),
    },
    include: { generator: { include: { generatorType: true, assignments: true } } },
  });

  let total = 0;
  for (const e of events) {
    if (options.customerId) {
      const assignment = e.generator.assignments.find(
        (a) =>
          a.customerId === options.customerId &&
          a.assignedAt <= e.clientTimestamp &&
          (!a.unassignedAt || a.unassignedAt >= e.clientTimestamp)
      );
      if (!assignment) continue;
    }
    total += e.gallonsAdded ?? e.generator.generatorType.tankCapacityGallons;
  }
  return Math.round(total * 10) / 10;
}

export interface CustomerComplaintCount {
  customerId: string;
  customerName: string;
  count: number;
}

export async function getComplaintCountsByCustomer(range?: DateRange): Promise<CustomerComplaintCount[]> {
  const events = await prisma.scanEvent.findMany({
    where: {
      type: "ISSUE_REPORT",
      ...(range ? { clientTimestamp: { gte: range.from, lte: range.to } } : {}),
    },
    include: { generator: { include: { assignments: { include: { customer: true } } } } },
  });

  const counts = new Map<string, CustomerComplaintCount>();
  for (const e of events) {
    const assignment = e.generator.assignments.find(
      (a) => a.assignedAt <= e.clientTimestamp && (!a.unassignedAt || a.unassignedAt >= e.clientTimestamp)
    );
    if (!assignment) continue;
    const key = assignment.customerId;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { customerId: key, customerName: assignment.customer.name, count: 1 });
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}
