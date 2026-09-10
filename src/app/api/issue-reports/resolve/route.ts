import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveIssueViaPin, ScanError } from "@/lib/scan";

const bodySchema = z.object({
  pin: z.string().min(4).max(6),
  issueReportId: z.string().min(1),
  resolution: z.enum(["RESOLVED", "NEEDS_HELP"]),
  note: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await resolveIssueViaPin(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ScanError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("issue-reports/resolve error", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
