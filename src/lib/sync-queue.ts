import { getPendingEvents, removePendingEvent, markPendingEventError, type QueuedScanEvent } from "@/lib/offline-db";

export interface FlushResult {
  succeeded: string[];
  failed: { clientEventId: string; error: string }[];
}

/** Attempts to POST every queued scan event to the server; leaves failures queued for the next attempt. */
export async function flushPendingScanEvents(): Promise<FlushResult> {
  const pending = await getPendingEvents();
  const succeeded: string[] = [];
  const failed: { clientEventId: string; error: string }[] = [];

  for (const event of pending) {
    const result = await submitOne(event);
    if (result.ok) {
      await removePendingEvent(event.clientEventId);
      succeeded.push(event.clientEventId);
    } else {
      failed.push({ clientEventId: event.clientEventId, error: result.error });
    }
  }

  return { succeeded, failed };
}

async function submitOne(event: QueuedScanEvent): Promise<{ ok: boolean; error: string }> {
  let response: Response;
  try {
    response = await fetch("/api/scan-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qrToken: event.qrToken,
        pin: event.pin,
        clientTimestamp: event.clientTimestamp,
        deviceId: event.deviceId,
        clientEventId: event.clientEventId,
        eventType: event.eventType,
        gallonsAdded: event.gallonsAdded,
        note: event.note,
      }),
    });
  } catch (err) {
    // Network error (not a server rejection) — keep it queued for the next attempt.
    const message = err instanceof Error ? err.message : "Network error";
    await markPendingEventError(event.clientEventId, message);
    return { ok: false, error: message };
  }

  if (response.ok) {
    return { ok: true, error: "" };
  }

  const body = await response.json().catch(() => null);
  const message =
    typeof body?.error === "string" ? body.error : `Could not submit (status ${response.status})`;

  // 4xx errors (bad PIN, wrong generator) are not transient — drop them rather than retry forever.
  if (response.status >= 400 && response.status < 500) {
    await markPendingEventError(event.clientEventId, message);
    await removePendingEvent(event.clientEventId);
  } else {
    await markPendingEventError(event.clientEventId, message);
  }

  return { ok: false, error: message };
}
