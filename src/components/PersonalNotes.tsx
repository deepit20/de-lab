import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PersonalNote } from '../db'
import { ago } from '../lib/util'
import { Icon, Markdown, Seg, toast, Empty } from './ui'
import { topicById } from '../content'
import { exportMyNotes } from './PdfExport'

const KINDS: PersonalNote['kind'][] = ['note', 'example', 'explanation', 'doubt', 'question', 'copy']
const KIND_LABEL: Record<string, string> = { note: 'Note', example: 'Example', explanation: 'My explanation', doubt: 'Doubt', question: 'Question', copy: 'Custom copy' }

export async function saveNote(n: Partial<PersonalNote> & { body: string }) {
  const now = Date.now()
  if (n.id) {
    const old = await db.notes.get(n.id)
    if (!old) return
    const history = old.body !== n.body ? [...old.history, { at: old.updatedAt, body: old.body }].slice(-30) : old.history
    await db.notes.put({ ...old, ...n, updatedAt: now, history } as PersonalNote)
    return n.id
  }
  return db.notes.add({ title: n.title || '', body: n.body, kind: n.kind || 'note', topicId: n.topicId, createdAt: now, updatedAt: now, history: [], pinned: false, resolved: false })
}

export function NoteEditor({ note, topicId, onClose, initial }: { note?: PersonalNote; topicId?: string; onClose: () => void; initial?: Partial<PersonalNote> }) {
  const [title, setTitle] = useState(note?.title ?? initial?.title ?? '')
  const [body, setBody] = useState(note?.body ?? initial?.body ?? '')
  const [kind, setKind] = useState<PersonalNote['kind']>(note?.kind ?? initial?.kind ?? 'note')
  const [preview, setPreview] = useState(false)
  const [hist, setHist] = useState(false)
  const save = async () => { await saveNote({ id: note?.id, title, body, kind, topicId: note?.topicId ?? topicId }); toast('Saved'); onClose() }
  return (
    <div className="card">
      <div className="row mb-s">
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="select" style={{ width: 160 }} value={kind} onChange={(e) => setKind(e.target.value as any)}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
      </div>
      <Seg options={[{ id: 'edit', label: 'Write' }, { id: 'preview', label: 'Preview' }]} value={preview ? 'preview' : 'edit'} onChange={(v) => setPreview(v === 'preview')} />
      <div className="mt-s">{preview ? <div className="card flat"><Markdown text={body} /></div> : <textarea className="textarea" rows={12} value={body} onChange={(e) => setBody(e.target.value)} placeholder={'Markdown supported: **bold**, `code`, - lists, ```sql code blocks```'} style={{ fontFamily: kind === 'example' ? 'var(--mono)' : undefined }} />}</div>
      <div className="row mt-s">
        {note && note.history.length > 0 && <button className="btn sm ghost" onClick={() => setHist(!hist)}><Icon name="clock" size={14} />{note.history.length} earlier version(s)</button>}
        <span className="spacer" />
        {note && <button className="btn sm danger ghost" onClick={async () => { if (confirm('Delete this note?')) { await db.notes.delete(note.id!); onClose() } }}><Icon name="trash" size={14} />Delete</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!body.trim()}>Save</button>
      </div>
      {hist && note && <div className="col mt">{[...note.history].reverse().map((h, i) => (
        <details key={i} className="card flat tight"><summary className="small" style={{ cursor: 'pointer' }}>{new Date(h.at).toLocaleString()}</summary><Markdown text={h.body} /><button className="btn sm mt-s" onClick={() => setBody(h.body)}>Restore this version</button></details>
      ))}</div>}
    </div>
  )
}

export function NoteList({ topicId, filter }: { topicId?: string; filter?: (n: PersonalNote) => boolean }) {
  const notes = useLiveQuery(() => (topicId ? db.notes.where('topicId').equals(topicId).toArray() : db.notes.toArray()), [topicId], [])
  const [edit, setEdit] = useState<PersonalNote | 'new' | null>(null)
  const list = notes.filter(filter || (() => true)).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt)
  if (edit) return <NoteEditor note={edit === 'new' ? undefined : edit} topicId={topicId} onClose={() => setEdit(null)} />
  return (
    <div className="col">
      <div className="row"><button className="btn primary" onClick={() => setEdit('new')}><Icon name="plus" size={15} />New note</button><span className="muted small">Your notes are separate from the prepared notes, which stay protected.</span>
        <span className="spacer" />{list.length > 0 && <button className="btn sm" onClick={() => exportMyNotes(list, topicId ? `My notes — ${topicById[topicId]?.title}` : 'My notes')}><Icon name="download" size={14} />Download PDF</button>}</div>
      {list.length === 0 && <Empty title="No personal notes yet">Add explanations in your own words, examples, doubts or questions.</Empty>}
      {list.map((n) => (
        <div key={n.id} className="note-card">
          <div className="row mb-s">
            <span className={`badge ${n.kind === 'doubt' || n.kind === 'question' ? (n.resolved ? 'good' : 'warn') : 'accent'}`}>{KIND_LABEL[n.kind]}{(n.kind === 'doubt' || n.kind === 'question') && (n.resolved ? ' · resolved' : ' · open')}</span>
            <b>{n.title || 'Untitled'}</b>
            {!topicId && n.topicId && <a className="small" href={`#/topic/${n.topicId}`}>{topicById[n.topicId]?.title}</a>}
            <span className="spacer" /><span className="muted tiny">{ago(n.updatedAt)}</span>
            <button className="btn sm ghost" title="Pin" onClick={() => db.notes.update(n.id!, { pinned: !n.pinned })}><Icon name="star" size={14} stroke={n.pinned ? 3 : 1.8} /></button>
            {(n.kind === 'doubt' || n.kind === 'question') && <button className="btn sm ghost" onClick={() => db.notes.update(n.id!, { resolved: !n.resolved })}>{n.resolved ? 'Reopen' : 'Mark resolved'}</button>}
            <button className="btn sm ghost" onClick={() => setEdit(n)}><Icon name="edit" size={14} /></button>
          </div>
          <Markdown text={n.body} />
        </div>
      ))}
    </div>
  )
}
