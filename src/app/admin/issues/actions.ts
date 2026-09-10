"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function resolveIssue(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = String(formData.get("id"));
  await prisma.issueReport.update({
    where: { id },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: session.user.id },
  });
  revalidatePath("/admin/issues");
}
