"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { hashPinClient, isValidPinFormat } from "@/lib/pin-client";
import {
  cacheGenerator,
  enqueueScanEvent,
  findCachedPin,
  getCachedGenerator,
  replacePinCache,
  type CachedGenerator,
} from "@/lib/offline-db";
import { flushPendingScanEvents } from "@/lib/sync-queue";

function getDeviceId(): string {
  const key = "gft-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

type EventType = "REFUEL" | "POWER_ON" | "SHUTDOWN" | "ISSUE_REPORT";

const WORKER_EVENT_OPTIONS: { value: EventType; label: string }[] = [
  { value: "REFUEL", label: "Refuel" },
  { value: "POWER_ON", label: "Power On" },
  { value: "SHUTDOWN", label: "Shutdown" },
  { value: "ISSUE_REPORT", label: "Report a problem" },
];

function subscribeToOnlineStatus(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineStatus() {
  return navigator.onLine;
}

type Preview = { name: string; ownerType: "WORKER" | "CUSTOMER" } | null;

export default function ScanPage() {
  const params = useParams<{ qrToken: string }>();
  const qrToken = params.qrToken;

  const [generator, setGenerator] = useState<CachedGenerator | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [preview, setPreview] = useState<Preview>(null);
  const [eventType, setEventType] = useState<EventType>("REFUEL");
  const [gallonsAdded, setGallonsAdded] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const isOnline = useSyncExternalStore(subscribeToOnlineStatus, getOnlineStatus, () => false);
  const [issueActionSubmitting, setIssueActionSubmitting] = useState(false);
  const [issueActionMessage, setIssueActionMessage] = useState<string | null>(null);
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (flushingRef.current) return { succeeded: [], failed: [] };
    flushingRef.current = true;
    try {
      return await flushPendingScanEvents();
    } finally {
      flushingRef.current = false;
    }
  }, []);

  // Load generator info: try network first (and refresh caches), fall back to cache when offline.
  useEffect(() => {
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);

    (async () => {
      try {
        const res = await fetch(`/api/generators/${qrToken}`);
        if (res.ok) {
          const data = await res.json();
          const cached: CachedGenerator = {
            qrToken: data.generator.qrToken,
            label: data.generator.label,
            generatorTypeName: data.generator.generatorTypeName,
            runtimeMinutes: data.generator.runtimeMinutes,
            cachedAt: new Date().toISOString(),
            openIssue: data.generator.openIssue ?? null,
          };
          await cacheGenerator(cached);
          setGenerator(cached);
        } else {
          throw new Error("network lookup failed");
        }
      } catch {
        const cached = await getCachedGenerator(qrToken);
        if (cached) {
          setGenerator(cached);
        } else {
          setLoadError("This generator isn't cached on this device yet. Connect to the internet once to enable offline scanning.");
        }
      }

      try {
        const res = await fetch("/api/pin-sync");
        if (res.ok) {
          const data = await res.json();
          await replacePinCache(data.entries);
        }
      } catch {
        // Fine — we'll use whatever PIN cache is already on the device.
      }

      flush();
    })();

    const interval = setInterval(flush, 15_000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [qrToken, flush]);

  // Live preview of who this PIN belongs to and what action it will trigger, computed
  // entirely from the local cache so it works offline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isValidPinFormat(pin)) {
        if (!cancelled) setPreview(null);
        return;
      }
      const hash = await hashPinClient(pin);
      const entry = await findCachedPin(hash);
      if (cancelled) return;
      if (!entry) {
        setPreview(null);
        return;
      }
      setPreview({ name: entry.name, ownerType: entry.ownerType });
      setEventType(entry.ownerType === "WORKER" ? "REFUEL" : "ISSUE_REPORT");
    })();
    return () => {
      cancelled = true;
    };
  }, [pin]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPinFormat(pin)) return;

    setSubmitting(true);
    setResultMessage(null);

    const clientEventId = crypto.randomUUID();
    await enqueueScanEvent({
      clientEventId,
      qrToken,
      pin,
      clientTimestamp: new Date().toISOString(),
      deviceId: getDeviceId(),
      eventType,
      gallonsAdded: gallonsAdded ? Number(gallonsAdded) : undefined,
      note: note || undefined,
      createdAt: new Date().toISOString(),
    });

    setPin("");
    setGallonsAdded("");
    setNote("");
    setEventType("REFUEL");
    setPreview(null);

    if (navigator.onLine) {
      const result = await flush();
      if (result.succeeded.includes(clientEventId)) {
        setResultMessage("Saved and synced.");
      } else {
        const failure = result.failed.find((f) => f.clientEventId === clientEventId);
        setResultMessage(
          failure
            ? `Not saved: ${failure.error}`
            : "Saved on this device — will sync automatically once you're back online."
        );
      }
    } else {
      setResultMessage("Saved on this device — will sync automatically once you're back online.");
    }

    setSubmitting(false);
  }

  async function handleIssueAction(resolution: "RESOLVED" | "NEEDS_HELP") {
    if (!isValidPinFormat(pin) || preview?.ownerType !== "WORKER" || !generator?.openIssue) return;
    if (!navigator.onLine) {
      setIssueActionMessage("Connect to the internet to update this issue.");
      return;
    }

    setIssueActionSubmitting(true);
    setIssueActionMessage(null);
    try {
      const res = await fetch("/api/issue-reports/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, issueReportId: generator.openIssue.id, resolution }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setIssueActionMessage(json?.error ?? "Could not update this issue.");
      } else {
        setIssueActionMessage(
          resolution === "RESOLVED" ? "Marked resolved. Thanks!" : "Flagged for admin help — left open."
        );
        setGenerator((g) =>
          g
            ? {
                ...g,
                openIssue: resolution === "RESOLVED" ? null : { ...g.openIssue!, needsHelp: true },
              }
            : g
        );
      }
    } catch {
      setIssueActionMessage("Network error — try again once you're back online.");
    } finally {
      setIssueActionSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-center">
        <p className="text-slate-700">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">{generator?.label ?? "Loading..."}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isOnline ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
        {generator && <p className="text-sm text-slate-500">{generator.generatorTypeName}</p>}

        {generator?.openIssue && (
          <div
            className={`rounded border p-3 text-sm ${
              generator.openIssue.needsHelp
                ? "border-purple-300 bg-purple-50 text-purple-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
          >
            <p className="font-medium">
              {generator.openIssue.needsHelp ? "Reported problem (needs help)" : "Reported problem"}
            </p>
            <p className="mt-1">{generator.openIssue.note || "No description provided."}</p>
            {preview?.ownerType === "WORKER" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={issueActionSubmitting}
                  onClick={() => handleIssueAction("RESOLVED")}
                  className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Mark resolved
                </button>
                <button
                  type="button"
                  disabled={issueActionSubmitting}
                  onClick={() => handleIssueAction("NEEDS_HELP")}
                  className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Can&apos;t fix — need help
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs opacity-75">Enter a worker PIN below to resolve or escalate this.</p>
            )}
            {issueActionMessage && <p className="mt-2 text-xs font-medium">{issueActionMessage}</p>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-slate-700">
              Enter your PIN
            </label>
            <input
              id="pin"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-3 text-center text-2xl tracking-widest"
              placeholder="•••••"
            />
          </div>

          {preview && (
            <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">Hi {preview.name}</p>
          )}

          {preview?.ownerType === "WORKER" && (
            <div>
              <label className="block text-sm font-medium text-slate-700">What are you doing?</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {WORKER_EVENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEventType(opt.value)}
                    className={`rounded border px-3 py-2 text-sm font-medium ${
                      eventType === opt.value
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 text-slate-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(eventType === "REFUEL" || eventType === "POWER_ON") && preview?.ownerType === "WORKER" && (
            <div>
              <label htmlFor="gallons" className="block text-sm font-medium text-slate-700">
                Gallons added (optional)
              </label>
              <input
                id="gallons"
                type="number"
                step="0.1"
                min="0"
                value={gallonsAdded}
                onChange={(e) => setGallonsAdded(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {eventType === "ISSUE_REPORT" && (
            <div>
              <label htmlFor="note" className="block text-sm font-medium text-slate-700">
                Describe the problem
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                rows={3}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!isValidPinFormat(pin) || submitting}
            className="w-full rounded bg-slate-900 px-3 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Submit"}
          </button>
        </form>

        {resultMessage && (
          <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">{resultMessage}</p>
        )}
      </div>
    </div>
  );
}
