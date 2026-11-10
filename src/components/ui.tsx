import { useEffect, useState, type ReactNode } from 'react'
import { marked } from 'marked'
import { LEVELS, levelColor } from '../lib/competency'

const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14',
  code: 'm8 17-5-5 5-5m8 0 5 5-5 5M14 4l-4 16',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  rocket: 'M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2m-1-5a22 22 0 0 1 11-10 22 22 0 0 1-10 11M9 12l3 3m-5-2H3l3-4h4m4 4v4l4-3v-4',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 2h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35',
  play: 'M6 4l14 8-14 8z',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  bulb: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z',
  flag: 'M4 22V4m0 0s1-1 4-1 5 2 8 2 4-1 4-1v11s-1 1-4 1-5-2-8-2-4 1-4 1',
  star: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-14v4l3 2',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'M19 12H5m6 6-6-6 6-6',
  menu: 'M3 6h18M3 12h18M3 18h18',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18m-2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  layers: 'm12 2 10 5-10 5L2 7zm-10 10 10 5 10-5M2 17l10 5 10-5',
  database: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  cloud: 'M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z',
  flow: 'M5 3v4m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 4v6m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm14-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 9h10',
  dag: 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm12 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v3a3 3 0 0 0 3 3h6',
  spark: 'M13 2 3 14h9l-1 8 10-12h-9z',
  warehouse: 'M3 21V8l9-5 9 5v13M7 21v-8h10v8M7 17h10',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  note: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  brain: 'M9.5 2A2.5 2.5 0 0 0 7 4.5v.5A2.5 2.5 0 0 0 4.5 7.5 2.5 2.5 0 0 0 4 12a2.5 2.5 0 0 0 1.5 4.5A2.5 2.5 0 0 0 9.5 22 2.5 2.5 0 0 0 12 19.5V4.5A2.5 2.5 0 0 0 9.5 2zm5 0A2.5 2.5 0 0 1 17 4.5v.5a2.5 2.5 0 0 1 2.5 2.5A2.5 2.5 0 0 1 20 12a2.5 2.5 0 0 1-1.5 4.5 2.5 2.5 0 0 1-4 5.5 2.5 2.5 0 0 1-2.5-2.5',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m14-7-5-5-5 5m5-5v12',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-15v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  pause: 'M6 4h4v16H6zm8 0h4v16h-4z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  sidebar: 'M3 3h18v18H3zM9 3v18',
  bug: 'M8 2l1.9 1.9M16 2l-1.9 1.9M9 7.1V6a3 3 0 1 1 6 0v1.1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zm0 0v-9M6 13H2m4-4-3-2m3 10-3 2m19-6h-4m4-4-3 2m3 8-3-2',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
}
export function Icon({ name, size = 18, className = '', stroke = 1.8 }: { name: string; size?: number; className?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={P[name] || P.note} />
    </svg>
  )
}

export function Modal({ open, onClose, children, wide, className = '' }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean; className?: string }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''} ${className}`} role="dialog">{children}</div>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode; icon?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)} role="tab" aria-selected={value === t.id}>
          {t.icon && <Icon name={t.icon} size={15} />}{t.label}
        </button>
      ))}
    </div>
  )
}
export function Seg<T extends string>({ options, value, onChange }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return <div className="seg">{options.map((o) => <button key={o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>
}

export function Level({ level, label }: { level: number; label?: string }) {
  return <span className="lvl" title={LEVELS[level]}><i style={{ background: levelColor(level) }} />{label || LEVELS[level]}</span>
}
export function Bar({ value, color, height }: { value: number; color?: string; height?: number }) {
  return <div className="bar" style={height ? { height } : undefined}><i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} /></div>
}
export function Empty({ title, children, icon = 'note' }: { title: string; children?: ReactNode; icon?: string }) {
  return <div className="empty"><Icon name={icon} size={28} /><b>{title}</b>{children}</div>
}
export function Loading({ text = 'Loading…' }: { text?: string }) { return <div className="loading"><div className="spin" />{text}</div> }

export function Html({ html, className = 'prose' }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Runtime markdown for the learner's own text (escaped first: personal notes cannot inject HTML). */
export const mdToHtml = (text: string) => marked.parse(esc(text || ''), { async: false, gfm: true, breaks: true }) as string
export function Markdown({ text, className = 'prose' }: { text: string; className?: string }) {
  const html = mdToHtml(text)
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

// ---------- toasts ----------
type Toast = { id: number; text: string }
let listeners: ((t: Toast[]) => void)[] = []
let toasts: Toast[] = []
export function toast(text: string) {
  const t = { id: Date.now() + Math.random(), text }
  toasts = [...toasts, t]; listeners.forEach((l) => l(toasts))
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); listeners.forEach((l) => l(toasts)) }, 3200)
}
export function Toasts() {
  const [list, setList] = useState<Toast[]>([])
  useEffect(() => { listeners.push(setList); return () => { listeners = listeners.filter((l) => l !== setList) } }, [])
  return <div className="toast-wrap">{list.map((t) => <div key={t.id} className="toast">{t.text}</div>)}</div>
}

export function ResultTable({ columns, rows, total, max = 200 }: { columns: string[]; rows: any[][]; total?: number; max?: number }) {
  if (!columns.length) return <div className="muted small" style={{ padding: 12 }}>Statement executed — no rows returned.</div>
  return (
    <div className="result-table">
      <table>
        <thead><tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, max).map((r, i) => <tr key={i}>{r.map((v, j) => v === null ? <td key={j} className="null">NULL</td> : <td key={j} title={String(v)}>{typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 10000) / 10000 : String(v)}</td>)}</tr>)}
        </tbody>
      </table>
      {(total ?? rows.length) > Math.min(max, rows.length) && <div className="muted tiny" style={{ padding: '6px 10px' }}>Showing {Math.min(max, rows.length)} of {total} rows</div>}
    </div>
  )
}

export function KindBadge({ kind }: { kind: string }) {
  const m: Record<string, [string, string]> = { coding: ['Coding', 'accent'], debug: ['Debugging', 'bad'], scenario: ['Scenario', 'warn'], predict: ['Predict output', 'info'], concept: ['Concept', 'info'], assignment: ['Assignment', 'good'] }
  const [l, c] = m[kind] || [kind, '']
  return <span className={`badge ${c}`}>{l}</span>
}
export const Diff = ({ d }: { d: number }) => <span className="badge outline" title="Difficulty">{'●'.repeat(d)}{'○'.repeat(3 - d)}</span>
