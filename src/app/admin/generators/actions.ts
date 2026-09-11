"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export type GeneratorActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

function revalidateGeneratorViews(...generatorIds: string[]) {
  revalidatePath("/admin/generators");
  revalidatePath("/admin/customers");
  revalidatePath("/dashboard");
  for (const generatorId of generatorIds) {
    revalidatePath(`/admin/generators/${generatorId}`);
    revalidatePath(`/dashboard/generators/${generatorId}`);
  }
}

function actionError(error: unknown): GeneratorActionState {
  if (error instanceof z.ZodError) {
    return { status: "error", message: error.issues[0]?.message ?? "Check the submitted values." };
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "P2002" || error.code === "P2034") {
      return { status: "error", message: "Generator availability changed. Refresh and try again." };
    }
  }
  return {
    status: "error",
    message: error instanceof Error ? error.message : "The operation could not be completed.",
  };
}

const operationSchema = z.object({
  generatorId: z.string().min(1),
  operation: z.enum(["REFUEL", "POWER_ON", "SHUTDOWN"]),
  gallonsAdded: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().positive("Gallons must be greater than zero.").optional()
  ),
  note: z.string().trim().max(500).optional(),
});

export async function recordAdminGeneratorOperation(
  _previousState: GeneratorActionState,
  formData: FormData
): Promise<GeneratorActionState> {
  try {
    const adminId = await requireAdmin();
    const parsed = operationSchema.parse(Object.fromEntries(formData));
    const generator = await prisma.generator.findUnique({
      where: { id: parsed.generatorId },
      select: { id: true, active: true },
    });
    if (!generator?.active) throw new Error("This generator is inactive or no longer exists.");

    await prisma.scanEvent.create({
      data: {
        generatorId: generator.id,
        type: "REFUEL",
        operation: parsed.operation,
        actorType: "ADMIN",
        actorId: adminId,
        clientTimestamp: new Date(),
        clientEventId: crypto.randomUUID(),
        gallonsAdded: parsed.operation === "REFUEL" ? parsed.gallonsAdded : null,
        note: parsed.note || null,
        generatorRunning: parsed.operation !== "SHUTDOWN",
      },
    });

    revalidateGeneratorViews(generator.id);
    const labels = { REFUEL: "Refuel recorded.", POWER_ON: "Generator marked running.", SHUTDOWN: "Generator shut down." };
    return { status: "success", message: labels[parsed.operation] };
  } catch (error) {
    return actionError(error);
  }
}

