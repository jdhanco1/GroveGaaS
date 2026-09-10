import { createHash } from "node:crypto";

/**
 * PIN hashing strategy
 * --------------------
 * PINs are short, low-entropy codes (4-6 digits) meant only to stop a random
 * passerby from changing generator status — not to withstand a targeted
 * attacker with database access. A brute force of the full keyspace is trivial
 * regardless of hash algorithm, so a slow/salted hash (bcrypt) buys nothing here
 * but *does* prevent the deterministic lookup this system needs:
 *
 *   1. A single PIN must resolve to exactly one worker/customer (global
 *      uniqueness, enforced via a DB unique constraint on the hash).
 *   2. The scan PWA must be able to verify a PIN entirely offline, against a
 *      small cached table synced while online — with no server secret shipped
 *      to the client.
 *
 * A keyless SHA-256 digest satisfies both: deterministic (enables #1 and #2)
 * and requires no secret distribution. Given the threat model above, this is
 * an intentional, documented tradeoff — not an oversight.
 */
export function hashPin(pin: string): string {
  return createHash("sha256").update(pin.trim()).digest("hex");
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin.trim());
}
