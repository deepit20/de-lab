import { useState } from 'react'
import type { QuizQ, RecallQ } from '../types'
import { recordQuiz, recordRecall } from '../lib/record'
import { Html, Icon } from './ui'

const STOP = new Set('the and for with that this from into when what which your have will than then them they their there about would could should does each also only more most such very using used uses over under data table tables value values like just make sure can are was were been being not but all any its it is of to in on a an or as by at be'.split(' '))
const stem = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)
/** Rough key-point coverage: a point counts as covered if most of its significant words appear in the answer. */
export function keyPointCoverage(answer: string, points: string[]) {
  const words = new Set(answer.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean).map(stem))
  return points.map((p) => {
    const sig = p.split(/[^A-Za-z0-9_]+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase())).map(stem)
    if (!sig.length) return false
    const hit = sig.filter((s) => words.has(s)).length
    return hit / sig.length >= 0.5
  })
}

export function QuizBlock({ q, topicId, source = 'quiz', onAnswered }: { q: QuizQ; topicId: string; source?: 'quiz' | 'verify'; onAnswered?: (ok: boolean) => void }) {
  const [sel, setSel] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const submit = async () => {
    if (sel === null) return
    setDone(true)
    const ok = sel === q.answer
    await recordQuiz(topicId, q.id, ok, source)
    onAnswered?.(ok)
  }
  return (
    <div className="card flat">
      <div className="step-kind mb-s">Check your understanding</div>
      <div className="prose" style={{ fontWeight: 550, marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: q.q }} />
      {q.options.map((o, i) => (
        <button key={i} className={`quiz-opt ${done ? (i === q.answer ? 'right' : sel === i ? 'wrong' : '') : sel === i ? 'sel' : ''}`} onClick={() => !done && setSel(i)}>
          <span className="letter">{String.fromCharCode(65 + i)}</span><span dangerouslySetInnerHTML={{ __html: o }} />
        </button>
      ))}
      {!done ? <button className="btn primary" disabled={sel === null} onClick={submit}>Check</button> : (
        <div className={`verdict ${sel === q.answer ? 'ok' : 'no'}`}><Icon name={sel === q.answer ? 'check' : 'x'} /><div><b>{sel === q.answer ? 'Correct.' : 'Not quite.'}</b> {q.explain && <span dangerouslySetInnerHTML={{ __html: q.explain }} />}{sel !== q.answer && <div className="small dim mt-s">This question will come back in your revision queue.</div>}</div></div>
      )}
    </div>
  )
}

export function RecallBlock({ r, topicId, onScored }: { r: RecallQ; topicId: string; onScored?: (s: number) => void }) {
  const [text, setText] = useState('')
  const [shown, setShown] = useState(false)
  const [ticks, setTicks] = useState<boolean[]>([])
  const [saved, setSaved] = useState(false)
  const reveal = () => { setTicks(keyPointCoverage(text, r.keyPoints)); setShown(true) }
  const save = async () => {
    const s = r.keyPoints.length ? ticks.filter(Boolean).length / r.keyPoints.length : text.trim().length > 40 ? 0.7 : 0.3
    await recordRecall(topicId, r.id, s, 'explain')
    setSaved(true); onScored?.(s)
  }
  return (
    <div className="card flat">
      <div className="step-kind mb-s">Explain it in your own words</div>
      <div className="prose" style={{ fontWeight: 550, marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: r.q }} />
      <textarea className="textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} disabled={shown} placeholder="Answer from memory first — retrieval is what makes it stick. Short is fine." />
      {!shown ? <div className="row mt-s"><button className="btn primary" onClick={reveal} disabled={text.trim().length < 10}>Compare with key points</button><span className="muted small">Writing before looking is the point.</span></div> : (
        <div className="mt-s">
          {r.keyPoints.length > 0 && <div className="card flat tight mb-s">
            <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Key points (auto-ticked where your answer seems to cover them — adjust honestly)</div>
            {r.keyPoints.map((k, i) => <label key={i} className="row small" style={{ gap: 8, marginBottom: 4, flexWrap: 'nowrap', alignItems: 'flex-start' }}><input type="checkbox" checked={!!ticks[i]} disabled={saved} onChange={(e) => { const t = [...ticks]; t[i] = e.target.checked; setTicks(t) }} /><span>{k}</span></label>)}
          </div>}
          {r.answer && <details open={!r.keyPoints.length}><summary className="small" style={{ cursor: 'pointer' }}>Model explanation</summary><Html html={r.answer} /></details>}
          {!saved ? <button className="btn primary mt-s" onClick={save}>Save my score</button> : <div className="badge good mt-s">Saved as evidence of explanation skill</div>}
        </div>
      )}
    </div>
  )
}
