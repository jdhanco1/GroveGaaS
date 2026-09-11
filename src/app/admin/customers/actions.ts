"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hashPin, isValidPinFormat } from "@/lib/pin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  pin: z.string().optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function saveCustomer(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = Object.fromEntries(formData);
  const parsed = schema.parse(raw);

  const customer = parsed.id
    ? await prisma.customer.update({
        where: { id: parsed.id },
        data: {
          name: parsed.name,
          email: parsed.email || null,
          phone: parsed.phone || null,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
        },
      })
    : await prisma.customer.create({
        data: {
          name: parsed.name,
          email: parsed.email || null,
          phone: parsed.phone || null,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
        },
      });

  if (parsed.pin) {
    if (!isValidPinFormat(parsed.pin)) {
      redirect(`/admin/customers?edit=${customer.id}&error=${encodeURIComponent("PIN must be 4-6 digits")}`);
    }
    const pinHash = hashPin(parsed.pin);
    const existing = await prisma.pinCredential.findUnique({ where: { pinHash } });
    if (existing && existing.ownerId !== customer.id) {
      redirect(
        `/admin/customers?edit=${customer.id}&error=${encodeURIComponent(
          "That PIN is already in use by another customer or worker — choose a different one."
        )}`
      );
    }
    await prisma.pinCredential.deleteMany({ where: { ownerType: "CUSTOMER", ownerId: customer.id } });
    await prisma.pinCredential.create({
      data: { pinHash, ownerType: "CUSTOMER", ownerId: customer.id },
    });
  }

  revalidatePath("/admin/customers");
  redirect("/admin/customers");
}

export async function deleteCustomer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.pinCredential.deleteMany({ where: { ownerType: "CUSTOMER", ownerId: id } });
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/admin/customers");
}

export async function assignGeneratorToCustomer(formData: FormData) {
  await requireAdmin();
  const customerId = String(formData.get("customerId"));
  const generatorId = String(formData.get("generatorId"));

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
  revalidatePath("/admin/customers");
  redirect(`/admin/customers?edit=${customerId}`);
}

export async function unassignGeneratorFromCustomer(formData: FormData) {
  await requireAdmin();
  const assignmentId = String(formData.get("assignmentId"));
  const customerId = String(formData.get("customerId"));

  const activeSwap = await prisma.generatorSwap.findFirst({
    where: { replacementAssignmentId: assignmentId, restoredAt: null },
  });
  if (activeSwap) throw new Error("Restore the original generator to end this temporary replacement.");
  await prisma.assignment.updateMany({
    where: { id: assignmentId, customerId, unassignedAt: null },
    data: { unassignedAt: new Date() },
  });
  revalidatePath("/admin/customers");
  redirect(`/admin/customers?edit=${customerId}`);
}
