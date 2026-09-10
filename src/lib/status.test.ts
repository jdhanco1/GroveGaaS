import { describe, expect, it } from "vitest";
import { deriveGeneratorStatus } from "./status";

const RUNTIME_MINUTES = 120; // 2 hours per full tank, for readable test math

describe("deriveGeneratorStatus", () => {
  it("is IDLE with no refuel events", () => {
    const result = deriveGeneratorStatus(RUNTIME_MINUTES, []);
    expect(result.status).toBe("IDLE");
    expect(result.refuelCountToday).toBe(0);
  });

  it("goes RUNNING on the first scan of the day", () => {
    const now = new Date("2026-09-10T12:00:00Z");
    const result = deriveGeneratorStatus(
      RUNTIME_MINUTES,
      [{ clientTimestamp: new Date("2026-09-10T11:00:00Z") }],
      now
    );
    expect(result.status).toBe("RUNNING");
    expect(result.refuelCountToday).toBe(1);
  });

  it("resets the deadline and increments the counter on each same-day scan", () => {
    const now = new Date("2026-09-10T13:00:00Z");
    const result = deriveGeneratorStatus(
      RUNTIME_MINUTES,
      [
        { clientTimestamp: new Date("2026-09-10T09:00:00Z") },
        { clientTimestamp: new Date("2026-09-10T11:00:00Z") },
        { clientTimestamp: new Date("2026-09-10T12:30:00Z") },
      ],
      now
    );
    expect(result.refuelCountToday).toBe(3);
    // Deadline is based on the LATEST scan (12:30), not the first (09:00).
    expect(result.deadline?.toISOString()).toBe("2026-09-10T14:30:00.000Z");
    expect(result.status).toBe("RUNNING");
  });

  it("resets to IDLE at a new calendar day even if the previous deadline hasn't passed", () => {
    const now = new Date("2026-09-11T00:05:00Z");
    const result = deriveGeneratorStatus(
      RUNTIME_MINUTES,
      [{ clientTimestamp: new Date("2026-09-10T23:50:00Z") }],
      now,
      "UTC"
    );
    expect(result.status).toBe("IDLE");
    expect(result.refuelCountToday).toBe(0);
  });

  it("is NEEDS_FUEL_SOON when 30 minutes or less remain", () => {
    const now = new Date("2026-09-10T11:00:00Z");
    const result = deriveGeneratorStatus(
      RUNTIME_MINUTES,
      [{ clientTimestamp: new Date("2026-09-10T09:30:00Z") }], // deadline 11:30
      now
    );
    expect(result.status).toBe("NEEDS_FUEL_SOON");
    expect(result.minutesRemaining).toBe(30);
  });

  it("stays RUNNING with more than 30 minutes remaining", () => {
    const now = new Date("2026-09-10T10:45:00Z");
    const result = deriveGeneratorStatus(
      RUNTIME_MINUTES,
      [{ clientTimestamp: new Date("2026-09-10T09:30:00Z") }], // deadline 11:30, 45 min left at 10:45
      now
    );
    expect(result.minutesRemaining).toBe(45);
    expect(result.status).toBe("RUNNING");
  });

  it("is OVERDUE once the deadline has passed", () => {
    const now = new Date("2026-09-10T12:00:00Z");
    const result = deriveGeneratorStatus(
      RUNTIME_MINUTES,
      [{ clientTimestamp: new Date("2026-09-10T09:00:00Z") }], // deadline 11:00
      now
    );
    expect(result.status).toBe("OVERDUE");
    expect(result.overdueSince?.toISOString()).toBe("2026-09-10T11:00:00.000Z");
  });

  it("auto-reverts to IDLE after 2 hours overdue with no new refuel", () => {
    const now = new Date("2026-09-10T13:01:00Z"); // deadline 11:00, 121 min overdue
    const result = deriveGeneratorStatus(
      RUNTIME_MINUTES,
      [{ clientTimestamp: new Date("2026-09-10T09:00:00Z") }],
      now
    );
    expect(result.status).toBe("IDLE");
  });

  it("is idempotent when the same event is duplicated (de-duped upstream, but robust regardless)", () => {
    const now = new Date("2026-09-10T10:00:00Z");
    const ts = new Date("2026-09-10T09:00:00Z");
    const result = deriveGeneratorStatus(
      RUNTIME_MINUTES,
      [{ clientTimestamp: ts }, { clientTimestamp: ts }],
      now
    );
    // Duplicate timestamps still just count as 2 events here — real de-dup happens
    // at ingestion via clientEventId uniqueness, this only tests derivation math.
    expect(result.refuelCountToday).toBe(2);
    expect(result.lastRefuelAt?.toISOString()).toBe(ts.toISOString());
  });

  it("reconciles correctly when events arrive out of order", () => {
    const now = new Date("2026-09-10T13:00:00Z");
    const early = { clientTimestamp: new Date("2026-09-10T12:00:00Z") };
    const late = { clientTimestamp: new Date("2026-09-10T09:00:00Z") };
    // Passed in "wrong" order (late-arriving sync could append in any order).
    const result = deriveGeneratorStatus(RUNTIME_MINUTES, [early, late], now);
    // Deadline must be based on the chronologically-latest clientTimestamp (12:00), not array order.
    expect(result.deadline?.toISOString()).toBe("2026-09-10T14:00:00.000Z");
    expect(result.status).toBe("RUNNING");
  });
});
