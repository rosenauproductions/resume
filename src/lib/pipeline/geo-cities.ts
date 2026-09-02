/**
 * Static city → lat/lng lookup for pipeline target map.
 * No paid geocoding — curated for DFW / US cities in the tracker.
 */

export type GeoPoint = { lat: number; lng: number; label: string };

/** SVG viewBox size matching Albers USA paths (`us-map-paths.ts`). */
export const MAP_SIZE = { width: 975, height: 610 };

/** Neutral US geographic center — used only if remote is explicitly pinned. */
export const US_CENTER: GeoPoint = {
  lat: 39.8283,
  lng: -98.5795,
  label: "Remote (US)",
};

/** Resume / candidate hub (Wylie–DFW area). */
export const RESUME_HUB: GeoPoint = {
  lat: 32.9762,
  lng: -96.5956,
  label: "Resume · DFW",
};

/**
 * Curated lookup. Keys are lowercase city names (and a few aliases).
 * Remote / nationwide listings intentionally omitted from the geo layer.
 */
const CITY_COORDS: Record<string, GeoPoint> = {
  // DFW metro
  dallas: { lat: 32.7767, lng: -96.797, label: "Dallas, TX" },
  plano: { lat: 33.0198, lng: -96.6989, label: "Plano, TX" },
  mckinney: { lat: 33.1972, lng: -96.6397, label: "McKinney, TX" },
  coppell: { lat: 32.9546, lng: -97.015, label: "Coppell, TX" },
  bedford: { lat: 32.8442, lng: -97.1431, label: "Bedford, TX" },
  wylie: { lat: 33.0151, lng: -96.5389, label: "Wylie, TX" },
  sachse: { lat: 32.9762, lng: -96.5956, label: "Sachse, TX" },
  garland: { lat: 32.9126, lng: -96.6389, label: "Garland, TX" },
  rowlett: { lat: 32.9028, lng: -96.5639, label: "Rowlett, TX" },
  murphy: { lat: 33.0151, lng: -96.6131, label: "Murphy, TX" },
  irving: { lat: 32.814, lng: -96.9489, label: "Irving, TX" },
  frisco: { lat: 33.1507, lng: -96.8236, label: "Frisco, TX" },
  richardson: { lat: 32.9483, lng: -96.7299, label: "Richardson, TX" },
  "fort worth": { lat: 32.7555, lng: -97.3308, label: "Fort Worth, TX" },
  "dallas-fort worth": { lat: 32.8998, lng: -97.0403, label: "DFW, TX" },
  dfw: { lat: 32.8998, lng: -97.0403, label: "DFW, TX" },

  // Texas
  houston: { lat: 29.7604, lng: -95.3698, label: "Houston, TX" },
  austin: { lat: 30.2672, lng: -97.7431, label: "Austin, TX" },
  "san antonio": { lat: 29.4241, lng: -98.4936, label: "San Antonio, TX" },

  // California
  livermore: { lat: 37.6819, lng: -121.768, label: "Livermore, CA" },
  atherton: { lat: 37.4613, lng: -122.1977, label: "Atherton, CA" },
  "san francisco": { lat: 37.7749, lng: -122.4194, label: "San Francisco, CA" },
  "san jose": { lat: 37.3382, lng: -121.8863, label: "San Jose, CA" },
  "los angeles": { lat: 34.0522, lng: -118.2437, label: "Los Angeles, CA" },

  // Other common US
  "new york": { lat: 40.7128, lng: -74.006, label: "New York, NY" },
  chicago: { lat: 41.8781, lng: -87.6298, label: "Chicago, IL" },
  seattle: { lat: 47.6062, lng: -122.3321, label: "Seattle, WA" },
  denver: { lat: 39.7392, lng: -104.9903, label: "Denver, CO" },
  atlanta: { lat: 33.749, lng: -84.388, label: "Atlanta, GA" },
  boston: { lat: 42.3601, lng: -71.0589, label: "Boston, MA" },
  phoenix: { lat: 33.4484, lng: -112.074, label: "Phoenix, AZ" },
  miami: { lat: 25.7617, lng: -80.1918, label: "Miami, FL" },
  washington: { lat: 38.9072, lng: -77.0369, label: "Washington, DC" },
  "washington dc": { lat: 38.9072, lng: -77.0369, label: "Washington, DC" },
};

/**
 * Same city→company aliases as `src/lib/db/visits.ts` (client-safe copy).
 * Used to attribute unlinked visits as suggested hits on targets.
 */
