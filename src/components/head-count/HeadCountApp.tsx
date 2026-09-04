"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HeadCountEngine, type PostureMode } from "@/lib/head-count/engine";
import { clusterHeads, median, type HeadBox } from "@/lib/head-count/geometry";
import {
  clearHistory,
  loadHistory,
  saveCount,
  type CountRecord,
} from "@/lib/head-count/history";
import "./head-count.css";

type ReviewBox = HeadBox & { included: boolean };
type Facing = "environment" | "user";

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera access blocked — allow camera for this page and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera found. Connect a camera or try the other lens.";
  }
  if (name === "NotReadableError") {
    return "Camera is in use by another app. Close it and retry.";
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera needs HTTPS. Open this page from the Vercel URL, not http.";
  }
  return "Could not start the camera. Check permissions and reload.";
}

export default function HeadCountApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HeadCountEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectingRef = useRef(false);
  const loopRef = useRef(0);
  const latestRef = useRef<HeadBox[]>([]);
  const bufferRef = useRef<HeadBox[][]>([]);
  const countsRef = useRef<number[]>([]);
  const thresholdRef = useRef(0.28);
  const postureRef = useRef<PostureMode>("seated");
  const torchOnRef = useRef(false);

  const [status, setStatus] = useState("Tap Start to load the detector.");
  const [liveCount, setLiveCount] = useState(0);
  const [threshold, setThreshold] = useState(28);
  const [posture, setPosture] = useState<PostureMode>("seated");
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [canCount, setCanCount] = useState(false);
  const [facing, setFacing] = useState<Facing>("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [snapshot, setSnapshot] = useState("");
  const [snapSize, setSnapSize] = useState({ w: 1, h: 1 });
  const [reviewBoxes, setReviewBoxes] = useState<ReviewBox[]>([]);
  const [manualOffset, setManualOffset] = useState(0);
  const [history, setHistory] = useState<CountRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    return () => {
      detectingRef.current = false;
      window.clearTimeout(loopRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      engineRef.current?.close();
    };
  }, []);

  useEffect(() => {
    thresholdRef.current = threshold / 100;
    void engineRef.current?.setThreshold(thresholdRef.current);
  }, [threshold]);

  useEffect(() => {
    postureRef.current = posture;
    engineRef.current?.setPosture(posture);
    bufferRef.current = [];
    countsRef.current = [];
  }, [posture]);

  const drawOverlay = useCallback((boxes: HeadBox[]) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = Math.max(2, canvas.width * 0.003);
    const cutoff = Math.max(0.4, thresholdRef.current + 0.18);
    for (const box of boxes) {
      ctx.strokeStyle = box.score >= cutoff ? "#6ee7b7" : "#f0b25a";
      ctx.setLineDash(box.score < cutoff ? [6, 4] : []);
      // Soft oval — we're targeting head/hair/hat shapes, not face crops.
      const rx = box.w / 2;
      const ry = box.h / 2;
      ctx.beginPath();
      ctx.ellipse(box.x + rx, box.y + ry, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }, []);

  const detectTick = useCallback(() => {
    if (!detectingRef.current) return;
    const video = videoRef.current;
    const engine = engineRef.current;
    if (video && engine) {
      const boxes = engine.detect(video, thresholdRef.current);
      latestRef.current = boxes;
      const buf = bufferRef.current;
      buf.push(boxes);
      if (buf.length > 8) buf.shift();
      const counts = countsRef.current;
      counts.push(boxes.length);
      if (counts.length > 7) counts.shift();
      setLiveCount(median(counts));
      drawOverlay(boxes);
      setCanCount(true);
      setStatus(
        boxes.length
          ? postureRef.current === "seated"
            ? "Live — seated mode · head tops (hair / hats)."
            : "Live — standing mode · head tops (hair / hats)."
          : postureRef.current === "seated"
            ? "Scanning seated head shapes — get closer if empty."
            : "Scanning standing head shapes — tip: fill more of the frame.",
      );
    }
    // lite2 + pose is heavier than the prototype; give the phone a beat.
    loopRef.current = window.setTimeout(detectTick, 140);
  }, [drawOverlay]);

  const attachStream = useCallback(async (nextFacing: Facing) => {
    const video = videoRef.current;
    if (!video) throw new Error("Video missing");
    streamRef.current?.getTracks().forEach((track) => track.stop());

    const constraints: MediaStreamConstraints[] = [
      {
        audio: false,
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      { audio: false, video: { facingMode: nextFacing } },
      { audio: false, video: true },
    ];

    let stream: MediaStream | null = null;
    let lastErr: unknown;
    for (const constraint of constraints) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraint);
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!stream) throw lastErr ?? new Error("No camera");

    streamRef.current = stream;
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    await video.play();

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    if (innerRef.current) innerRef.current.style.aspectRatio = `${vw} / ${vh}`;
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.width = vw;
      overlay.height = vh;
    }

    const track = stream.getVideoTracks()[0];
    const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
    setHasTorch(Boolean(caps?.torch));
    if (caps?.torch && torchOnRef.current) {
      await track.applyConstraints({
        advanced: [{ torch: true }],
      } as unknown as MediaTrackConstraints);
    }
  }, []);

  const start = useCallback(async () => {
    setStarting(true);
    setStatus("Requesting camera…");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API missing");
      }
      await attachStream(facing);
      setStarted(true);
      setStatus("Loading head detector (first load can take a few seconds)…");
      const engine = new HeadCountEngine();
      engineRef.current = engine;
      await engine.load(thresholdRef.current, postureRef.current);
      detectingRef.current = true;
      setStarting(false);
      detectTick();
    } catch (err) {
      setStatus(cameraErrorMessage(err));
      setStarting(false);
    }
  }, [attachStream, detectTick, facing]);

  const flip = useCallback(async () => {
    const next: Facing = facing === "environment" ? "user" : "environment";
    setFacing(next);
    if (!started) return;
    detectingRef.current = false;
    try {
      await attachStream(next);
      detectingRef.current = true;
      detectTick();
    } catch (err) {
      setStatus(cameraErrorMessage(err));
    }
  }, [attachStream, detectTick, facing, started]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOnRef.current;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      torchOnRef.current = next;
      setTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  }, []);

  const enterReview = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    detectingRef.current = false;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setSnapshot(canvas.toDataURL("image/jpeg", 0.88));
    setSnapSize({ w: canvas.width, h: canvas.height });
    const heads = clusterHeads(
      bufferRef.current.length ? bufferRef.current : [latestRef.current],
    );
    setReviewBoxes(heads.map((box) => ({ ...box, included: true })));
    setManualOffset(0);
    setReviewing(true);
    try {
      navigator.vibrate?.(30);
    } catch {
      /* iOS */
    }
  }, []);

  const included = reviewBoxes.filter((box) => box.included).length;
  const finalCount = Math.max(0, included + manualOffset);

  const resumeLive = useCallback(() => {
    setReviewing(false);
    detectingRef.current = true;
    detectTick();
  }, [detectTick]);

  const finishCount = useCallback(async () => {
    const next = saveCount({
      total: finalCount,
      detected: included,
      added: manualOffset,
    });
    setHistory(next);
    setToast(`Saved ${finalCount}`);
    window.setTimeout(() => setToast(""), 1800);
    try {
      await navigator.clipboard?.writeText(String(finalCount));
    } catch {
      /* ignore */
    }
    resumeLive();
  }, [finalCount, included, manualOffset, resumeLive]);

  const toggleBox = (index: number) => {
    setReviewBoxes((boxes) =>
      boxes.map((box, i) => (i === index ? { ...box, included: !box.included } : box)),
    );
  };

  return (
    <div className="hc-app">
      <div className={`hc-live${reviewing ? " hc-hidden" : ""}`}>
        <div className="hc-stage">
          <div
            ref={innerRef}
            className={`hc-inner${facing === "user" ? " is-front" : ""}`}
          >
            <video ref={videoRef} autoPlay playsInline muted />
            <canvas ref={overlayRef} className="hc-overlay" />
          </div>
          <div className="hc-top">
            <div className="hc-status">{status}</div>
            <div className="hc-count-wrap">
              <div className="hc-count" aria-live="polite">
                {liveCount}
              </div>
              <div className="hc-count-label">HEADS</div>
            </div>
          </div>
          {!started && (
            <div className="hc-empty">
              <div className="hc-mark" aria-hidden>
                {liveCount || "0"}
              </div>
              <h1>Head Count</h1>
              <p>
                Built for the back of a room. Default is seated — it looks for
                head shapes (hair, hats, crowns), not faces. Switch to standing
                when people are on their feet. Video stays on this device.
              </p>
              <button className="hc-primary" onClick={() => void start()} disabled={starting}>
                {starting ? "Starting…" : "Start camera"}
              </button>
              {history.length > 0 && (
                <button className="hc-ghost" onClick={() => setShowHistory(true)}>
                  {history.length} saved count{history.length === 1 ? "" : "s"}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="hc-bottom">
          <div className="hc-modes" role="group" aria-label="Posture mode">
            <button
              type="button"
              className={posture === "seated" ? "is-on" : ""}
              onClick={() => setPosture("seated")}
            >
              Seated
            </button>
            <button
              type="button"
              className={posture === "standing" ? "is-on" : ""}
              onClick={() => setPosture("standing")}
            >
              Standing
            </button>
          </div>
          <div className="hc-controls">
            <button className="hc-icon-btn" onClick={() => void flip()} aria-label="Switch camera" title="Switch camera">
              ⟲
            </button>
            {hasTorch && (
              <button
                className="hc-icon-btn"
                onClick={() => void toggleTorch()}
                aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
                title="Flashlight"
              >
                {torchOn ? "◉" : "○"}
              </button>
            )}
            <div className="hc-sens">
              <label>
                <span>Sensitivity</span>
                <span>{threshold}%</span>
              </label>
              <input
                type="range"
                min={12}
                max={60}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                aria-label="Detection sensitivity"
              />
            </div>
            <button className="hc-icon-btn" onClick={() => setShowHistory(true)} aria-label="Count history">
              ≡
            </button>
            <button className="hc-primary" onClick={enterReview} disabled={!canCount}>
              Count
            </button>
          </div>
        </div>
      </div>

      {reviewing && (
        <div className="hc-review">
          <div className="hc-stage">
            <div className="hc-inner" style={{ aspectRatio: `${snapSize.w} / ${snapSize.h}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={snapshot} alt="Frozen room snapshot" />
              {reviewBoxes.map((box, i) => (
                <button
                  key={`${box.x}-${box.y}-${i}`}
                  type="button"
                  className={`hc-review-box${box.included ? "" : " is-out"}`}
                  style={{
                    left: `${(box.x / snapSize.w) * 100}%`,
                    top: `${(box.y / snapSize.h) * 100}%`,
                    width: `${(box.w / snapSize.w) * 100}%`,
                    height: `${(box.h / snapSize.h) * 100}%`,
                  }}
                  onClick={() => toggleBox(i)}
                  aria-label={box.included ? "Exclude this head" : "Include this head"}
                />
              ))}
            </div>
            <div className="hc-review-top">
              Tap a head to drop a false hit · hair and hats count
            </div>
          </div>
          <div className="hc-review-bar">
            <div className="hc-count-wrap">
              <div className="hc-final">{finalCount}</div>
              <div className="hc-count-label">FINAL COUNT</div>
            </div>
            <div className="hc-manual">
              <button className="hc-adj" onClick={() => setManualOffset((n) => n - 1)} aria-label="Subtract missed">
                –
              </button>
              <div className="hc-status" style={{ maxWidth: "none", textAlign: "center" }}>
                {manualOffset === 0
                  ? "adjust for missed heads"
                  : manualOffset > 0
                    ? `+${manualOffset} added`
                    : `${manualOffset} removed`}
              </div>
              <button className="hc-adj" onClick={() => setManualOffset((n) => n + 1)} aria-label="Add missed">
                +
              </button>
            </div>
            <div className="hc-actions">
              <button className="hc-ghost" onClick={resumeLive}>
                New count
              </button>
              <button className="hc-primary" onClick={() => void finishCount()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="hc-sheet" role="dialog" aria-label="Saved counts">
          <h2>Saved counts</h2>
          {history.length === 0 ? (
            <p className="hc-status" style={{ maxWidth: "none" }}>
              Nothing saved yet. Freeze a room with Count, then Save.
            </p>
          ) : (
            <ul className="hc-log">
              {history.map((row) => (
                <li key={row.id}>
                  <span>
                    {new Date(row.at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <strong>{row.total}</strong>
                </li>
              ))}
            </ul>
          )}
          <div className="hc-actions" style={{ marginTop: 14 }}>
            {history.length > 0 && (
              <button
                className="hc-ghost"
                onClick={() => {
                  clearHistory();
                  setHistory([]);
                }}
              >
                Clear
              </button>
            )}
            <button className="hc-primary" onClick={() => setShowHistory(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {toast && <div className="hc-toast">{toast}</div>}
    </div>
  );
}
