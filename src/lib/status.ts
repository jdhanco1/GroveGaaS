/**
 * Pure, read-time derivation of a generator's display status from its raw
 * scan-event history. Nothing here is stored or mutated by a background job —
 * that's deliberate, so status is always consistent even if offline scans
 * sync late or arrive out of order (see plan discussion / repo notes).
 */

export type FuelStatus = "IDLE" | "RUNNING" | "NEEDS_FUEL_SOON" | "OVERDUE";

export interface RefuelEventInput {
  /** When the scan actually happened on the device (not when the server received it). */
  clientTimestamp: Date;
}

export interface DerivedGeneratorStatus {
  status: FuelStatus;
  /** Most recent refuel event's clientTimestamp, or null if none today. */
  lastRefuelAt: Date | null;
  /** Deadline by which the generator needs its next refuel (lastRefuelAt + runtimeMinutes). */
  deadline: Date | null;
  /** Minutes remaining until the deadline (negative once overdue). */
  minutesRemaining: number | null;
  /** Number of refuel scans recorded so far today. */
  refuelCountToday: number;
  /** When the generator first went overdue, if currently overdue. */
  overdueSince: Date | null;
}

const NEEDS_FUEL_SOON_THRESHOLD_MINUTES = 30;
const AUTO_IDLE_AFTER_OVERDUE_MINUTES = 120;

/**
 * @param runtimeMinutes Expected run time on a full tank, from the generator's type.
 * @param refuelEvents All REFUEL scan events for this generator (any order, any date).
 * @param now Evaluation time (injectable for tests; defaults to current time).
 * @param dayBoundaryTimeZone IANA time zone used to determine "today" (business calendar day).
 */
export function deriveGeneratorStatus(
  runtimeMinutes: number,
  refuelEvents: RefuelEventInput[],
  now: Date = new Date(),
  dayBoundaryTimeZone = "UTC"
): DerivedGeneratorStatus {
  const todaysEvents = refuelEvents
    .filter((e) => isSameBusinessDay(e.clientTimestamp, now, dayBoundaryTimeZone))
    .sort((a, b) => a.clientTimestamp.getTime() - b.clientTimestamp.getTime());

  if (todaysEvents.length === 0) {
    return {
      status: "IDLE",
      lastRefuelAt: null,
      deadline: null,
      minutesRemaining: null,
      refuelCountToday: 0,
      overdueSince: null,
    };
  }

  const lastRefuelAt = todaysEvents[todaysEvents.length - 1].clientTimestamp;
  const deadline = new Date(lastRefuelAt.getTime() + runtimeMinutes * 60_000);
  const minutesRemaining = (deadline.getTime() - now.getTime()) / 60_000;
  const refuelCountToday = todaysEvents.length;

  if (minutesRemaining > NEEDS_FUEL_SOON_THRESHOLD_MINUTES) {
    return {
      status: "RUNNING",
      lastRefuelAt,
      deadline,
      minutesRemaining,
      refuelCountToday,
      overdueSince: null,
    };
  }

  if (minutesRemaining > 0) {
    return {
      status: "NEEDS_FUEL_SOON",
      lastRefuelAt,
      deadline,
      minutesRemaining,
      refuelCountToday,
      overdueSince: null,
    };
  }

  // Past the deadline: overdue, unless it's been overdue long enough to auto-revert to idle.
  const overdueMinutes = -minutesRemaining;
  if (overdueMinutes >= AUTO_IDLE_AFTER_OVERDUE_MINUTES) {
    return {
      status: "IDLE",
      lastRefuelAt,
      deadline,
      minutesRemaining,
      refuelCountToday,
      overdueSince: null,
    };
  }

  return {
    status: "OVERDUE",
    lastRefuelAt,
    deadline,
    minutesRemaining,
    refuelCountToday,
    overdueSince: deadline,
  };
}

function isSameBusinessDay(a: Date, b: Date, timeZone: string): boolean {
  const format = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  return format(a) === format(b);
}
