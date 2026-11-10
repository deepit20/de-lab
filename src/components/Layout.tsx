import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import MiniSearch from 'minisearch'
import { db, updateSettings, type PersonalNote } from '../db'
import { go, useProfile, useRoute } from '../lib/hooks'
import { loadSearchDocs, trackById } from '../content'
import { fmtMin, todayKey } from '../lib/util'
import { isDemo, exitDemo } from '../lib/demo'
import { REPO_URL, repoConfigured } from '../config'
import { Icon, Modal, Toasts } from './ui'

const NAV: { sec?: string; to: string; label: string; icon: string; match: string[] }[] = [
  { to: '/', label: 'Today', icon: 'home', match: [''] },
  { sec: 'Learn', to: '/learn', label: 'Roadmap', icon: 'map', match: ['learn', 'topic'] },
  { to: '/practice', label: 'Practice', icon: 'code', match: ['practice', 'playground'] },
  { to: '/revise', label: 'Revision', icon: 'repeat', match: ['revise'] },
  { to: '/notes', label: 'Notes library', icon: 'book', match: ['notes'] },
  { sec: 'Apply', to: '/projects', label: 'Projects', icon: 'rocket', match: ['projects'] },
  { to: '/interview', label: 'Interview prep', icon: 'mic', match: ['interview'] },
  { to: '/communicate', label: 'Communication', icon: 'chat', match: ['communicate'] },
  { sec: 'Insight', to: '/analytics', label: 'Analytics', icon: 'chart', match: ['analytics'] },
  { to: '/settings', label: 'Settings & backup', icon: 'gear', match: ['settings'] },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { parts } = useRoute()
  const profile = useProfile()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nav-collapsed') === '1')
  const [palette, setPalette] = useState(false)
  const due = useLiveQuery(() => db.cards.where('due').belowOrEqual(Date.now()).filter((c) => !c.suspended).count(), [], 0)
  const todaySec = useLiveQuery(() => db.activity.where('day').equals(todayKey()).toArray().then((a) => a.reduce((s, x) => s + x.seconds, 0)), [], 0)
  const theme = profile?.settings.theme || 'system'

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  const cycleTheme = () => updateSettings({ theme: theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system' })
  const isDark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">DE</div><div><b>DE Lab</b><small>{profile?.name ? `${profile.name}'s workspace` : 'Learning workspace'}</small></div></div>
        <nav className="nav">
          {NAV.map((n) => (
            <div key={n.to} style={{ display: 'contents' }}>
              {n.sec && <div className="nav-sec">{n.sec}</div>}
              <a href={'#' + n.to} className={n.match.includes(parts[0] || '') ? 'active' : ''} title={n.label}>
                <Icon name={n.icon} /><span>{n.label}</span>
                {n.to === '/revise' && due > 0 && <span className="count">{due > 99 ? '99+' : due}</span>}
              </a>
            </div>
          ))}
        </nav>
        <div className="side-foot">
          {repoConfigured && <a className="btn sm ghost" href={REPO_URL} target="_blank" rel="noopener noreferrer" style={{ marginBottom: 4 }}><Icon name="star" size={14} />Star on GitHub</a>}
          <button className="btn sm ghost" onClick={() => { setCollapsed(!collapsed); localStorage.setItem('nav-collapsed', collapsed ? '0' : '1') }}><Icon name="sidebar" size={14} />Collapse</button>
        </div>
      </aside>
      <main className="main" id="main">
        <div className="topbar no-print">
          <button className="search-btn" onClick={() => setPalette(true)}><Icon name="search" size={16} /><span className="sb-text">Search topics, notes, exercises, questions…</span><kbd>Ctrl K</kbd></button>
          <span className="spacer" />
          <span className="badge outline" title="Active study time today"><Icon name="clock" size={13} />{fmtMin(todaySec / 60)} today</span>
          <button className="btn icon ghost" onClick={cycleTheme} title={`Theme: ${theme}`}><Icon name={isDark ? 'moon' : 'sun'} /></button>
        </div>
        {isDemo() && <div className="banner info no-print" style={{ margin: '12px 28px 0', borderRadius: 10 }}><Icon name="eye" /><span><b>Demo workspace</b> — sample progress for "Alex". Everything is interactive; nothing leaves your browser.</span><span className="spacer" /><button className="btn sm primary" onClick={() => { if (confirm('Clear the demo data and start your own workspace?')) exitDemo() }}>Start my own workspace</button></div>}
        {children}
      </main>
      <Palette open={palette} onClose={() => setPalette(false)} />
      <Toasts />
    </div>
  )
}

const ACTIONS = [
  { title: "Today's plan", to: '/', hint: 'Dashboard' }, { title: 'Start revision session', to: '/revise/session', hint: 'Revision' },
  { title: 'SQL playground', to: '/playground/sql', hint: 'Practice' }, { title: 'Python playground', to: '/playground/python', hint: 'Practice' },
  { title: 'Mock interview', to: '/interview/mock', hint: 'Interview' }, { title: 'Analyse a job description', to: '/interview/jd', hint: 'Interview' },
  { title: 'Mistake journal', to: '/notes/mistakes', hint: 'Notes' }, { title: 'My notes', to: '/notes/mine', hint: 'Notes' },
  { title: 'Cheat sheets', to: '/notes/cheatsheets', hint: 'Notes' }, { title: 'Backup my data', to: '/settings', hint: 'Settings' },
  { title: 'Competency map', to: '/analytics', hint: 'Analytics' }, { title: 'Projects', to: '/projects', hint: 'Projects' },
]
let ms: MiniSearch | null = null
function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [ready, setReady] = useState(!!ms)
  const [sel, setSel] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  const notes = useLiveQuery<PersonalNote[], PersonalNote[]>(() => (open ? db.notes.toArray() : Promise.resolve([] as PersonalNote[])), [open], [])
  useEffect(() => {
    if (!open) return
    setQ(''); setSel(0); setTimeout(() => ref.current?.focus(), 30)
    if (!ms) loadSearchDocs().then((docs) => {
      ms = new MiniSearch({ fields: ['title', 'text'], storeFields: ['title', 'type', 'track', 'text'], searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.15 } })
      ms.addAll(docs.map((d, i) => ({ ...d, id: i, ref: d.id, text: d.text })))
      ;(ms as any)._refs = docs.map((d) => d.id)
      setReady(true)
    })
  }, [open])
  const results = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const acts = ACTIONS.filter((a) => !ql || a.title.toLowerCase().includes(ql)).slice(0, ql ? 4 : 8).map((a) => ({ type: 'action', title: a.title, sub: a.hint, to: a.to }))
    if (!ql || !ms) return acts
    const refs: string[] = (ms as any)._refs
    const hits = ms.search(q).slice(0, 14).map((h: any) => {
      const id = refs[h.id]
      const to = h.type === 'topic' ? `/topic/${id}` : h.type === 'exercise' ? `/practice/${id}` : h.type === 'project' ? `/projects/${id}` : `/interview/bank?q=${encodeURIComponent(id)}`
      const text = String(h.text || '')
      const pos = text.toLowerCase().indexOf(ql.split(' ')[0])
      return { type: h.type, title: h.title, sub: `${trackById[h.track]?.short || ''} · ${pos >= 0 ? '…' + text.slice(Math.max(0, pos - 40), pos + 80) + '…' : text.slice(0, 100)}`, to }
    })
    const mine = notes.filter((n) => (n.title + ' ' + n.body).toLowerCase().includes(ql)).slice(0, 4).map((n) => ({ type: 'my note', title: n.title || 'Untitled note', sub: n.body.slice(0, 100), to: n.topicId ? `/topic/${n.topicId}/mine` : '/notes/mine' }))
    return [...acts, ...hits, ...mine]
  }, [q, ready, notes])
  const pick = (r: { to: string }) => { go(r.to); onClose() }
  return (
    <Modal open={open} onClose={onClose} className="palette">
      <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setSel(0) }} placeholder="Search everything… (topics, notes, exercises, interview questions, your notes)"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) }
          if (e.key === 'Enter' && results[sel]) pick(results[sel])
        }} />
      <div className="results">
        {!ready && q && <div className="loading"><div className="spin" />Indexing…</div>}
        {results.map((r, i) => (
          <div key={i} className={`res ${i === sel ? 'on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => pick(r)}>
            <span className="kind-tag">{r.type}</span>
            <div style={{ minWidth: 0 }}><div>{r.title}</div><small>{r.sub}</small></div>
          </div>
        ))}
        {q && ready && results.length === 0 && <div className="empty">No matches.</div>}
      </div>
    </Modal>
  )
}
