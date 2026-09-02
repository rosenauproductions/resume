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

/**
 * Canvas cluster for remote / empty / unplaced apps.
 * Placed in empty Albers USA space SW of the contiguous US (below Baja / Mexico gap),
 * clear of Texas and the AZ–NM border. ViewBox is 975×610 — keep the box fully inside.
 */
export const REMOTE_CLUSTER = {
  boxX: 48,
  boxY: 508,
  boxW: 220,
  boxH: 98,
  padX: 16,
  padY: 28,
  label: "Remote / No Location",
} as const;

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
  // DFW metro (apps + ntfy/visit cities)
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
  arlington: { lat: 32.7357, lng: -97.1081, label: "Arlington, TX" },
  addison: { lat: 32.9618, lng: -96.8292, label: "Addison, TX" },
  carrollton: { lat: 32.9537, lng: -96.8903, label: "Carrollton, TX" },
  lewisville: { lat: 33.0462, lng: -96.9942, label: "Lewisville, TX" },
  allen: { lat: 33.1032, lng: -96.6706, label: "Allen, TX" },
  prosper: { lat: 33.2362, lng: -96.8011, label: "Prosper, TX" },
  denton: { lat: 33.2148, lng: -97.1331, label: "Denton, TX" },
  grapevine: { lat: 32.9343, lng: -97.0781, label: "Grapevine, TX" },
  southlake: { lat: 32.9412, lng: -97.1342, label: "Southlake, TX" },
  rockwall: { lat: 32.9312, lng: -96.4597, label: "Rockwall, TX" },
  mesquite: { lat: 32.7668, lng: -96.5992, label: "Mesquite, TX" },
  forney: { lat: 32.7482, lng: -96.4719, label: "Forney, TX" },
  "the colony": { lat: 33.0807, lng: -96.8928, label: "The Colony, TX" },
  "farmers branch": { lat: 32.9265, lng: -96.8961, label: "Farmers Branch, TX" },
  "grand prairie": { lat: 32.7459, lng: -96.9978, label: "Grand Prairie, TX" },
  "flower mound": { lat: 33.0146, lng: -97.097, label: "Flower Mound, TX" },
  "fort worth": { lat: 32.7555, lng: -97.3308, label: "Fort Worth, TX" },
  "dallas-fort worth": { lat: 32.8998, lng: -97.0403, label: "DFW, TX" },
  dfw: { lat: 32.8998, lng: -97.0403, label: "DFW, TX" },

  // Texas
  texas: { lat: 31.0, lng: -99.9, label: "Texas" },
  houston: { lat: 29.7604, lng: -95.3698, label: "Houston, TX" },
  austin: { lat: 30.2672, lng: -97.7431, label: "Austin, TX" },
  "san antonio": { lat: 29.4241, lng: -98.4936, label: "San Antonio, TX" },
  "round rock": { lat: 30.5083, lng: -97.6789, label: "Round Rock, TX" },
  "college station": { lat: 30.628, lng: -96.3344, label: "College Station, TX" },
  lubbock: { lat: 33.5779, lng: -101.8552, label: "Lubbock, TX" },
  midland: { lat: 31.9973, lng: -102.0779, label: "Midland, TX" },

  // California
  livermore: { lat: 37.6819, lng: -121.768, label: "Livermore, CA" },
  atherton: { lat: 37.4613, lng: -122.1977, label: "Atherton, CA" },
  "san francisco": { lat: 37.7749, lng: -122.4194, label: "San Francisco, CA" },
  "san jose": { lat: 37.3382, lng: -121.8863, label: "San Jose, CA" },
  "los angeles": { lat: 34.0522, lng: -118.2437, label: "Los Angeles, CA" },
  oakland: { lat: 37.8044, lng: -122.2712, label: "Oakland, CA" },
  sacramento: { lat: 38.5816, lng: -121.4944, label: "Sacramento, CA" },
  "palo alto": { lat: 37.4419, lng: -122.143, label: "Palo Alto, CA" },
  "mountain view": { lat: 37.3861, lng: -122.0839, label: "Mountain View, CA" },
  sunnyvale: { lat: 37.3688, lng: -122.0363, label: "Sunnyvale, CA" },
  "santa clara": { lat: 37.3541, lng: -121.9552, label: "Santa Clara, CA" },
  "redwood city": { lat: 37.4852, lng: -122.2364, label: "Redwood City, CA" },

  // Other common US (apps + visit geo)
  "new york": { lat: 40.7128, lng: -74.006, label: "New York, NY" },
  nyc: { lat: 40.7128, lng: -74.006, label: "New York, NY" },
  brooklyn: { lat: 40.6782, lng: -73.9442, label: "Brooklyn, NY" },
  chicago: { lat: 41.8781, lng: -87.6298, label: "Chicago, IL" },
  seattle: { lat: 47.6062, lng: -122.3321, label: "Seattle, WA" },
  bellevue: { lat: 47.6101, lng: -122.2015, label: "Bellevue, WA" },
  redmond: { lat: 47.674, lng: -122.1215, label: "Redmond, WA" },
  denver: { lat: 39.7392, lng: -104.9903, label: "Denver, CO" },
  boulder: { lat: 40.015, lng: -105.2705, label: "Boulder, CO" },
  atlanta: { lat: 33.749, lng: -84.388, label: "Atlanta, GA" },
  boston: { lat: 42.3601, lng: -71.0589, label: "Boston, MA" },
  cambridge: { lat: 42.3736, lng: -71.1097, label: "Cambridge, MA" },
  phoenix: { lat: 33.4484, lng: -112.074, label: "Phoenix, AZ" },
  scottsdale: { lat: 33.4942, lng: -111.9261, label: "Scottsdale, AZ" },
  miami: { lat: 25.7617, lng: -80.1918, label: "Miami, FL" },
  orlando: { lat: 28.5383, lng: -81.3792, label: "Orlando, FL" },
  tampa: { lat: 27.9506, lng: -82.4572, label: "Tampa, FL" },
  nashville: { lat: 36.1627, lng: -86.7816, label: "Nashville, TN" },
  charlotte: { lat: 35.2271, lng: -80.8431, label: "Charlotte, NC" },
  raleigh: { lat: 35.7796, lng: -78.6382, label: "Raleigh, NC" },
  minneapolis: { lat: 44.9778, lng: -93.265, label: "Minneapolis, MN" },
  philadelphia: { lat: 39.9526, lng: -75.1652, label: "Philadelphia, PA" },
  pittsburgh: { lat: 40.4406, lng: -79.9959, label: "Pittsburgh, PA" },
  baltimore: { lat: 39.2904, lng: -76.6122, label: "Baltimore, MD" },
  "salt lake city": { lat: 40.7608, lng: -111.891, label: "Salt Lake City, UT" },
  "las vegas": { lat: 36.1699, lng: -115.1398, label: "Las Vegas, NV" },
  portland: { lat: 45.5152, lng: -122.6784, label: "Portland, OR" },
  "kansas city": { lat: 39.0997, lng: -94.5786, label: "Kansas City, MO" },
  "st louis": { lat: 38.627, lng: -90.1994, label: "St. Louis, MO" },
  "oklahoma city": { lat: 35.4676, lng: -97.5164, label: "Oklahoma City, OK" },
  tulsa: { lat: 36.154, lng: -95.9928, label: "Tulsa, OK" },
  columbus: { lat: 39.9612, lng: -82.9988, label: "Columbus, OH" },
  indianapolis: { lat: 39.7684, lng: -86.1581, label: "Indianapolis, IN" },
  detroit: { lat: 42.3314, lng: -83.0458, label: "Detroit, MI" },
  "new orleans": { lat: 29.9511, lng: -90.0715, label: "New Orleans, LA" },
  richmond: { lat: 37.5407, lng: -77.436, label: "Richmond, VA" },
  alexandria: { lat: 38.8048, lng: -77.0469, label: "Alexandria, VA" },
  "arlington va": { lat: 38.8816, lng: -77.091, label: "Arlington, VA" },
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
  dallas: ["hallmark", "associa"],
  austin: ["ryder"],
  "dallas-fort worth": ["american airlines", "chewy"],
  dfw: ["american airlines", "chewy"],
  "fort worth": ["american airlines"],
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
  if (REMOTE_HINT.test(n)) {
    // Pure remote — omit from geo layer unless a known city (or hybrid/onsite) appears
    if (!/\b(hybrid|onsite|in[- ]office)\b/.test(n) && !CITY_COORDS[n]) {
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

/**
 * Pack remote / unplaced targets into REMOTE_CLUSTER as a scattered grid
 * so dots don't fully overlap.
 */
export function packRemoteClusterPoint(
  index: number,
  total: number,
  seed: string,
): { x: number; y: number } {
  const { boxX, boxY, boxW, boxH, padX, padY } = REMOTE_CLUSTER;
  const innerW = Math.max(24, boxW - padX * 2);
  const innerH = Math.max(24, boxH - padY - 14);
  const count = Math.max(1, total);
  const aspect = innerW / innerH;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * aspect)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cellW = innerW / cols;
  const cellH = innerH / rows;
  const jitter = jitterOffset(seed || String(index), index);
  const jScale = Math.min(0.35, 0.55 / Math.max(cols, rows));
  return {
    x: boxX + padX + cellW * (col + 0.5) + jitter.dx * jScale,
    y: boxY + padY + cellH * (row + 0.5) + jitter.dy * jScale,
  };
}

export function companyMatchesAliases(company: string, cityKey: string): boolean {
  const aliases = CITY_COMPANY_ALIASES[cityKey] ?? [];
  if (!aliases.length) return false;
  const hay = company.toLowerCase();
  return aliases.some((a) => hay.includes(a));
}
