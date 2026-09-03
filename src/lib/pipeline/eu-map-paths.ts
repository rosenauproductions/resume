/** Simplified Europe silhouette for the pipeline Target map inset. */

export const EU_MAP_VIEWBOX = "0 0 280 220";
export const EU_MAP_SIZE = { width: 280, height: 220 } as const;

/** Geographic bounds used by `projectEU` (lng/lat). */
export const EU_BOUNDS = {
  lng0: -12,
  lng1: 42,
  lat0: 34,
  lat1: 72,
} as const;

/**
 * Equirectangular projection into the EU inset viewBox.
 * Returns null outside the inset bounds.
 */
export function projectEU(lng: number, lat: number): { x: number; y: number } | null {
  const { lng0, lng1, lat0, lat1 } = EU_BOUNDS;
  if (lng < lng0 || lng > lng1 || lat < lat0 || lat > lat1) return null;
  const x = ((lng - lng0) / (lng1 - lng0)) * EU_MAP_SIZE.width;
  const y = ((lat1 - lat) / (lat1 - lat0)) * EU_MAP_SIZE.height;
  return { x, y };
}

/** Rough mainland + UK + Ireland outlines (equirectangular). */
export const EU_LAND_PATHS: { id: string; d: string }[] = [
  {
    id: "mainland",
    d: "M14,203.8 L19.7,201.5 L24.4,202.1 L29.6,205.5 L33.2,208.4 L38.9,204.4 L51.9,203.8 L57,200.9 L63.3,192.2 L66.4,179.5 L73.6,177.2 L78.8,173.7 L78.3,166.7 L87.1,165.6 L92.3,167.3 L96.4,166.2 L100.6,163.3 L107.9,159.8 L112.5,161.5 L115.6,169.1 L127,174.3 L136.4,180.6 L143.1,196.3 L149.9,191.6 L157.1,184.1 L158.1,170.8 L164.9,175.4 L165.9,187 L176.3,202.6 L186.7,198.6 L198.6,195.7 L202.2,192.8 L212.6,179.5 L208.4,173.7 L204.3,160.9 L211.6,154 L215.7,147.6 L208.4,138.9 L217.8,130.3 L228.1,118.7 L241.1,110 L220.4,92.6 L207.4,75.3 L194.4,66.6 L184.1,34.7 L171.1,11.6 L155.6,14.5 L140,23.2 L124.4,40.5 L116.7,49.2 L103.7,52.1 L90.7,57.9 L88.1,69.5 L93.3,81.1 L106.3,86.8 L114.1,98.4 L127,95.5 L137.4,98.4 L124.4,104.2 L114.1,101.3 L106.3,101.3 L103.7,107.1 L95.9,107.1 L87.1,108.8 L80.4,118.7 L75.2,121 L71.6,121.6 L63.3,130.3 L52.9,130.3 L38.9,136.1 L37.3,138.9 L51.9,144.7 L54.4,150.5 L56,159.2 L54.4,165.6 L51.9,166.2 L38.9,165.6 L25.9,163.8 L20.7,165 L15.6,169.1 L15.6,176.6 L16.6,184.1 L13,191.1 L14,199.7 L14,203.8 Z",
  },
  {
    id: "uk",
    d: "M33.7,127.4 L41.5,126.2 L49.3,124.5 L57,123.3 L64.8,121.6 L70,120.4 L69.5,115.8 L71,111.2 L64.8,107.1 L59.6,101.3 L54.4,98.4 L51.9,93.8 L46.7,92.6 L44.1,83.9 L41.5,78.2 L33.7,78.2 L36.3,86.8 L33.7,92.6 L31.1,95.5 L36.3,101.3 L38.9,107.1 L37.3,112.9 L35.3,116.9 L33.7,124.5 L33.7,127.4 Z",
  },
  {
    id: "ireland",
    d: "M10.4,118.7 L18.1,118.7 L23.3,115.8 L31.1,114.6 L31.1,107.1 L28.5,101.3 L23.3,97.3 L18.1,98.4 L13,103.1 L10.4,107.1 L9.3,112.9 L10.4,118.7 Z",
  },
];
