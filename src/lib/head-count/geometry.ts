export type HeadBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
};

export type PosePoint = {
  x: number;
  y: number;
  visibility?: number;
};

export function iou(a: HeadBox, b: HeadBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

export function nms(boxes: HeadBox[], thresh = 0.45): HeadBox[] {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const keep: HeadBox[] = [];
  for (const box of sorted) {
    if (keep.every((kept) => iou(kept, box) < thresh)) keep.push(box);
  }
  return keep;
}

export type PostureMode = "seated" | "standing";

function clampBox(box: HeadBox, frameW: number, frameH: number): HeadBox {
  const x = Math.max(0, Math.min(box.x, frameW - 2));
  const y = Math.max(0, Math.min(box.y, frameH - 2));
  const w = Math.max(4, Math.min(box.w, frameW - x));
  const h = Math.max(4, Math.min(box.h, frameH - y));
  return { ...box, x, y, w, h };
}

/**
 * Map a person silhouette to a head/hair/hat region.
 * Seated mode assumes short/wide body boxes (chair view from behind);
 * standing mode assumes taller full-body crops.
 */
export function headFromPerson(
  x: number,
  y: number,
  w: number,
  h: number,
  score: number,
  frameW: number,
  frameH: number,
  posture: PostureMode = "seated",
): HeadBox {
  const aspect = w / Math.max(h, 1);
  let headRatio: number;
  if (posture === "seated") {
    // From the back of a room, seated people are mostly head + shoulders.
    headRatio = aspect > 1.05 ? 0.62 : aspect > 0.75 ? 0.5 : 0.4;
  } else {
    const cropped = aspect > 0.75 || h < frameH * 0.5;
    headRatio = cropped ? 0.34 : 0.26;
  }
  let headH = Math.min(h * headRatio, w * (posture === "seated" ? 1.35 : 1.15));
  let headW = Math.min(
    Math.max(w * (posture === "seated" ? 0.78 : 0.68), headH * 0.92),
    w * 0.98,
  );
  const hatPad = Math.min(
    headH * (posture === "seated" ? 0.34 : 0.22),
    y,
    Math.max(12, frameH * 0.03),
  );
  headH = Math.min(headH + hatPad, frameH);
  return clampBox(
    {
      x: x + (w - headW) / 2,
      y: y - hatPad,
      w: headW,
      h: headH,
      score,
    },
    frameW,
    frameH,
  );
}

/**
 * Build a head box from pose landmarks (ears / nose / shoulders).
 * Works for rear and side views where faces are invisible — ears and
 * shoulders still locate the top of the head.
 */
export function headFromPose(
  landmarks: PosePoint[],
  frameW: number,
  frameH: number,
  score: number,
  posture: PostureMode = "seated",
): HeadBox | null {
  if (!landmarks.length) return null;

  const usable = (i: number, minVis = 0.15) => {
    const p = landmarks[i];
    if (!p) return null;
    if (typeof p.visibility === "number" && p.visibility < minVis) return null;
    if (p.x < -0.05 || p.x > 1.05 || p.y < -0.05 || p.y > 1.05) return null;
    return p;
  };

  // 7/8 ears, 0 nose — good when any part of the skull is in view.
  const crown = [usable(7), usable(8), usable(0)].filter(Boolean) as PosePoint[];
  const lShoulder = usable(11, 0.12);
  const rShoulder = usable(12, 0.12);
  const seated = posture === "seated";

  let cx: number;
  let cy: number;
  let size: number;

  if (crown.length > 0) {
    cx = (crown.reduce((s, p) => s + p.x, 0) / crown.length) * frameW;
    cy = (crown.reduce((s, p) => s + p.y, 0) / crown.length) * frameH;
    if (crown.length >= 2) {
      const dx = (crown[0]!.x - crown[1]!.x) * frameW;
      const dy = (crown[0]!.y - crown[1]!.y) * frameH;
      size = Math.max(28, Math.hypot(dx, dy) * (seated ? 2.1 : 1.85));
    } else if (lShoulder && rShoulder) {
      size = Math.max(
        28,
        Math.abs(lShoulder.x - rShoulder.x) * frameW * (seated ? 0.82 : 0.7),
      );
    } else {
      size = Math.max(32, frameW * (seated ? 0.1 : 0.08));
    }
    cy -= size * (seated ? 0.28 : 0.22);
  } else if (lShoulder || rShoulder) {
    const shoulders = [lShoulder, rShoulder].filter(Boolean) as PosePoint[];
    cx = (shoulders.reduce((s, p) => s + p.x, 0) / shoulders.length) * frameW;
    const shoulderY =
      (shoulders.reduce((s, p) => s + p.y, 0) / shoulders.length) * frameH;
    if (lShoulder && rShoulder) {
      size = Math.max(
        30,
        Math.abs(lShoulder.x - rShoulder.x) * frameW * (seated ? 0.78 : 0.65),
      );
    } else {
      size = Math.max(34, frameW * (seated ? 0.11 : 0.09));
    }
    // Seated: head sits closer above the shoulder line in frame.
    cy = shoulderY - size * (seated ? 0.7 : 0.9);
  } else {
    return null;
  }

  const w = size * (seated ? 1.12 : 1.05);
  const h = size * (seated ? 1.22 : 1.15);
  return clampBox(
    {
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
      score,
    },
    frameW,
    frameH,
  );
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function filterHeads(boxes: HeadBox[], frameArea: number): HeadBox[] {
  // Distant heads from the back of a room are tiny — keep the floor low.
  const minArea = frameArea * 0.00035;
  return nms(
    boxes.filter((box) => box.w * box.h >= minArea && box.w > 6 && box.h > 6),
    0.4,
  );
}

export function mergeHeadSets(a: HeadBox[], b: HeadBox[]): HeadBox[] {
  return nms([...a, ...b], 0.35);
}

export function clusterHeads(frames: HeadBox[][], iouThresh = 0.28): HeadBox[] {
  if (frames.length === 0) return [];
  const latest = frames[frames.length - 1] ?? [];
  type Cluster = { box: HeadBox; hits: number };
  const clusters: Cluster[] = [];

  for (const frame of frames) {
    for (const box of frame) {
      let best: Cluster | undefined;
      let bestIou = iouThresh;
      for (const cluster of clusters) {
        const overlap = iou(cluster.box, box);
        if (overlap > bestIou) {
          bestIou = overlap;
          best = cluster;
        }
      }
      if (best) {
        const n = best.hits + 1;
        best.box = {
          x: (best.box.x * best.hits + box.x) / n,
          y: (best.box.y * best.hits + box.y) / n,
          w: (best.box.w * best.hits + box.w) / n,
          h: (best.box.h * best.hits + box.h) / n,
          score: Math.max(best.box.score, box.score),
        };
        best.hits = n;
      } else {
        clusters.push({ box: { ...box }, hits: 1 });
      }
    }
  }

  const minHits = Math.max(1, Math.ceil(frames.length * 0.3));
  const stable = clusters.filter((cluster) => cluster.hits >= minHits);
  if (stable.length === 0) return nms(latest);
  return nms(stable.map((cluster) => cluster.box));
}
