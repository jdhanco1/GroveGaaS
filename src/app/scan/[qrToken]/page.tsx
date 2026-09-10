"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type Preview = { name: string; action: "Refuel" | "Report an issue" } | null;

export default function ScanPage() {
  const params = useParams<{ qrToken: string }>();
  const qrToken = params.qrToken;

  const [generator, setGenerator] = useState<CachedGenerator | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [preview, setPreview] = useState<Preview>(null);
  const [gallonsAdded, setGallonsAdded] = useState("");
  const [generatorRunning, setGeneratorRunning] = useState(true);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      await flushPendingScanEvents();
    } finally {
      flushingRef.current = false;
    }
  }, []);

  // Load generator info: try network first (and refresh caches), fall back to cache when offline.
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      flush();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

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
      window.removeEventListener("offline", onOffline);
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
      setPreview({
        name: entry.name,
        action: entry.ownerType === "WORKER" ? "Refuel" : "Report an issue",
      });
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
      gallonsAdded: gallonsAdded ? Number(gallonsAdded) : undefined,
      note: note || undefined,
      generatorRunning: preview?.action === "Refuel" ? generatorRunning : undefined,
      createdAt: new Date().toISOString(),
    });

    setPin("");
    setGallonsAdded("");
    setGeneratorRunning(true);
    setNote("");
    setPreview(null);

    if (navigator.onLine) {
      await flush();
      setResultMessage("Saved and synced.");
    } else {
      setResultMessage("Saved on this device — will sync automatically once you're back online.");
    }

    setSubmitting(false);
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
            <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Hi {preview.name} — this will be recorded as: <strong>{preview.action}</strong>
            </p>
          )}

          {preview?.action === "Refuel" && (
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

          {preview?.action === "Refuel" && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Generator status</label>
              <p className="mt-1 text-xs text-slate-500">
                Set to “Off” on your last scan of the day so overnight downtime isn’t counted as
                run time.
              </p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGeneratorRunning(true)}
                  className={`rounded border px-3 py-2 text-sm font-medium ${
                    generatorRunning
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-slate-300 text-slate-600"
                  }`}
                >
                  Running
                </button>
                <button
                  type="button"
                  onClick={() => setGeneratorRunning(false)}
                  className={`rounded border px-3 py-2 text-sm font-medium ${
                    !generatorRunning
                      ? "border-slate-600 bg-slate-100 text-slate-900"
                      : "border-slate-300 text-slate-600"
                  }`}
                >
                  Off
                </button>
              </div>
            </div>
          )}

          {preview?.action === "Report an issue" && (
            <div>
              <label htmlFor="note" className="block text-sm font-medium text-slate-700">
                Describe the issue
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
