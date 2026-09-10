export type DashboardStatus = "IDLE" | "RUNNING" | "NEEDS_FUEL_SOON" | "OVERDUE";

export interface DashboardGenerator {
  id: string;
  label: string;
  generatorTypeName: string;
  latitude: number | null;
  longitude: number | null;
  customerName: string | null;
  status: DashboardStatus;
  minutesRemaining: number | null;
  refuelCountToday: number;
  problemReported: boolean;
}

export interface DashboardResponse {
  generators: DashboardGenerator[];
  fetchedAt: string;
}
