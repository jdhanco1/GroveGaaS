import { getPendingEvents, removePendingEvent, markPendingEventError, type QueuedScanEvent } from "@/lib/offline-db";

export interface FlushResult {
  succeeded: string[];
  failed: string[];
}

/** Attempts to POST every queued scan event to the server; leaves failures queued for the next attempt. */
export async function flushPendingScanEvents(): Promise<FlushResult> {
  const pending = await getPendingEvents();
  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const event of pending) {
    try {
      const ok = await submitOne(event);
      if (ok) {
        await removePendingEvent(event.clientEventId);
        succeeded.push(event.clientEventId);
      } else {
        failed.push(event.clientEventId);
      }
    } catch (err) {
      await markPendingEventError(event.clientEventId, err instanceof Error ? err.message : "Unknown error");
      failed.push(event.clientEventId);
    }
  }

  return { succeeded, failed };
}

async function submitOne(event: QueuedScanEvent): Promise<boolean> {
  const response = await fetch("/api/scan-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      qrToken: event.qrToken,
      pin: event.pin,
      clientTimestamp: event.clientTimestamp,
      deviceId: event.deviceId,
      clientEventId: event.clientEventId,
      gallonsAdded: event.gallonsAdded,
      note: event.note,
      generatorRunning: event.generatorRunning,
    }),
  });

  // 4xx errors (bad PIN, wrong generator) are not transient — drop them rather than retry forever.
  if (response.status >= 400 && response.status < 500) {
    await markPendingEventError(event.clientEventId, `Rejected: ${response.status}`);
    await removePendingEvent(event.clientEventId);
    return false;
  }

  return response.ok;
}
