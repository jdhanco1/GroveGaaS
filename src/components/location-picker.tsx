"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { OSM_STYLE, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/map-style";

interface LocationPickerProps {
  latitudeName: string;
  longitudeName: string;
  defaultLatitude?: number | null;
  defaultLongitude?: number | null;
}

// Click (or drag the marker) to set the lat/lng hidden fields submitted with the parent form.
export default function LocationPicker({
  latitudeName,
  longitudeName,
  defaultLatitude,
  defaultLongitude,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    defaultLatitude != null && defaultLongitude != null
      ? { lat: defaultLatitude, lng: defaultLongitude }
      : null
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = position ? [position.lng, position.lat] : DEFAULT_MAP_CENTER;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE,
      center,
      zoom: DEFAULT_MAP_ZOOM,
    });
    mapRef.current = map;

    function placeMarker(lat: number, lng: number) {
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        markerRef.current = new Marker({ draggable: true })
          .setLngLat([lng, lat])
          .addTo(map);
        markerRef.current.on("dragend", () => {
          const lngLat = markerRef.current!.getLngLat();
          setPosition({ lat: lngLat.lat, lng: lngLat.lng });
        });
      }
    }

    if (position) placeMarker(position.lat, position.lng);

    map.on("click", (e) => {
      setPosition({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      placeMarker(e.lngLat.lat, e.lngLat.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">Location</label>
      <p className="mt-1 text-xs text-slate-500">
        Click the map to drop a pin, or drag the pin to adjust.{" "}
        {position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : "No location set"}
      </p>
      <div ref={containerRef} className="mt-1 h-64 w-full rounded border border-slate-300" />
      <input type="hidden" name={latitudeName} value={position?.lat ?? ""} readOnly />
      <input type="hidden" name={longitudeName} value={position?.lng ?? ""} readOnly />
    </div>
  );
}
