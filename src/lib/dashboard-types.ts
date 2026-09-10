export type DashboardStatus = "IDLE" | "RUNNING" | "NEEDS_FUEL_SOON" | "OVERDUE";

export interface DashboardGenerator {
  id: string;
  label: string;
  generatorTypeName: string;
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
  /** Name of the worker who performed the most recent refuel, or null. */
  lastRefuelByName: string | null;
  problemReported: boolean;
}

export interface DashboardResponse {
  generators: DashboardGenerator[];
  fetchedAt: string;
}
