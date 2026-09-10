import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPin, isValidPinFormat } from "@/lib/pin";
import { deriveGeneratorStatus, type DerivedGeneratorStatus } from "@/lib/status";
import type { ActorType, ScanType } from "@prisma/client";

export const scanEventSchema = z.object({
  qrToken: z.string().min(1),
  pin: z.string().refine(isValidPinFormat, "PIN must be 4-6 digits"),
  clientTimestamp: z.string().datetime(),
  deviceId: z.string().optional(),
  clientEventId: z.string().min(1),
  gallonsAdded: z.number().positive().optional(),
  note: z.string().max(1000).optional(),
});

export type ScanEventInput = z.infer<typeof scanEventSchema>;

export class ScanError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

interface ResolvedActor {
  actorType: ActorType;
  actorId: string;
}

async function resolveActorFromPin(pin: string): Promise<ResolvedActor> {
  const credential = await prisma.pinCredential.findUnique({
    where: { pinHash: hashPin(pin) },
  });
  if (!credential) {
    throw new ScanError("PIN not recognized", 401);
  }
  return { actorType: credential.ownerType, actorId: credential.ownerId };
}

async function assertCustomerAssignedToGenerator(customerId: string, generatorId: string) {
  const activeAssignment = await prisma.assignment.findFirst({
    where: { customerId, generatorId, unassignedAt: null },
  });
  if (!activeAssignment) {
    throw new ScanError("This PIN is not assigned to this generator", 403);
  }
}

export interface RecordScanResult {
  scanType: ScanType;
  derivedStatus: DerivedGeneratorStatus;
  wasDuplicate: boolean;
}

/**
 * Records a scan event and returns the generator's freshly-derived status.
 * Idempotent on `clientEventId` so retried/offline-queued syncs are safe to resubmit.
 */
export async function recordScanEvent(input: ScanEventInput): Promise<RecordScanResult> {
  const generator = await prisma.generator.findUnique({
    where: { qrToken: input.qrToken },
    include: { generatorType: true },
  });
  if (!generator || !generator.active) {
    throw new ScanError("Generator not found", 404);
  }

  const actor = await resolveActorFromPin(input.pin);
  const scanType: ScanType = actor.actorType === "WORKER" ? "REFUEL" : "ISSUE_REPORT";

  if (actor.actorType === "CUSTOMER") {
    await assertCustomerAssignedToGenerator(actor.actorId, generator.id);
  }

  const existing = await prisma.scanEvent.findUnique({
    where: { clientEventId: input.clientEventId },
  });

  let wasDuplicate = false;
  if (existing) {
    wasDuplicate = true;
  } else {
    try {
      await prisma.scanEvent.create({
        data: {
          generatorId: generator.id,
          type: scanType,
          actorType: actor.actorType,
          actorId: actor.actorId,
          clientTimestamp: new Date(input.clientTimestamp),
          deviceId: input.deviceId,
          clientEventId: input.clientEventId,
          gallonsAdded: input.gallonsAdded,
          note: input.note,
          issueReport:
            scanType === "ISSUE_REPORT"
              ? { create: { generatorId: generator.id, note: input.note } }
              : undefined,
        },
      });
    } catch (err) {
      // Unique constraint race (two near-simultaneous submits of the same clientEventId) —
      // treat as an already-recorded duplicate rather than surfacing a 500.
      const isUniqueViolation =
        typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
      if (!isUniqueViolation) {
        throw err;
      }
      wasDuplicate = true;
    }
  }

  const refuelEvents = await prisma.scanEvent.findMany({
    where: { generatorId: generator.id, type: "REFUEL" },
    select: { clientTimestamp: true },
  });

  const derivedStatus = deriveGeneratorStatus(generator.generatorType.runtimeMinutes, refuelEvents);

  return { scanType, derivedStatus, wasDuplicate };
}
