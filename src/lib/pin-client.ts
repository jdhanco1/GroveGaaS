/**
 * Browser-side counterpart to src/lib/pin.ts — must produce identical hex output
 * for the same PIN so offline verification matches server-side verification.
 * Uses the Web Crypto API (available in all modern mobile browsers, works offline).
 */
export async function hashPinClient(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(pin.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin.trim());
}
