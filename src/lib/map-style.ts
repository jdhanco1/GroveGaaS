import type { StyleSpecification } from "maplibre-gl";

// Free raster tile source, no API key required.
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

// Default map center when no coordinates have been picked yet (business's general operating area).
// MapLibre uses [lng, lat] order.
export const DEFAULT_MAP_CENTER: [number, number] = [-89.53507, 34.36534];
