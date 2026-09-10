"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Map as MapLibreMap, Marker, NavigationControl, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DashboardResponse, DashboardStatus } from "@/lib/dashboard-types";
import { OSM_STYLE, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/map-style";

const POLL_INTERVAL_MS = 20_000;

const STATUS_COLORS: Record<DashboardStatus, string> = {
  IDLE: "#94a3b8",
  RUNNING: "#16a34a",
  NEEDS_FUEL_SOON: "#d97706",
  OVERDUE: "#dc2626",
};

export default function MapDashboardPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [data, setData] = useState<DashboardResponse | null>(null);

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
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const g of data.generators) {
      if (g.latitude == null || g.longitude == null) continue;
      const el = document.createElement("div");
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.2)";
      el.style.background = STATUS_COLORS[g.status];
      if (g.problemReported) {
        el.style.outline = "3px solid #7c3aed";
      }

      const popupHtml = `<strong>${g.label}</strong><br/>${g.status.replace(/_/g, " ")}${
        g.customerName ? `<br/>${g.customerName}` : ""
      }`;

      const marker = new Marker({ element: el })
        .setLngLat([g.longitude, g.latitude])
        .setPopup(new Popup({ offset: 12 }).setHTML(popupHtml))
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [data]);

  return (
    <div className="relative h-screen w-screen">
      <div className="absolute left-4 top-4 z-10 rounded-lg bg-white p-3 shadow">
        <Link href="/dashboard" className="text-sm text-slate-600 hover:underline">
          ← List view
        </Link>
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
