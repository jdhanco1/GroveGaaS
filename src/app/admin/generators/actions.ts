"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
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

  await prisma.assignment.create({ data: { generatorId, customerId } });
  revalidatePath(`/admin/generators/${generatorId}`);
}

export async function unassignGenerator(formData: FormData) {
  await requireAdmin();
  const assignmentId = String(formData.get("assignmentId"));
  const generatorId = String(formData.get("generatorId"));

  await prisma.assignment.update({
    where: { id: assignmentId },
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
