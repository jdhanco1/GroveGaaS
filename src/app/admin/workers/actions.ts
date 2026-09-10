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
  pin: z.string().optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function saveWorker(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = schema.parse(Object.fromEntries(formData));

  const worker = parsed.id
    ? await prisma.worker.update({ where: { id: parsed.id }, data: { name: parsed.name } })
    : await prisma.worker.create({ data: { name: parsed.name } });

  if (parsed.pin) {
    if (!isValidPinFormat(parsed.pin)) {
      redirect(`/admin/workers?edit=${worker.id}&error=${encodeURIComponent("PIN must be 4-6 digits")}`);
    }
    const pinHash = hashPin(parsed.pin);
    const existing = await prisma.pinCredential.findUnique({ where: { pinHash } });
    if (existing && existing.ownerId !== worker.id) {
      redirect(
        `/admin/workers?edit=${worker.id}&error=${encodeURIComponent(
          "That PIN is already in use by another worker or customer — choose a different one."
        )}`
      );
    }
    await prisma.pinCredential.deleteMany({ where: { ownerType: "WORKER", ownerId: worker.id } });
    await prisma.pinCredential.create({ data: { pinHash, ownerType: "WORKER", ownerId: worker.id } });
  }

  revalidatePath("/admin/workers");
  redirect("/admin/workers");
}

export async function deleteWorker(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.pinCredential.deleteMany({ where: { ownerType: "WORKER", ownerId: id } });
  await prisma.worker.delete({ where: { id } });
  revalidatePath("/admin/workers");
}
