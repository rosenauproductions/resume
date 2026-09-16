"use client";

import { useCallback, useEffect, useState } from "react";

const cardClass = "rounded-xl border border-white/10 bg-black/20 p-4 space-y-3";
const btnAccent =
  "rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[var(--muted)] hover:border-white/30 hover:text-[var(--cream)] disabled:opacity-50";

type Status = "unsupported" | "checking" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotifications() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    } catch {
      setStatus("off");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    setNotice("");
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setNotice("VAPID key not configured on this deploy yet.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        setNotice("Permission not granted.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Save failed");
      setStatus("on");
      setNotice("Notifications enabled on this device.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setNotice("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      setNotice("Notifications turned off on this device.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test notification",
          body: "If you can see this, push notifications are working.",
          url: "/pipeline",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setNotice(data.error || "Send failed.");
      } else if (data.sent === 0) {
        setNotice("Sent, but no devices are subscribed — enable notifications first.");
      } else {
        setNotice(`Sent to ${data.sent} device(s).`);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--cream)]">Push notifications</h3>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Add this site to your phone&apos;s homescreen, then enable notifications here to get
        alerted the moment the hourly email bot finds something worth knowing about.
      </p>

      {status === "unsupported" ? (
        <p className="text-xs text-[var(--warm)]">
          This browser doesn&apos;t support push notifications (or you&apos;re not on the
          homescreen-installed app yet).
        </p>
      ) : status === "denied" ? (
        <p className="text-xs text-[var(--warm)]">
          Notifications are blocked for this site in your browser settings — re-enable them there
          first.
        </p>
      ) : status === "checking" ? (
        <p className="text-xs text-[var(--muted)]">Checking status…</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {status === "off" ? (
            <button className={btnAccent} disabled={busy} onClick={() => void enable()}>
              Enable notifications
            </button>
          ) : (
            <>
              <span className="text-xs text-[var(--accent)]">Enabled on this device</span>
              <button className={btnGhost} disabled={busy} onClick={() => void disable()}>
                Disable
              </button>
              <button className={btnGhost} disabled={busy} onClick={() => void sendTest()}>
                Send test
              </button>
            </>
          )}
        </div>
      )}

      {notice ? <p className="text-xs text-[var(--muted)]">{notice}</p> : null}
    </div>
  );
}
