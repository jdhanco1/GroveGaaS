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
