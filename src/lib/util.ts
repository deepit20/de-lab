export const DAY = 86400000
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const dayKeyOf = (ts: number) => todayKey(new Date(ts))
export const addDays = (key: string, n: number) => { const [y, m, d] = key.split('-').map(Number); return todayKey(new Date(y, m - 1, d + n)) }
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const pct = (v: number) => `${Math.round(v * 100)}%`
export function fmtMin(min: number) { if (min < 60) return `${Math.round(min)} min`; const h = Math.floor(min / 60), m = Math.round(min % 60); return m ? `${h}h ${m}m` : `${h}h` }
export function ago(ts?: number) {
  if (!ts) return 'never'
  const s = (Date.now() - ts) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : new Date(ts).toLocaleDateString()
}
export function inDays(ts: number) {
  const d = Math.round((ts - Date.now()) / DAY)
  return d <= 0 ? 'due now' : d === 1 ? 'tomorrow' : `in ${d} days`
}
export const stripHtml = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()
export function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
export function groupBy<T>(arr: T[], key: (t: T) => string) { const m: Record<string, T[]> = {}; for (const a of arr) (m[key(a)] ||= []).push(a); return m }
export function shuffle<T>(arr: T[]) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)
export function download(name: string, text: string, type = 'application/json') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
