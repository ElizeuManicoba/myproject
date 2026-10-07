/* Service worker do Asset Planning. Gerado por build.py (BUILD_ID e lista de arquivos são substituídos).
   Estratégia: o app abre do cache (funciona sem internet); a página inicial tenta a rede primeiro para que
   uma nova versão publicada apareça assim que houver conexão. Nenhum dado de cliente passa por aqui. */
const BUILD_ID = "660de8bbea";
const CACHE = "asset-planning-" + BUILD_ID;
const SHELL = ["./", "index.html", "manifest.webmanifest", "assets/app.css", "assets/app.js", "assets/chart.umd.min.js", "assets/html2pdf.bundle.min.js", "assets/icon.svg", "assets/icon-192.png", "assets/icon-512.png", "assets/apple-touch-icon.png", "assets/fonts/fraunces-opsz.woff2", "assets/fonts/public-sans.woff2"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("asset-planning-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./", copy)); return res; }).catch(() => caches.match("./").then((r) => r || caches.match("index.html"))));
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
});
