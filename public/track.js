/*
 * Visit reporter for Chris Rosenau's sites. Include once per page:
 *   <script src="https://resume-rho-taupe.vercel.app/track.js" data-site="vector-strike" defer></script>
 * Optional data-skip="/wall,/admin" skips those path prefixes.
 * Sends one beacon per browser tab session (city-level location is derived server-side).
 */
(function () {
  var s = document.currentScript;
  var site = s && s.getAttribute("data-site");
  if (!site || navigator.webdriver) return;
  // Optional: data-skip="/wall,/admin" — comma-separated path prefixes not to report.
  var skip = (s.getAttribute("data-skip") || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  for (var i = 0; i < skip.length; i++) if (location.pathname.indexOf(skip[i]) === 0) return;
  try {
    var sentKey = "rv_sent_" + site;
    if (sessionStorage.getItem(sentKey)) return;
    sessionStorage.setItem(sentKey, "1");
  } catch (e) {}
  var fp = "";
  try {
    fp = localStorage.getItem("rv_fp") || "";
    if (!fp) {
      fp = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
      localStorage.setItem("rv_fp", fp);
    }
  } catch (e) {}
  var tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  var body = JSON.stringify({
    site: site,
    path: location.pathname,
    referrer: document.referrer,
    language: navigator.language,
    screen: screen.width + "x" + screen.height,
    timezone: tz,
    fingerprint: fp,
  });
  var url = new URL("/api/visit/site", s.src).href;
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) return;
  } catch (e) {}
  try { fetch(url, { method: "POST", body: body, headers: { "Content-Type": "text/plain" }, keepalive: true, mode: "cors" }); } catch (e) {}
})();
