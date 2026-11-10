import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Mistake } from '../db'
import { loadTopic, topicById, tracks, trackById } from '../content'
import type { TopicContent } from '../types'
import { go, useStudyClock } from '../lib/hooks'
import { ago } from '../lib/util'
import { HighlightableHtml } from '../components/NotesView'
import { NoteList } from '../components/PersonalNotes'
import { TopicPdfButton, exportTrack } from '../components/PdfExport'
import { MistakeModal } from '../components/Exercise'
import { Empty, Html, Icon, Loading, Seg, Tabs } from '../components/ui'

type V = 'library' | 'mine' | 'doubts' | 'highlights' | 'bookmarks' | 'mistakes' | 'cheatsheets'

export default function Notes({ view, sub }: { view?: string; sub?: string }) {
  const v = (view as V) || 'library'
  useStudyClock('notes', sub)
  return (
    <div className="page wide" style={{ maxWidth: 1400 }}>
      <div className="page-head"><div><h1>Notes library</h1><p>Prepared notes for every topic (detailed, crisp, memory), your own notes, highlights, bookmarks, doubts and the mistake journal.</p></div></div>
      <Tabs value={v} onChange={(t) => go(`/notes/${t}`)} tabs={[
        { id: 'library', label: 'Prepared notes', icon: 'book' }, { id: 'cheatsheets', label: 'Cheat sheets', icon: 'list' }, { id: 'mine', label: 'My notes', icon: 'edit' },
        { id: 'doubts', label: 'Doubts & questions', icon: 'alert' }, { id: 'highlights', label: 'Highlights', icon: 'star' }, { id: 'bookmarks', label: 'Bookmarks', icon: 'bookmark' }, { id: 'mistakes', label: 'Mistake journal', icon: 'flag' },
      ]} />
      {v === 'library' && <Library sub={sub} />}
      {v === 'cheatsheets' && <Cheatsheets sub={sub} />}
      {v === 'mine' && <NoteList />}
      {v === 'doubts' && <NoteList filter={(n) => n.kind === 'doubt' || n.kind === 'question'} />}
      {v === 'highlights' && <Highlights />}
      {v === 'bookmarks' && <Bookmarks />}
      {v === 'mistakes' && <Mistakes />}
    </div>
  )
}

function TopicPicker({ value, onPick }: { value?: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  return (
    <div className="sidebar-list card tight">
      <input className="input mb-s" placeholder="Filter topics…" value={q} onChange={(e) => setQ(e.target.value)} />
      {tracks.map((t) => {
        const ts = t.modules.flatMap((m) => m.topics).filter((x) => !q || x.title.toLowerCase().includes(q.toLowerCase()))
        if (!ts.length) return null
        return <div key={t.id} style={{ display: 'contents' }}><div className="grp">{t.short}</div>{ts.map((x) => <button key={x.id} className={value === x.id ? 'on' : ''} onClick={() => onPick(x.id)}><span className="dot" style={{ background: x.authored === 'full' ? t.color : x.authored === 'essential' ? 'var(--lv2)' : 'var(--lv0)' }} />{x.title}</button>)}</div>
      })}
    </div>
  )
}

function Library({ sub }: { sub?: string }) {
  const id = sub && topicById[sub] ? sub : 'sql-joins'
  const [c, setC] = useState<TopicContent | null>(null)
  const [view, setView] = useState('crisp')
  useEffect(() => { setC(null); loadTopic(id).then((x) => { setC(x); setView(x.detailed ? 'detailed' : x.crisp ? 'crisp' : 'outline') }) }, [id])
  const html = !c ? '' : view === 'detailed' ? c.detailed : view === 'crisp' ? c.crisp : view === 'memory' ? c.memory : c.outlineHtml || ''
  return (
    <div className="split-pane">
      <TopicPicker value={id} onPick={(t) => go(`/notes/library/${t}`)} />
      <div className="card" style={{ minWidth: 0 }}>
        {!c ? <Loading /> : <>
          <div className="row mb"><h2 style={{ margin: 0 }}>{topicById[id].title}</h2><span className="spacer" />
            <Seg value={view} onChange={setView} options={[...(c.detailed ? [{ id: 'detailed', label: 'Detailed' }] : []), ...(c.crisp ? [{ id: 'crisp', label: 'Crisp' }] : []), ...(c.memory ? [{ id: 'memory', label: 'Memory' }] : []), ...(!c.crisp ? [{ id: 'outline', label: 'Outline' }] : [])]} />
            <TopicPdfButton topicId={id} defaultView={view} />
            <a className="btn sm" href={`#/topic/${id}`}>Open topic</a></div>
          {html ? <HighlightableHtml html={html} topicId={id} view={view} /> : <Empty title="No notes yet" />}
        </>}
      </div>
    </div>
  )
}

function Cheatsheets({ sub }: { sub?: string }) {
  const tid = sub && trackById[sub] ? sub : 'sql'
  const track = trackById[tid]
  const [parts, setParts] = useState<{ id: string; title: string; html: string }[] | null>(null)
  useEffect(() => {
    setParts(null)
    const ts = track.modules.flatMap((m) => m.topics)
    Promise.all(ts.map((t) => loadTopic(t.id).then((c) => ({ id: t.id, title: t.title, html: c.crisp || c.outlineHtml || '' })))).then((p) => setParts(p.filter((x) => x.html)))
  }, [tid])
  return (
    <div>
      <div className="row mb no-print">{tracks.filter((t) => t.modules.some((m) => m.topics.length)).map((t) => <button key={t.id} className={`btn sm ${t.id === tid ? 'primary' : ''}`} onClick={() => go(`/notes/cheatsheets/${t.id}`)}>{t.short}</button>)}<span className="spacer" />
        <button className="btn sm" onClick={() => exportTrack(tid, 'cheatsheet')}><Icon name="download" size={14} />Cheat sheet PDF</button>
        <button className="btn sm" onClick={() => exportTrack(tid, 'full')} title="Detailed, crisp and memory notes plus flashcards for every topic in this track"><Icon name="download" size={14} />Full track notes PDF</button></div>
      <h2>{track.title} cheat sheet</h2>
      {!parts ? <Loading /> : <div className="grid g2">{parts.map((p) => <div key={p.id} className="card tight"><h3><a href={`#/topic/${p.id}`}>{p.title}</a></h3><Html html={p.html} className="prose small" /></div>)}</div>}
    </div>
  )
}

function Highlights() {
  const hls = useLiveQuery(() => db.highlights.orderBy('at').reverse().toArray(), [], [])
  if (!hls.length) return <Empty title="No highlights yet">Select text in any note to highlight it.</Empty>
  return <div className="col">{hls.map((h) => (
    <div key={h.id} className="note-card row nowrap" style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}><mark className={`hl ${h.color === 'yellow' ? '' : h.color}`}>{h.text}</mark>{h.comment && <div className="small dim mt-s">💬 {h.comment}</div>}<div className="muted tiny mt-s"><a href={`#/topic/${h.topicId}/notes`}>{topicById[h.topicId]?.title}</a> · {h.view} notes · {ago(h.at)}</div></div>
      <button className="btn sm ghost" onClick={() => db.highlights.delete(h.id!)}><Icon name="trash" size={14} /></button>
    </div>))}</div>
}

