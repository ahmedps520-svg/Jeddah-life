"use client";

import type * as MapLibre from "maplibre-gl";

let loaded: Promise<typeof MapLibre> | null = null;

/** Lazily loads MapLibre and points it at the worker served from /vendor. */
export function getMaplibre(): Promise<typeof MapLibre> {
  if (!loaded) {
    loaded = import("maplibre-gl").then((m) => {
      m.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      return m;
    });
  }
  return loaded;
}
