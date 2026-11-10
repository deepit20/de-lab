/* DE Lab service worker: precaches the whole app on install so it opens instantly and works offline.
   Python (Pyodide) files from the CDN are cached the first time they are used. */
const CACHE = 'de-lab-v1'
const RUNTIME = 'de-lab-runtime-v1'

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const res = await fetch('./precache-manifest.json', { cache: 'no-store' })
    const { version, files } = await res.json()
    const cache = await caches.open(CACHE + '-' + version)
    await cache.addAll(files.map((f) => new Request(f, { cache: 'reload' })))
    await self.skipWaiting()
  })())
})
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    const res = await fetch('./precache-manifest.json', { cache: 'no-store' }).catch(() => null)
    const current = res ? CACHE + '-' + (await res.json()).version : null
    await Promise.all(keys.filter((k) => k.startsWith(CACHE) && current && k !== current).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(RUNTIME).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r })))
    return
  }
  if (url.origin !== location.origin) return
  if (url.pathname.endsWith('precache-manifest.json')) return
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: true })
    if (hit) return hit
    try { return await fetch(e.request) } catch { return (await caches.match('./index.html')) || Response.error() }
  })())
})
