"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  category: z.enum(["OIL_CHANGE", "REPAIR", "INSPECTION", "OTHER"]),
  description: z.string().optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function saveMaintenanceTag(formData: FormData) {
  await requireAdmin();
  const parsed = schema.parse(Object.fromEntries(formData));

  if (parsed.id) {
    await prisma.maintenanceTag.update({
      where: { id: parsed.id },
      data: { name: parsed.name, category: parsed.category, description: parsed.description },
    });
  } else {
    await prisma.maintenanceTag.create({
      data: { name: parsed.name, category: parsed.category, description: parsed.description },
    });
  }

  revalidatePath("/admin/maintenance-tags");
}

export async function deleteMaintenanceTag(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.maintenanceTag.delete({ where: { id } });
  revalidatePath("/admin/maintenance-tags");
}
