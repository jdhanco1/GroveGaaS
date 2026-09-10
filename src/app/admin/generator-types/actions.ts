"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  tankCapacityGallons: z.coerce.number().positive(),
  runtimeMinutes: z.coerce.number().int().positive(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function saveGeneratorType(formData: FormData) {
  await requireAdmin();
  const parsed = schema.parse(Object.fromEntries(formData));

  if (parsed.id) {
    await prisma.generatorType.update({
      where: { id: parsed.id },
      data: {
        name: parsed.name,
        tankCapacityGallons: parsed.tankCapacityGallons,
        runtimeMinutes: parsed.runtimeMinutes,
      },
    });
  } else {
    await prisma.generatorType.create({
      data: {
        name: parsed.name,
        tankCapacityGallons: parsed.tankCapacityGallons,
        runtimeMinutes: parsed.runtimeMinutes,
      },
    });
  }

  revalidatePath("/admin/generator-types");
}

export async function deleteGeneratorType(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.generatorType.delete({ where: { id } });
  revalidatePath("/admin/generator-types");
}
