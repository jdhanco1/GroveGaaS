import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Synced by the scan PWA while online and cached in IndexedDB so PIN entry can be
// verified entirely offline. Server-side validation still re-runs on actual sync
// (see /api/scan-events) — this is only for immediate offline UX, not authority.
export async function GET() {
  const [workers, customers, assignments] = await Promise.all([
    prisma.worker.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.assignment.findMany({
      where: { unassignedAt: null },
      select: { customerId: true, generator: { select: { qrToken: true } } },
    }),
  ]);

  const pins = await prisma.pinCredential.findMany({
    select: { pinHash: true, ownerType: true, ownerId: true },
  });

  const workerNames = new Map(workers.map((w) => [w.id, w.name]));
  const customerNames = new Map(customers.map((c) => [c.id, c.name]));
  const customerGenerators = new Map<string, string[]>();
  for (const a of assignments) {
    const list = customerGenerators.get(a.customerId) ?? [];
    list.push(a.generator.qrToken);
    customerGenerators.set(a.customerId, list);
  }

  const entries = pins
    .map((p) => {
      if (p.ownerType === "WORKER") {
        const name = workerNames.get(p.ownerId);
        if (!name) return null;
        return { pinHash: p.pinHash, ownerType: p.ownerType, ownerId: p.ownerId, name, assignedGeneratorQrTokens: [] as string[] };
      }
      const name = customerNames.get(p.ownerId);
      if (!name) return null;
      return {
        pinHash: p.pinHash,
        ownerType: p.ownerType,
        ownerId: p.ownerId,
        name,
        assignedGeneratorQrTokens: customerGenerators.get(p.ownerId) ?? [],
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  return NextResponse.json({ syncedAt: new Date().toISOString(), entries });
}
