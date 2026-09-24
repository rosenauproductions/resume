// Service worker for the pipeline push-notification addon.
// Scope is site-wide ("/") but the only thing it does is handle push
// events and notification clicks — no offline caching, intentionally.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Pipeline update", body: "", url: "/pipeline", tag: "resume-pipeline" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const actions = data.itemId
    ? [
        { action: "mark_handled", title: "Mark handled" },
        { action: "view", title: "View" },
      ]
    : [];

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "resume-pipeline",
    data: { url: data.url || "/pipeline", itemId: data.itemId || "" },
    actions,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

async function focusOrOpen(targetUrl) {
  const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of allClients) {
    const clientUrl = new URL(client.url);
    if (clientUrl.pathname === targetUrl && "focus" in client) {
      return client.focus();
    }
  }
  if (self.clients.openWindow) {
    return self.clients.openWindow(targetUrl);
  }
}

async function markHandled(itemId) {
  if (!itemId) return;
  try {
    await fetch(`/api/pipeline/copilot/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "handled" }),
      credentials: "same-origin",
    });
  } catch {
    // Best-effort — the item just stays pending in the feed if this fails
    // (e.g. session cookie expired); nothing else depends on it.
  }
}

self.addEventListener("notificationclick", (event) => {
  const targetUrl = event.notification.data?.url || "/pipeline";
  const itemId = event.notification.data?.itemId || "";
  event.notification.close();

  if (event.action === "mark_handled") {
    event.waitUntil(markHandled(itemId));
    return;
  }

  // "view" action, or a plain tap on the notification body — both open the app.
  event.waitUntil(focusOrOpen(targetUrl));
});
