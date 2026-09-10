import { NextResponse } from "next/server";
import { recordScanEvent, scanEventSchema, ScanError } from "@/lib/scan";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = scanEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await recordScanEvent(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ScanError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("scan-events error", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