export const CITY_COMPANY_ALIASES: Record<string, string[]> = {
  plano: ["capital title", "jpmorgan", "jp morgan", "equinix"],
  mckinney: ["srs", "srs distribution"],
  coppell: ["aaa", "american automobile"],
  livermore: ["lawrence livermore", "llnl"],
  atherton: ["sacred heart"],
  bedford: ["propricer"],
  houston: ["baylor"],
  "dallas-fort worth": ["american airlines"],
  dfw: ["american airlines"],
};

const REMOTE_HINT =
  /\b(remote|us-remote|nationwide|united states|usa only|fully remote)\b/i;

export function normalizeCityKey(raw: string): string {
  try {
    return decodeURIComponent(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\+/g, " ")
      .replace(/[.,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return (raw || "").trim().toLowerCase();
  }
}

/** Pull a known city key from free-text location / visit city. */
export function extractCityKey(text: string): string | null {
  const n = normalizeCityKey(text);
  if (!n || n === "unknown") return null;
  if (REMOTE_HINT.test(n) && !/\b(dallas|houston|austin|plano|livermore)\b/.test(n)) {
    // Pure remote — omit from geo layer
    if (!/\b(hybrid|onsite|in[- ]office)\b/.test(n) && !CITY_COORDS[n]) {
      // Still try to find a city name inside hybrid strings below
      const hasKnown = Object.keys(CITY_COORDS).some((k) => n.includes(k));
      if (!hasKnown) return null;
    }
  }

  // Exact key
  if (CITY_COORDS[n]) return n;

  // Prefer longer city names first (e.g. "san antonio" before "san")
  const keys = Object.keys(CITY_COORDS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (n === key || n.includes(key)) return key;
  }
  return null;
}

export function lookupCity(text: string): GeoPoint | null {
  const key = extractCityKey(text);
  if (!key) return null;
  return CITY_COORDS[key] ?? null;
}

export function isRemoteLocation(text: string): boolean {
  const n = normalizeCityKey(text);
  if (!n) return false;
  if (!REMOTE_HINT.test(n)) return false;
  // Hybrid with a city still counts as geo-placeable
  return !extractCityKey(text);
}

/**
 * Project lon/lat into SVG coords matching us-atlas `*-albers-10m` topologies:
 * `d3.geoAlbersUsa().scale(1300).translate([487.5, 305])` (lower-48 branch).
 * Uses d3.geoAlbers defaults: rotate [96,0], center [-0.6, 38.7], parallels [29.5, 45.5].
 */
export function projectUS(lng: number, lat: number): { x: number; y: number } | null {
  // Contiguous US only — AK/HI omitted from this map layer
  if (lng < -130 || lng > -66 || lat < 24 || lat > 50) return null;

  const parallels = [29.5, 45.5] as const;
  const rotate = 96;
  const center = [-0.6, 38.7] as const;
  const scale = 1300;
  const translate = [487.5, 305] as const;

  const φ0 = (parallels[0] * Math.PI) / 180;
  const φ1 = (parallels[1] * Math.PI) / 180;
  const n = (Math.sin(φ0) + Math.sin(φ1)) / 2;
  const C = Math.cos(φ0) ** 2 + 2 * n * Math.sin(φ0);
  const ρ0 = Math.sqrt(C) / n;

  const projectRaw = (λDeg: number, φDeg: number): [number, number] => {
    const λ = (λDeg * Math.PI) / 180;
    const φ = (φDeg * Math.PI) / 180;
    const ρ = Math.sqrt(C - 2 * n * Math.sin(φ)) / n;
    return [ρ * Math.sin(n * λ), ρ0 - ρ * Math.cos(n * λ)];
  };

  const [x0, y0] = projectRaw(center[0], center[1]);
  const [x1, y1] = projectRaw(lng + rotate, lat);
  return {
    x: translate[0] + scale * (x1 - x0),
    y: translate[1] - scale * (y1 - y0),
  };
}

/** Stable small offset so co-located targets don't fully stack. */
export function jitterOffset(seed: string, index: number): { dx: number; dy: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const angle = ((Math.abs(h) % 360) + index * 47) * (Math.PI / 180);
  const r = 10 + (Math.abs(h) % 8);
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
}

export function companyMatchesAliases(company: string, cityKey: string): boolean {
  const aliases = CITY_COMPANY_ALIASES[cityKey] ?? [];
  if (!aliases.length) return false;
  const hay = company.toLowerCase();
  return aliases.some((a) => hay.includes(a));
}
