import { DFW_BOUNDS, DFW_MAP_SIZE } from "./dfw-map-paths";
import { EU_BOUNDS, EU_MAP_SIZE } from "./eu-map-paths";

/** Label + geographic window for a map close-up or inset. */
export type MapRegionSetting = {
  label: string;
  lng0: number;
  lng1: number;
  lat0: number;
  lat1: number;
};

export type MapRegionLimits = {
  maxLngSpan: number;
  maxLatSpan: number;
};

/** Close-up metro view (defaults to DFW). */
export type MetroMapSetting = MapRegionSetting;
/** Corner inset view (defaults to EU). */
export type InsetMapSetting = MapRegionSetting;

export const DEFAULT_METRO_MAP: MetroMapSetting = {
  label: "DFW",
  lng0: DFW_BOUNDS.lng0,
  lng1: DFW_BOUNDS.lng1,
  lat0: DFW_BOUNDS.lat0,
  lat1: DFW_BOUNDS.lat1,
};

export const DEFAULT_INSET_MAP: InsetMapSetting = {
  label: "EU",
  lng0: EU_BOUNDS.lng0,
  lng1: EU_BOUNDS.lng1,
  lat0: EU_BOUNDS.lat0,
  lat1: EU_BOUNDS.lat1,
};

const METRO_LIMITS: MapRegionLimits = { maxLngSpan: 8, maxLatSpan: 6 };
const INSET_LIMITS: MapRegionLimits = { maxLngSpan: 80, maxLatSpan: 55 };

function boundsMatch(
  a: Pick<MapRegionSetting, "lng0" | "lng1" | "lat0" | "lat1">,
  b: Pick<MapRegionSetting, "lng0" | "lng1" | "lat0" | "lat1">,
): boolean {
  return (
    a.lng0 === b.lng0 && a.lng1 === b.lng1 && a.lat0 === b.lat0 && a.lat1 === b.lat1
  );
}

export function normalizeMapRegionSetting(
  raw: Record<string, unknown> | null | undefined,
  defaults: MapRegionSetting,
  limits: MapRegionLimits,
): MapRegionSetting {
  if (!raw || typeof raw !== "object") return { ...defaults };

  const label =
    typeof raw.label === "string" && raw.label.trim()
      ? raw.label.trim().slice(0, 32)
      : defaults.label;

  const lng0 = Number(raw.lng0);
  const lng1 = Number(raw.lng1);
  const lat0 = Number(raw.lat0);
  const lat1 = Number(raw.lat1);

  if (
    ![lng0, lng1, lat0, lat1].every((n) => Number.isFinite(n)) ||
    lng0 >= lng1 ||
    lat0 >= lat1 ||
    lng0 < -180 ||
    lng1 > 180 ||
    lat0 < -90 ||
    lat1 > 90
  ) {
    return { ...defaults, label };
  }

  if (lng1 - lng0 > limits.maxLngSpan || lat1 - lat0 > limits.maxLatSpan) {
    return { ...defaults, label };
  }

  return { label, lng0, lng1, lat0, lat1 };
}

export function normalizeMetroMapSetting(
  raw: Record<string, unknown> | null | undefined,
): MetroMapSetting {
  return normalizeMapRegionSetting(raw, DEFAULT_METRO_MAP, METRO_LIMITS);
}

export function normalizeInsetMapSetting(
  raw: Record<string, unknown> | null | undefined,
): InsetMapSetting {
  return normalizeMapRegionSetting(raw, DEFAULT_INSET_MAP, INSET_LIMITS);
}

/** City outline SVG paths are DFW-only. */
export function metroUsesDfwCityOutlines(metro: MetroMapSetting): boolean {
  return boundsMatch(metro, DFW_BOUNDS);
}

/** Europe land silhouette paths are EU-default-only. */
export function insetUsesEuLandPaths(inset: InsetMapSetting): boolean {
  return boundsMatch(inset, EU_BOUNDS);
}

export function isInRegion(
  lng: number,
  lat: number,
  region: Pick<MapRegionSetting, "lng0" | "lng1" | "lat0" | "lat1">,
): boolean {
  return (
    lng >= region.lng0 &&
    lng <= region.lng1 &&
    lat >= region.lat0 &&
    lat <= region.lat1
  );
}

export function projectRegion(
  lng: number,
  lat: number,
  region: Pick<MapRegionSetting, "lng0" | "lng1" | "lat0" | "lat1">,
  size: { width: number; height: number },
): { x: number; y: number } | null {
  if (!isInRegion(lng, lat, region)) return null;
  const x = ((lng - region.lng0) / (region.lng1 - region.lng0)) * size.width;
  const y = ((region.lat1 - lat) / (region.lat1 - region.lat0)) * size.height;
  return { x, y };
}

export function isInMetro(
  lng: number,
  lat: number,
  metro: Pick<MetroMapSetting, "lng0" | "lng1" | "lat0" | "lat1">,
): boolean {
  return isInRegion(lng, lat, metro);
}

export function projectMetro(
  lng: number,
  lat: number,
  metro: Pick<MetroMapSetting, "lng0" | "lng1" | "lat0" | "lat1">,
  size: { width: number; height: number } = DFW_MAP_SIZE,
): { x: number; y: number } | null {
  return projectRegion(lng, lat, metro, size);
}

export function isInInset(
  lng: number,
  lat: number,
  inset: Pick<InsetMapSetting, "lng0" | "lng1" | "lat0" | "lat1">,
): boolean {
  return isInRegion(lng, lat, inset);
}

export function projectInset(
  lng: number,
  lat: number,
  inset: Pick<InsetMapSetting, "lng0" | "lng1" | "lat0" | "lat1">,
  size: { width: number; height: number } = EU_MAP_SIZE,
): { x: number; y: number } | null {
  return projectRegion(lng, lat, inset, size);
}
