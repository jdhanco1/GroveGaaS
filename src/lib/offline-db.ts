import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface CachedPinEntry {
  pinHash: string;
  ownerType: "WORKER" | "CUSTOMER";
  ownerId: string;
  name: string;
  assignedGeneratorQrTokens: string[];
}

export interface CachedGenerator {
  qrToken: string;
  label: string;
  generatorTypeName: string;
  runtimeMinutes: number;
  cachedAt: string;
  openIssue?: { id: string; note: string | null; needsHelp: boolean } | null;
}

export interface QueuedScanEvent {
  clientEventId: string;
  qrToken: string;
  pin: string;
  clientTimestamp: string;
  deviceId: string;
  eventType?: "REFUEL" | "POWER_ON" | "SHUTDOWN" | "ISSUE_REPORT";
  gallonsAdded?: number;
  note?: string;
  createdAt: string;
  lastError?: string;
}

interface ScanDB extends DBSchema {
  pins: { key: string; value: CachedPinEntry };
  generators: { key: string; value: CachedGenerator };
  pendingEvents: { key: string; value: QueuedScanEvent };
}

const DB_NAME = "gft-scan-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ScanDB>> | null = null;

function getDb(): Promise<IDBPDatabase<ScanDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ScanDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("pins", { keyPath: "pinHash" });
        db.createObjectStore("generators", { keyPath: "qrToken" });
        db.createObjectStore("pendingEvents", { keyPath: "clientEventId" });
      },
    });
  }
  return dbPromise;
}

export async function replacePinCache(entries: CachedPinEntry[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("pins", "readwrite");
  await tx.store.clear();
  await Promise.all(entries.map((e) => tx.store.put(e)));
  await tx.done;
}

export async function findCachedPin(pinHash: string): Promise<CachedPinEntry | undefined> {
  const db = await getDb();
  return db.get("pins", pinHash);
}

export async function cacheGenerator(generator: CachedGenerator): Promise<void> {
  const db = await getDb();
  await db.put("generators", generator);
}

export async function getCachedGenerator(qrToken: string): Promise<CachedGenerator | undefined> {
  const db = await getDb();
  return db.get("generators", qrToken);
}

export async function enqueueScanEvent(event: QueuedScanEvent): Promise<void> {
  const db = await getDb();
  await db.put("pendingEvents", event);
}

export async function getPendingEvents(): Promise<QueuedScanEvent[]> {
  const db = await getDb();
  return db.getAll("pendingEvents");
}

export async function removePendingEvent(clientEventId: string): Promise<void> {
  const db = await getDb();
  await db.delete("pendingEvents", clientEventId);
}

export async function markPendingEventError(clientEventId: string, error: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get("pendingEvents", clientEventId);
  if (existing) {
    await db.put("pendingEvents", { ...existing, lastError: error });
  }
}
