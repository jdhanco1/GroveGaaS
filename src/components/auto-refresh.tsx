"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the current server component tree on an interval so a server-rendered
// page stays current without a manual reload (no visible flash — Next swaps in place).
export default function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
