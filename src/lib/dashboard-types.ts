export type DashboardStatus = "IDLE" | "RUNNING" | "NEEDS_FUEL_SOON" | "OVERDUE";

export interface DashboardIssue {
  id: string;
  note: string | null;
  /** Who reported it, or null if unknown. */
  reportedByName: string | null;
  reportedByType: "WORKER" | "CUSTOMER" | "ADMIN";
  /** ISO timestamp of when the issue was reported. */
  reportedAt: string;
  /** A worker looked at it in the field but couldn't fix it. */
  needsHelp: boolean;
  workerNote: string | null;
}

export interface DashboardGenerator {
  id: string;
  label: string;
  generatorTypeName: string;
  /** Expected run time on a full tank, used to render the fuel progress bar. */
  runtimeMinutes: number;
  latitude: number | null;
  longitude: number | null;
  customerName: string | null;
  status: DashboardStatus;
  /** ISO timestamp of the deadline (last refuel + runtime), or null if IDLE/no deadline. */
  deadline: string | null;
  minutesRemaining: number | null;
  refuelCountToday: number;
  /** ISO timestamp of the most recent refuel ever recorded (any day), or null. */
  lastRefuelAt: string | null;
  /** Name of the worker or admin who performed the most recent operation, or null. */
  lastRefuelByName: string | null;
  problemReported: boolean;
  openIssues: DashboardIssue[];
}

export interface DashboardResponse {
  generators: DashboardGenerator[];
  fetchedAt: string;
}