const swapSchema = z.object({
  originalGeneratorId: z.string().min(1),
  originalAssignmentId: z.string().min(1),
  replacementGeneratorId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export async function startTemporarySwap(
  _previousState: GeneratorActionState,
  formData: FormData
): Promise<GeneratorActionState> {
  try {
    const adminId = await requireAdmin();
    const parsed = swapSchema.parse(Object.fromEntries(formData));
    if (parsed.originalGeneratorId === parsed.replacementGeneratorId) {
      throw new Error("Choose a different replacement generator.");
    }

    await prisma.$transaction(
      async (tx) => {
        const originalAssignment = await tx.assignment.findUnique({ where: { id: parsed.originalAssignmentId } });
        if (
          !originalAssignment ||
          originalAssignment.generatorId !== parsed.originalGeneratorId ||
          originalAssignment.unassignedAt
        ) {
          throw new Error("The original generator assignment has changed. Refresh and try again.");
        }

        const [generators, replacementAssignment, activeSwap] = await Promise.all([
          tx.generator.findMany({
            where: { id: { in: [parsed.originalGeneratorId, parsed.replacementGeneratorId] } },
            select: { id: true, active: true },
          }),
          tx.assignment.findFirst({ where: { generatorId: parsed.replacementGeneratorId, unassignedAt: null } }),
          tx.generatorSwap.findFirst({
            where: {
              restoredAt: null,
              OR: [
                { originalGeneratorId: { in: [parsed.originalGeneratorId, parsed.replacementGeneratorId] } },
                { replacementGeneratorId: { in: [parsed.originalGeneratorId, parsed.replacementGeneratorId] } },
              ],
            },
          }),
        ]);
        if (generators.length !== 2 || generators.some((generator) => !generator.active)) {
          throw new Error("Both generators must be active.");
        }
        if (replacementAssignment || activeSwap) {
          throw new Error("That replacement is no longer available. Choose another generator.");
        }

        const swappedAt = new Date();
        const closed = await tx.assignment.updateMany({
          where: { id: originalAssignment.id, unassignedAt: null },
          data: { unassignedAt: swappedAt },
        });
        if (closed.count !== 1) throw new Error("The assignment changed before the swap completed.");

        const replacement = await tx.assignment.create({
          data: { generatorId: parsed.replacementGeneratorId, customerId: originalAssignment.customerId, assignedAt: swappedAt },
        });
        await tx.generatorSwap.create({
          data: {
            customerId: originalAssignment.customerId,
            originalGeneratorId: parsed.originalGeneratorId,
            replacementGeneratorId: parsed.replacementGeneratorId,
            originalAssignmentId: originalAssignment.id,
            replacementAssignmentId: replacement.id,
            startedById: adminId,
            reason: parsed.reason || null,
            startedAt: swappedAt,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );

    revalidateGeneratorViews(parsed.originalGeneratorId, parsed.replacementGeneratorId);
    return { status: "success", message: "Temporary replacement assigned." };
  } catch (error) {
    return actionError(error);
  }
}

const restoreSchema = z.object({ swapId: z.string().min(1) });

export async function restoreTemporarySwap(
  _previousState: GeneratorActionState,
  formData: FormData
): Promise<GeneratorActionState> {
  try {
    const adminId = await requireAdmin();
    const { swapId } = restoreSchema.parse(Object.fromEntries(formData));
    const generatorIds = await prisma.$transaction(
      async (tx) => {
        const swap = await tx.generatorSwap.findUnique({ where: { id: swapId } });
        if (!swap || swap.restoredAt) throw new Error("This temporary swap is no longer active.");

        const [original, originalAssignment, replacementAssignment] = await Promise.all([
          tx.generator.findUnique({ where: { id: swap.originalGeneratorId }, select: { active: true } }),
          tx.assignment.findFirst({ where: { generatorId: swap.originalGeneratorId, unassignedAt: null } }),
          tx.assignment.findUnique({ where: { id: swap.replacementAssignmentId } }),
        ]);
        if (!original?.active) throw new Error("The original generator is inactive and cannot be restored.");
        if (originalAssignment) throw new Error("The original generator is currently assigned elsewhere.");
        if (!replacementAssignment || replacementAssignment.unassignedAt) {
          throw new Error("The replacement assignment has changed and cannot be restored automatically.");
        }

        const restoredAt = new Date();
        const closed = await tx.assignment.updateMany({
          where: { id: replacementAssignment.id, unassignedAt: null },
          data: { unassignedAt: restoredAt },
        });
        if (closed.count !== 1) throw new Error("The replacement assignment changed before restore completed.");
        await tx.assignment.create({
          data: { generatorId: swap.originalGeneratorId, customerId: swap.customerId, assignedAt: restoredAt },
        });
        await tx.generatorSwap.update({
          where: { id: swap.id },
          data: { restoredAt, restoredById: adminId },
        });
        return [swap.originalGeneratorId, swap.replacementGeneratorId] as const;
      },
      { isolationLevel: "Serializable" }
    );

    revalidateGeneratorViews(...generatorIds);
    return { status: "success", message: "Original generator restored." };
  } catch (error) {
    return actionError(error);
  }
}

const generatorSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  generatorTypeId: z.string().min(1),
});

export async function saveGenerator(formData: FormData) {
  await requireAdmin();
  const parsed = generatorSchema.parse(Object.fromEntries(formData));

  if (parsed.id) {
    await prisma.generator.update({
      where: { id: parsed.id },
      data: {
        label: parsed.label,
        generatorTypeId: parsed.generatorTypeId,
      },
    });
    revalidatePath("/admin/generators");
    redirect(`/admin/generators/${parsed.id}`);
  }

  const generator = await prisma.generator.create({
    data: {
      label: parsed.label,
      generatorTypeId: parsed.generatorTypeId,
    },
  });
  revalidatePath("/admin/generators");
  redirect(`/admin/generators/${generator.id}`);
}

export async function deleteGenerator(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.generator.delete({ where: { id } });
  revalidatePath("/admin/generators");
  redirect("/admin/generators");
}

export async function assignGenerator(formData: FormData) {
  await requireAdmin();
  const generatorId = String(formData.get("generatorId"));
  const customerId = String(formData.get("customerId"));

  await prisma.$transaction(
    async (tx) => {
      const [generator, activeAssignment, activeSwap] = await Promise.all([
        tx.generator.findUnique({ where: { id: generatorId }, select: { active: true } }),
        tx.assignment.findFirst({ where: { generatorId, unassignedAt: null } }),
        tx.generatorSwap.findFirst({
          where: {
            restoredAt: null,
            OR: [{ originalGeneratorId: generatorId }, { replacementGeneratorId: generatorId }],
          },
        }),
      ]);
      if (!generator?.active) throw new Error("Only active generators can be assigned.");
      if (activeAssignment || activeSwap) throw new Error("This generator is not available for assignment.");
      await tx.assignment.create({ data: { generatorId, customerId } });
    },
    { isolationLevel: "Serializable" }
  );
  revalidatePath(`/admin/generators/${generatorId}`);
}

export async function unassignGenerator(formData: FormData) {
  await requireAdmin();
  const assignmentId = String(formData.get("assignmentId"));
  const generatorId = String(formData.get("generatorId"));

  const activeSwap = await prisma.generatorSwap.findFirst({
    where: { replacementAssignmentId: assignmentId, restoredAt: null },
  });
  if (activeSwap) throw new Error("Restore the original generator to end this temporary replacement.");
  await prisma.assignment.updateMany({
    where: { id: assignmentId, generatorId, unassignedAt: null },
    data: { unassignedAt: new Date() },
  });
  revalidatePath(`/admin/generators/${generatorId}`);
}

export async function attachMaintenanceTag(formData: FormData) {
  await requireAdmin();
  const generatorId = String(formData.get("generatorId"));
  const maintenanceTagId = String(formData.get("maintenanceTagId"));
  const dueAtRaw = formData.get("dueAt");
  const note = formData.get("note");

  await prisma.generatorMaintenanceTag.create({
    data: {
      generatorId,
      maintenanceTagId,
      dueAt: dueAtRaw ? new Date(String(dueAtRaw)) : null,
      note: note ? String(note) : null,
    },
  });
  revalidatePath(`/admin/generators/${generatorId}`);
}

export async function resolveMaintenanceTag(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const generatorId = String(formData.get("generatorId"));
  await prisma.generatorMaintenanceTag.update({
    where: { id },
    data: { resolvedAt: new Date() },
  });
  revalidatePath(`/admin/generators/${generatorId}`);
}
