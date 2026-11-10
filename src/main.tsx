import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { requestPersistence } from './lib/backup'
import { getProfile } from './db'

// `?demo=1` opens a pre-filled demo workspace (used by the live demo link and screenshots)
async function boot() {
  const p = await getProfile()
  if (new URLSearchParams(location.search).has('demo')) {
    if (!p.onboarded) await import('./lib/demo').then((m) => m.loadDemo())
    history.replaceState(null, '', location.pathname + location.hash)
  }
}
// make sure the profile row exists before any live query reads it
boot().catch(() => {}).finally(() => createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>))

// Ask the browser not to evict learning data under storage pressure.
requestPersistence()

// Offline support + instant re-opens (production builds only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}
