import {
  filterHeads,
  headFromPerson,
  headFromPose,
  mergeHeadSets,
  type HeadBox,
  type PosePoint,
  type PostureMode,
} from "./geometry";

export type { PostureMode };

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

const PEOPLE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite";

const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type DetectorLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => {
    detections: Array<{
      boundingBox?: {
        originX: number;
        originY: number;
        width: number;
        height: number;
      };
      categories: Array<{ score: number; categoryName?: string }>;
    }>;
  };
  setOptions: (options: Record<string, unknown>) => Promise<void>;
  close: () => void;
};

type PoseLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => {
    landmarks: PosePoint[][];
  };
  setOptions: (options: Record<string, unknown>) => Promise<void>;
  close: () => void;
};

export class HeadCountEngine {
  private fileset: unknown = null;
  private people: DetectorLike | null = null;
  private pose: PoseLike | null = null;
  private lastTs = 0;
  private lastThreshold = 0.28;
  private posture: PostureMode = "seated";
  private frame = 0;

  setPosture(posture: PostureMode): void {
    this.posture = posture;
    const modelFloor = this.modelFloor(this.lastThreshold);
    void this.people?.setOptions({ scoreThreshold: modelFloor });
    void this.pose?.setOptions({
      minPoseDetectionConfidence: Math.max(0.18, modelFloor),
      minPosePresenceConfidence: posture === "seated" ? 0.2 : 0.25,
    });
  }

  async load(threshold: number, posture: PostureMode = "seated"): Promise<void> {
    const { ObjectDetector, PoseLandmarker, FilesetResolver } = await import(
      "@mediapipe/tasks-vision"
    );
    this.fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
    this.lastThreshold = threshold;
    this.posture = posture;

    const modelFloor = this.modelFloor(threshold);

    const peopleOpts = (delegate: "GPU" | "CPU", allowlist: boolean) =>
      ObjectDetector.createFromOptions(this.fileset as never, {
        baseOptions: { modelAssetPath: PEOPLE_MODEL, delegate },
        runningMode: "VIDEO",
        scoreThreshold: modelFloor,
        maxResults: 50,
        ...(allowlist ? { categoryAllowlist: ["person"] } : {}),
      });

    try {
      this.people = await this.createWithDelegate((d) => peopleOpts(d, true));
    } catch {
      this.people = await this.createWithDelegate((d) => peopleOpts(d, false));
    }

    try {
      this.pose = await this.createWithDelegate((delegate) =>
        PoseLandmarker.createFromOptions(this.fileset as never, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate },
          runningMode: "VIDEO",
          numPoses: 12,
          minPoseDetectionConfidence: Math.max(0.18, modelFloor),
          minPosePresenceConfidence: posture === "seated" ? 0.2 : 0.25,
          minTrackingConfidence: 0.25,
        }),
      );
    } catch {
      this.pose = null;
    }
  }

  async setThreshold(threshold: number): Promise<void> {
    if (Math.abs(threshold - this.lastThreshold) < 0.005) return;
    this.lastThreshold = threshold;
    const modelFloor = this.modelFloor(threshold);
    await Promise.all([
      this.people?.setOptions({ scoreThreshold: modelFloor }),
      this.pose?.setOptions({
        minPoseDetectionConfidence: Math.max(0.18, modelFloor),
        minPosePresenceConfidence: this.posture === "seated" ? 0.2 : 0.25,
      }),
    ]);
  }

  detect(video: HTMLVideoElement, threshold: number): HeadBox[] {
    if (video.readyState < 2 || video.videoWidth === 0) return [];
    const frameW = video.videoWidth;
    const frameH = video.videoHeight;
    const fromPeople = this.detectPeople(video, threshold, frameW, frameH);
    this.frame += 1;
    const fromPose =
      this.pose && this.frame % 2 === 0
        ? this.detectPose(video, threshold, frameW, frameH)
        : [];
    return filterHeads(mergeHeadSets(fromPeople, fromPose), frameW * frameH);
  }

  close(): void {
    this.people?.close();
    this.pose?.close();
    this.people = null;
    this.pose = null;
  }

  private modelFloor(threshold: number): number {
    // Seated / rear views score lower — keep the model hungry.
    if (this.posture === "seated") {
      return Math.max(0.08, Math.min(0.18, threshold - 0.14));
    }
    return Math.max(0.12, Math.min(0.24, threshold - 0.1));
  }

  private detectPeople(
    video: HTMLVideoElement,
    threshold: number,
    frameW: number,
    frameH: number,
  ): HeadBox[] {
    if (!this.people) return [];
    const ts = this.nextTs();
    try {
      const result = this.people.detectForVideo(video, ts);
      const boxes: HeadBox[] = [];
      const accept =
        this.posture === "seated"
          ? Math.max(0.1, threshold - 0.12)
          : Math.max(0.14, threshold - 0.06);
      for (const det of result.detections) {
        const name = det.categories[0]?.categoryName?.toLowerCase();
        if (name && name !== "person") continue;
        const score = det.categories[0]?.score ?? 0;
        if (score < accept) continue;
        const box = det.boundingBox;
        if (!box || box.width < 8 || box.height < 8) continue;

        // Seated rooms: skip very tall thin hits that look like standing noise.
        const aspect = box.width / Math.max(box.height, 1);
        if (this.posture === "seated" && aspect < 0.35 && box.height > frameH * 0.7) {
          continue;
        }
        // Standing rooms: skip tiny squat blobs that are usually chairs/bags.
        if (this.posture === "standing" && aspect > 1.4 && box.height < frameH * 0.18) {
          continue;
        }

        boxes.push(
          headFromPerson(
            box.originX,
            box.originY,
            box.width,
            box.height,
            score,
            frameW,
            frameH,
            this.posture,
          ),
        );
      }
      return boxes;
    } catch {
      return [];
    }
  }

  private detectPose(
    video: HTMLVideoElement,
    threshold: number,
    frameW: number,
    frameH: number,
  ): HeadBox[] {
    if (!this.pose) return [];
    const ts = this.nextTs();
    try {
      const result = this.pose.detectForVideo(video, ts);
      const boxes: HeadBox[] = [];
      const accept =
        this.posture === "seated"
          ? Math.max(0.12, threshold - 0.08)
          : Math.max(0.16, threshold - 0.04);
      for (const landmarks of result.landmarks ?? []) {
        const box = headFromPose(
          landmarks,
          frameW,
          frameH,
          Math.max(accept, 0.3),
          this.posture,
        );
        if (box) boxes.push(box);
      }
      return boxes;
    } catch {
      return [];
    }
  }

  private nextTs(): number {
    const now = Math.max(performance.now(), this.lastTs + 1);
    this.lastTs = now;
    return now;
  }

  private async createWithDelegate<T>(
    factory: (delegate: "GPU" | "CPU") => Promise<T>,
  ): Promise<T> {
    try {
      return await factory("GPU");
    } catch {
      return factory("CPU");
    }
  }
}
