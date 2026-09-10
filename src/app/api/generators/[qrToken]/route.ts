import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveGeneratorStatus } from "@/lib/status";

// Looked up by the scan PWA on load (while online) to show the generator's name
// and cache its runtime info for offline status display.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ qrToken: string }> }
) {
  const { qrToken } = await params;

  const generator = await prisma.generator.findUnique({
    where: { qrToken },
    include: { generatorType: true },
  });

  if (!generator || !generator.active) {
    return NextResponse.json({ error: "Generator not found" }, { status: 404 });
  }

  const refuelEvents = await prisma.scanEvent.findMany({
    where: { generatorId: generator.id, type: "REFUEL" },
    select: { clientTimestamp: true },
  });

  const derivedStatus = deriveGeneratorStatus(generator.generatorType.runtimeMinutes, refuelEvents);

  return NextResponse.json({
    generator: {
      id: generator.id,
      label: generator.label,
      qrToken: generator.qrToken,
      generatorTypeName: generator.generatorType.name,
      runtimeMinutes: generator.generatorType.runtimeMinutes,
    },
    derivedStatus,
  });
}
