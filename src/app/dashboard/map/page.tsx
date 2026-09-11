"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DashboardResponse } from "@/lib/dashboard-types";
import { OSM_STYLE, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/map-style";
import GroveBrand from "@/components/grove-brand";

const POLL_INTERVAL_MS = 5_000;
const URGENT_THRESHOLD_MINUTES = 10;

const COLOR_IDLE = "#475569";
const COLOR_RUNNING = "#17603d";
const COLOR_NEEDS_ATTENTION = "#f4b740";
const COLOR_URGENT = "#a4262c";

/** Green when running, amber approaching the refuel deadline, gray idle, red under 10 min left. */
function markerAppearance(status: DashboardResponse["generators"][number]["status"], minutesRemaining: number | null) {
  if (status === "IDLE") return COLOR_IDLE;
  if (minutesRemaining !== null && minutesRemaining < URGENT_THRESHOLD_MINUTES) {
    return COLOR_URGENT;
  }
  if (status === "NEEDS_FUEL_SOON") return COLOR_NEEDS_ATTENTION;
  return COLOR_RUNNING;
}

export default function MapDashboardPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
    });
    mapRef.current.addControl(new NavigationControl());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // Keep last known markers on a failed poll.
      }
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const g of data.generators) {
      if (g.latitude == null || g.longitude == null) continue;
      const color = markerAppearance(g.status, g.minutesRemaining);

      const el = document.createElement("div");
      el.title = `${g.label} — ${g.status.replace(/_/g, " ")}${g.customerName ? ` (${g.customerName})` : ""}`;
      el.style.width = "30px";
      el.style.height = "30px";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.2)";
      el.style.background = color;
      el.style.cursor = "pointer";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontSize = "14px";
      el.textContent = "⚡";
      if (g.problemReported) {
        el.style.outline = `3px solid ${COLOR_URGENT}`;
      }
      el.addEventListener("click", () => router.push(`/dashboard/generators/${g.id}`));

      const marker = new Marker({ element: el }).setLngLat([g.longitude, g.latitude]).addTo(map);
      markersRef.current.push(marker);
    }
  }, [data, router]);

  return (
    <div className="relative h-screen w-screen">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow">
        <GroveBrand href="/dashboard" priority />
        <span className="h-6 w-px bg-slate-200" />
        <Link href="/dashboard" className="text-sm text-slate-600 hover:underline">
          List view
        </Link>
      </div>
      <div className="absolute bottom-4 left-4 z-10 space-y-1 rounded-lg bg-white p-3 text-xs text-slate-600 shadow">
        <p className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_RUNNING }} /> Running
        </p>
        <p className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_NEEDS_ATTENTION }} /> Needs
          attention
        </p>
        <p className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_IDLE }} /> Idle
        </p>
        <p className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_URGENT }} />{" "}
          &lt; 10 min of run time left
        </p>
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
