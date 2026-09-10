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
export const DEFAULT_MAP_CENTER: [number, number] = [-75.1652, 39.9526];
