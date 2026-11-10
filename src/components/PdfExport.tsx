import { useState } from 'react'
import { db, type PersonalNote } from '../db'
import { loadTopic, topicById, trackById } from '../content'
import { exportPdf, flashcardsHtml, type PdfSection } from '../lib/pdf'
import { Icon, Modal, mdToHtml, toast } from './ui'

type Part = 'detailed' | 'crisp' | 'memory' | 'flashcards' | 'mine' | 'highlights' | 'mistakes'
const PARTS: { id: Part; label: string; hint: string }[] = [
  { id: 'detailed', label: 'Detailed notes', hint: 'full learning reference' },
  { id: 'crisp', label: 'Crisp notes', hint: 'quick revision' },
  { id: 'memory', label: 'Memory notes', hint: 'triggers & mnemonics' },
  { id: 'flashcards', label: 'Flashcards', hint: 'question / answer cards' },
  { id: 'mine', label: 'My notes', hint: 'your personal notes for the topic' },
  { id: 'highlights', label: 'My highlights', hint: 'text you highlighted' },
  { id: 'mistakes', label: 'My mistakes', hint: 'entries from the mistake journal' },
]

const tip = () => toast('In the print window choose "Save as PDF" as the printer, then Save.')

export async function topicSections(topicId: string, parts: Set<Part>, withHeadings = true): Promise<PdfSection[]> {
  const t = topicById[topicId]
  const c = await loadTopic(topicId)
  const out: PdfSection[] = []
  const add = (heading: string, html: string) => html && out.push({ heading: withHeadings ? heading : `${t.title} — ${heading}`, kicker: t.title, html })
  if (parts.has('detailed')) add('Detailed notes', c.detailed || c.outlineHtml || '')
  if (parts.has('crisp')) add('Crisp notes', c.crisp || c.outlineHtml || '')
  if (parts.has('memory')) add('Memory notes', c.memory)
  if (parts.has('flashcards') && c.flashcards.length) add('Flashcards', flashcardsHtml(c.flashcards))
  if (parts.has('mine')) {
    const notes = await db.notes.where('topicId').equals(topicId).toArray()
    if (notes.length) add('My notes', notesHtml(notes))
  }
  if (parts.has('highlights')) {
    const hl = await db.highlights.where('topicId').equals(topicId).toArray()
    if (hl.length) add('My highlights', `<ul>${hl.map((h) => `<li><mark>${escapeHtml(h.text)}</mark>${h.comment ? ` — <i>${escapeHtml(h.comment)}</i>` : ''}</li>`).join('')}</ul>`)
  }
  if (parts.has('mistakes')) {
    const ms = await db.mistakes.where('topicId').equals(topicId).toArray()
    if (ms.length) add('My mistakes', ms.map((m) => `<div class="note"><div class="meta">${escapeHtml(m.category)} · ${new Date(m.at).toLocaleDateString()}</div><b>${escapeHtml(m.title)}</b><p><b>Wrong:</b> ${escapeHtml(m.wrong)}<br><b>Correct:</b> ${escapeHtml(m.correct)}<br><b>Lesson:</b> ${escapeHtml(m.lesson)}</p></div>`).join(''))
  }
  return out
}
const escapeHtml = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const notesHtml = (notes: PersonalNote[]) => notes.sort((a, b) => b.updatedAt - a.updatedAt).map((n) =>
  `<div class="note"><div class="meta">${escapeHtml(n.kind)}${n.topicId && topicById[n.topicId] ? ' · ' + escapeHtml(topicById[n.topicId].title) : ''} · updated ${new Date(n.updatedAt).toLocaleDateString()}</div>${n.title ? `<b>${escapeHtml(n.title)}</b>` : ''}${mdToHtml(n.body)}</div>`).join('')

/** Button + dialog to export one topic's notes as PDF. */
export function TopicPdfButton({ topicId, defaultView, small = true }: { topicId: string; defaultView?: string; small?: boolean }) {
  const [open, setOpen] = useState(false)
  const [parts, setParts] = useState<Set<Part>>(new Set())
  const [busy, setBusy] = useState(false)
  const openDialog = () => { setParts(new Set([(defaultView as Part) && PARTS.some((p) => p.id === defaultView) ? (defaultView as Part) : 'detailed'])); setOpen(true) }
  const go = async () => {
    setBusy(true)
    try {
      const t = topicById[topicId]
      const sections = await topicSections(topicId, parts)
      if (!sections.length) { toast('Nothing to export for the selected parts yet.'); setBusy(false); return }
      exportPdf(`${t.title} — notes`, trackById[t.track].title, sections.map((s, i) => ({ ...s, pageBreak: i > 0 && parts.size > 2 })))
      tip(); setOpen(false)
    } catch (e: any) { toast(e.message) }
    setBusy(false)
  }
  return (
    <>
      <button className={`btn ${small ? 'sm' : ''}`} onClick={openDialog} title="Save these notes as a PDF"><Icon name="download" size={14} />Download PDF</button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <h2>Download notes as PDF</h2>
        <p className="dim small">{topicById[topicId]?.title} — choose what to include.</p>
        <div className="col" style={{ gap: 6 }}>
          {PARTS.map((p) => (
            <label key={p.id} className="row small" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <input type="checkbox" checked={parts.has(p.id)} onChange={(e) => { const n = new Set(parts); e.target.checked ? n.add(p.id) : n.delete(p.id); setParts(n) }} />
              <b>{p.label}</b><span className="muted">— {p.hint}</span>
            </label>
          ))}
        </div>
        <div className="row mt">
          <button className="btn sm ghost" onClick={() => setParts(new Set(PARTS.map((p) => p.id)))}>Select all</button>
          <span className="spacer" />
          <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn primary" disabled={!parts.size || busy} onClick={go}>{busy ? <span className="spin" /> : <Icon name="download" size={15} />}Create PDF</button>
        </div>
        <div className="muted tiny mt-s">Your browser's print window opens — pick <b>Save as PDF</b> as the printer. The file is named after the topic.</div>
      </Modal>
    </>
  )
}

/** Whole-track export: cheat sheet (crisp notes) or full notes for every topic. */
export async function exportTrack(trackId: string, mode: 'cheatsheet' | 'full') {
  const track = trackById[trackId]
  const topics = track.modules.flatMap((m) => m.topics)
  const sections: PdfSection[] = []
  for (const t of topics) {
    const c = await loadTopic(t.id)
    if (mode === 'cheatsheet') { const h = c.crisp || c.outlineHtml; if (h) sections.push({ heading: t.title, html: h }) }
    else {
      const html = [c.detailed && `<h2>Detailed notes</h2>${c.detailed}`, c.crisp && `<h2>Crisp notes</h2>${c.crisp}`, c.memory && `<h2>Memory notes</h2>${c.memory}`, c.flashcards.length ? `<h2>Flashcards</h2>${flashcardsHtml(c.flashcards)}` : '']
        .filter(Boolean).join('') || c.outlineHtml || ''
      if (html) sections.push({ heading: t.title, html, pageBreak: true })
    }
  }
  exportPdf(mode === 'cheatsheet' ? `${track.title} cheat sheet` : `${track.title} — complete notes`, `${topics.length} topics`, sections)
  tip()
}

export function exportMyNotes(notes: PersonalNote[], title = 'My notes') {
  if (!notes.length) { toast('No notes to export.'); return }
  exportPdf(title, `${notes.length} note(s)`, [{ heading: title, html: notesHtml(notes) }])
  tip()
}