function Bookmarks() {
  const bms = useLiveQuery(() => db.bookmarks.orderBy('at').reverse().toArray(), [], [])
  if (!bms.length) return <Empty title="No bookmarks yet">Bookmark topics, note sections or exercises.</Empty>
  const link = (b: typeof bms[number]) => b.kind === 'topic' ? `#/topic/${b.ref}` : b.kind === 'section' ? `#/topic/${b.topicId}/notes` : b.kind === 'exercise' ? `#/practice/${b.ref}` : b.kind === 'project' ? `#/projects/${b.ref}` : '#/notes'
  return <div className="card"><div className="list">{bms.map((b) => (
    <div key={b.id} className="item"><Icon name="bookmark" size={15} /><a href={link(b)} style={{ flex: 1 }}>{b.label}</a><span className="badge">{b.kind}</span>{b.topicId && b.kind !== 'topic' && <span className="muted tiny">{topicById[b.topicId]?.title}</span>}<button className="btn sm ghost" onClick={() => db.bookmarks.delete(b.id!)}><Icon name="x" size={13} /></button></div>
  ))}</div></div>
}

function Mistakes() {
  const ms = useLiveQuery(() => db.mistakes.orderBy('at').reverse().toArray(), [], [])
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState('all')
  const list = ms.filter((m) => cat === 'all' || m.category === cat)
  const cats = ['all', 'concept', 'syntax', 'logic', 'assumption', 'debugging', 'performance', 'interview']
  return (
    <div className="col">
      <div className="row"><button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" size={15} />Log a mistake</button><div className="pill-nav">{cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div><span className="muted small">Each entry becomes a revision card.</span></div>
      {list.length === 0 && <Empty title="No mistakes logged">Wrong assumptions, debugging discoveries and lessons learned go here — they are the most valuable notes you will write.</Empty>}
      <div className="grid g2">{list.map((m: Mistake) => (
        <div key={m.id} className="note-card" style={{ opacity: m.resolved ? 0.6 : 1 }}>
          <div className="row mb-s"><span className="badge warn">{m.category}</span><b>{m.title}</b><span className="spacer" /><span className="muted tiny">{ago(m.at)}</span></div>
          {m.what && <div className="small dim mb-s">{m.what}</div>}
          <div className="small"><b style={{ color: 'var(--bad)' }}>Wrong:</b> {m.wrong || '—'}</div>
          <div className="small"><b style={{ color: 'var(--good)' }}>Correct:</b> {m.correct || '—'}</div>
          <div className="small"><b>Lesson:</b> {m.lesson || '—'}</div>
          {m.code && <details className="mt-s"><summary className="tiny" style={{ cursor: 'pointer' }}>Code at the time</summary><pre className="console small" style={{ background: 'var(--code-bg)', padding: 8, borderRadius: 8, overflowX: 'auto' }}>{m.code}</pre></details>}
          <div className="row mt-s">{m.topicId && topicById[m.topicId] && <a className="small" href={`#/topic/${m.topicId}`}>{topicById[m.topicId].title}</a>}<span className="spacer" /><button className="btn sm ghost" onClick={() => db.mistakes.update(m.id!, { resolved: !m.resolved })}>{m.resolved ? 'Reopen' : 'Mark resolved'}</button><button className="btn sm ghost" onClick={async () => { if (confirm('Delete?')) { await db.mistakes.delete(m.id!); await db.cards.delete(`mistake:${m.id}`) } }}><Icon name="trash" size={13} /></button></div>
        </div>
      ))}</div>
      <MistakeModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
