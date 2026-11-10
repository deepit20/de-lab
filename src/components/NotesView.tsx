import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Icon, toast } from './ui'

const COLORS = ['yellow', 'green', 'blue', 'pink']

/** Curated notes stay read-only; the learner's highlights and comments are stored separately and re-applied on render. */
export function HighlightableHtml({ html, topicId, view, onAddNote }: { html: string; topicId: string; view: string; onAddNote?: (quote: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pop, setPop] = useState<{ x: number; y: number; text: string } | null>(null)
  const hls = useLiveQuery(() => db.highlights.where('topicId').equals(topicId).filter((h) => h.view === view).toArray(), [topicId, view], [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = html
    for (const h of hls) wrapFirst(el, h.text, h.color, h.id!, h.comment)
  }, [html, hls])

  useEffect(() => {
    const up = () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim() || ''
      if (!sel || !text || text.length < 3 || !ref.current?.contains(sel.anchorNode)) { setPop(null); return }
      const r = sel.getRangeAt(0).getBoundingClientRect()
      const host = ref.current.getBoundingClientRect()
      setPop({ x: r.left - host.left + r.width / 2, y: r.top - host.top - 44, text: text.slice(0, 600) })
    }
    document.addEventListener('mouseup', up)
    return () => document.removeEventListener('mouseup', up)
  }, [])

  const onClick = async (e: React.MouseEvent) => {
    const m = (e.target as HTMLElement).closest('mark.hl') as HTMLElement | null
    if (!m) return
    const id = Number(m.dataset.id)
    const h = await db.highlights.get(id)
    const c = prompt(`Highlight: "${h?.text.slice(0, 80)}"\n\nAdd a comment (leave empty and press OK to keep; type DELETE to remove):`, h?.comment || '')
    if (c === null) return
    if (c.trim().toUpperCase() === 'DELETE') await db.highlights.delete(id)
    else await db.highlights.update(id, { comment: c })
  }
  const add = async (color: string) => {
    if (!pop) return
    await db.highlights.add({ topicId, view, text: pop.text, color, at: Date.now() })
    window.getSelection()?.removeAllRanges(); setPop(null)
  }
  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} className="prose" onClick={onClick} />
      {pop && (
        <div className="sel-pop no-print" style={{ left: Math.max(0, pop.x - 130), top: Math.max(0, pop.y) }} onMouseDown={(e) => e.preventDefault()}>
          {COLORS.map((c) => <button key={c} onClick={() => add(c)} title={`Highlight ${c}`}><span className={`sw`} style={{ background: c === 'yellow' ? '#facc15' : c === 'green' ? '#22c55e' : c === 'blue' ? '#3b82f6' : '#ec4899' }} /></button>)}
          {onAddNote && <button onClick={() => { onAddNote(pop.text); setPop(null) }}><Icon name="note" size={14} />Note</button>}
          <button onClick={async () => { await db.bookmarks.add({ kind: 'section', ref: `${topicId}:${view}`, label: pop.text.slice(0, 90), topicId, at: Date.now() }); toast('Bookmarked'); setPop(null) }}><Icon name="bookmark" size={14} />Bookmark</button>
        </div>
      )}
    </div>
  )
}

function wrapFirst(root: HTMLElement, text: string, color: string, id: number, comment?: string) {
  const needle = text.replace(/\s+/g, ' ').trim()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = n.nodeValue || ''
    const i = t.indexOf(needle.length > 120 ? needle.slice(0, 120) : needle)
    if (i < 0) continue
    const len = Math.min(needle.length, t.length - i)
    const range = document.createRange()
    range.setStart(n, i); range.setEnd(n, i + len)
    const mark = document.createElement('mark')
    mark.className = `hl ${color === 'yellow' ? '' : color}`
    mark.dataset.id = String(id)
    if (comment) mark.title = comment
    try { range.surroundContents(mark) } catch { /* spans elements */ }
    return
  }
}
