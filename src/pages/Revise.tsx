import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Card } from '../db'
import { loadCards, loadTopic, topicById, topicsInOrder, tracks } from '../content'
import type { Flashcard, QuizQ, RecallQ } from '../types'
import { go, useLearner, useRoute, useStudyClock } from '../lib/hooks'
import { recordQuiz, recordReview, ensureFlashcards } from '../lib/record'
import { cardRetrievability, newCard, type Rating } from '../lib/fsrs'
import { inDays, shuffle, DAY } from '../lib/util'
import { Bar, Empty, Html, Icon, Level, Loading, Markdown } from '../components/ui'

type Item =
  | { type: 'flash'; card: Card; fc: Flashcard }
  | { type: 'quiz'; card?: Card; q: QuizQ; topicId: string }
  | { type: 'recall'; card?: Card; r: RecallQ; topicId: string }
  | { type: 'mistake'; card: Card }

export default function Revise({ view }: { view?: string }) {
  if (view === 'session') return <Session />
  return <Hub />
}

function Hub() {
  const cards = useLiveQuery(() => db.cards.toArray(), [], [])
  const reviews = useLiveQuery(() => db.reviews.where('at').above(Date.now() - 30 * DAY).toArray(), [], [])
  const { comps } = useLearner()
  const [topic, setTopic] = useState('')
  const [crisp, setCrisp] = useState<{ id: string; html: string; memory: string } | null>(null)
  const now = Date.now()
  const due = cards.filter((c) => c.due <= now && !c.suspended)
  const week = [1, 2, 3, 4, 5, 6, 7].map((d) => cards.filter((c) => c.due > now + (d - 1) * DAY && c.due <= now + d * DAY).length)
  const recallRate = reviews.length ? reviews.filter((r) => r.rating >= 3).length / reviews.length : 0
  const studied = topicsInOrder.filter((t) => (comps?.[t.id]?.level ?? 0) >= 1)
  const weak = topicsInOrder.filter((t) => comps?.[t.id] && (comps[t.id].forgotten || comps[t.id].level === 2 || comps[t.id].level === 3))
  const openCrisp = async (id: string) => { const c = await loadTopic(id); setCrisp({ id, html: c.crisp || c.outlineHtml || '', memory: c.memory }) }
  const modes = [
    { k: 'due', t: 'Scheduled review', d: `${due.length} card(s) due — most at-risk first.`, i: 'repeat', off: !due.length },
    { k: 'weak', t: 'Weak areas', d: `${weak.length} topic(s) fading or only partly understood.`, i: 'alert', off: !weak.length },
    { k: 'mistakes', t: 'Mistake review', d: 'Re-test the wrong assumptions you logged.', i: 'flag', off: !cards.some((c) => c.kind === 'mistake') },
    { k: 'quiz', t: 'Quick recall test', d: '10 mixed questions from studied topics — no scheduling pressure.', i: 'brain', off: !studied.length },
  ]
  return (
    <div className="page">
      <div className="page-head"><div><h1>Revision</h1><p>Learning once is not enough. Reviews are scheduled from how you actually performed — hints, mistakes and independent answers all count.</p></div></div>
      <div className="kpis mb">
        <div className="kpi"><div className="v">{due.length}</div><div className="l">Due now</div></div>
        <div className="kpi"><div className="v">{cards.length}</div><div className="l">Cards in rotation</div></div>
        <div className="kpi"><div className="v">{reviews.length ? Math.round(recallRate * 100) + '%' : '—'}</div><div className="l">Recall rate (30 days)</div><div className="d">Target ≈ 85–92%</div></div>
        <div className="kpi"><div className="v">{week.reduce((a, b) => a + b, 0)}</div><div className="l">Coming up this week</div><div className="d">{week.join(' · ')}</div></div>
      </div>
      <div className="grid g2 mb">
        {modes.map((m) => (
          <div key={m.k} className="card" style={{ opacity: m.off ? 0.6 : 1 }}>
            <h3><Icon name={m.i} />{m.t}</h3><p className="dim small">{m.d}</p>
            <button className="btn primary" disabled={m.off} onClick={() => go(`/revise/session?mode=${m.k}`)}>Start</button>
          </div>
        ))}
      </div>
      <div className="grid g2">
        <div className="card">
          <h3><Icon name="book" />Topic-wise revision</h3>
          <p className="dim small">Pick a topic: test yourself on it, or skim its crisp notes and memory triggers.</p>
          <div className="row nowrap"><select className="select" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">Choose a topic…</option>{tracks.map((t) => <optgroup key={t.id} label={t.title}>{t.modules.flatMap((m) => m.topics).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</optgroup>)}</select></div>
          <div className="row mt-s"><button className="btn primary" disabled={!topic} onClick={() => go(`/revise/session?mode=topic&topic=${topic}`)}>Test me</button><button className="btn" disabled={!topic} onClick={() => openCrisp(topic)}>Crisp notes</button><button className="btn" disabled={!topic} onClick={() => go(`/revise/session?mode=verify&topic=${topic}`)}>Verification check</button></div>
        </div>
        <div className="card">
          <h3><Icon name="alert" />Weakest topics</h3>
          {weak.length === 0 ? <div className="muted small">Nothing flagged.</div> : <div className="list">{weak.slice(0, 6).map((t) => <div key={t.id} className="item click" onClick={() => go(`/revise/session?mode=topic&topic=${t.id}`)}><span className="small" style={{ flex: 1 }}>{t.title}</span><Level level={comps![t.id].level} /></div>)}</div>}
        </div>
      </div>
      {crisp && <div className="card mt"><div className="row mb-s"><h3 style={{ margin: 0 }}>{topicById[crisp.id].title} — crisp notes</h3><span className="spacer" /><button className="btn sm ghost" onClick={() => setCrisp(null)}><Icon name="x" size={14} /></button></div><Html html={crisp.html} />{crisp.memory && <><hr className="sep" /><div className="step-kind mb-s">Memory triggers</div><Html html={crisp.memory} /></>}</div>}
    </div>
  )
}

function Session() {
  const { query } = useRoute()
  const mode = query.get('mode') || 'due'
  const topicParam = query.get('topic') || ''
  const { comps } = useLearner()
  const [items, setItems] = useState<Item[] | null>(null)
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(false)
  const [sel, setSel] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [results, setResults] = useState<{ ok: boolean; topicId: string }[]>([])
  useStudyClock('revision', topicParam || undefined)

  useEffect(() => {
    if (!comps) return
    ;(async () => {
      const all: Record<string, { flashcards: Flashcard[]; quiz: QuizQ[]; recall: RecallQ[] }> = await loadCards()
      const cards = await db.cards.toArray()
      const now = Date.now()
      const fcOf = (c: Card): Item | null => {
        if (c.kind === 'flash') { const fc = all[c.topicId]?.flashcards.find((f) => f.id === c.id); return fc ? { type: 'flash', card: c, fc } : null }
        if (c.kind === 'quiz') { const qid = c.id.replace('quizcard:', ''); const q = all[c.topicId]?.quiz.find((x) => x.id === qid); return q ? { type: 'quiz', card: c, q, topicId: c.topicId } : null }
        if (c.kind === 'mistake') return { type: 'mistake', card: c }
        if (c.kind === 'topic') {
          const set = all[c.topicId]; if (!set) return null
          const pool: Item[] = [...set.quiz.map((q) => ({ type: 'quiz' as const, card: c, q, topicId: c.topicId })), ...set.recall.map((r) => ({ type: 'recall' as const, card: c, r, topicId: c.topicId }))]
          return pool.length ? shuffle(pool)[0] : null
        }
        return null
      }
      const topicItems = (tid: string, n: number): Item[] => {
        const set = all[tid]; if (!set) return []
        const fcs = set.flashcards.map((f) => ({ type: 'flash' as const, card: cards.find((c) => c.id === f.id) || newCard(f.id, tid, 'flash'), fc: f }))
        return shuffle<Item>([...set.quiz.map((q) => ({ type: 'quiz' as const, q, topicId: tid })), ...set.recall.slice(0, 1).map((r) => ({ type: 'recall' as const, r, topicId: tid })), ...fcs]).slice(0, n)
      }
      let list: Item[] = []
      if (mode === 'due') list = cards.filter((c) => c.due <= now && !c.suspended).sort((a, b) => cardRetrievability(a) - cardRetrievability(b)).slice(0, 25).map(fcOf).filter(Boolean) as Item[]
      else if (mode === 'mistakes') list = cards.filter((c) => c.kind === 'mistake').sort((a, b) => a.due - b.due).slice(0, 15).map(fcOf).filter(Boolean) as Item[]
      else if (mode === 'topic' || mode === 'verify') { await ensureFlashcards(topicParam); list = topicItems(topicParam, mode === 'verify' ? 6 : 10) }
      else if (mode === 'weak') { const weak = topicsInOrder.filter((t) => comps[t.id].forgotten || comps[t.id].level === 2 || comps[t.id].level === 3).slice(0, 4); list = shuffle(weak.flatMap((t) => topicItems(t.id, 4))) }
      else if (mode === 'quiz') { const st = topicsInOrder.filter((t) => comps[t.id].level >= 1); list = shuffle(st.flatMap((t) => (all[t.id]?.quiz || []).map((q) => ({ type: 'quiz' as const, q, topicId: t.id })))).slice(0, 10) }
      setItems(list)
    })()
  }, [mode, topicParam, !!comps])

  const item = items?.[i]
  const next = () => { setI(i + 1); setShown(false); setSel(null); setText('') }
  const rate = async (r: Rating) => {
    if (!item) return
    const tid = item.type === 'mistake' || item.type === 'flash' ? item.card.topicId : item.topicId
    if ('card' in item && item.card) await recordReview(item.card, r, mode)
    setResults([...results, { ok: r >= 3, topicId: tid }])
    next()
  }
  const answerQuiz = async () => {
    if (!item || item.type !== 'quiz' || sel === null) return
    const ok = sel === item.q.answer
    setShown(true)
    if (!item.card) await recordQuiz(item.topicId, item.q.id, ok, mode === 'verify' ? 'verify' : 'quiz')
  }
  const title = mode === 'verify' || mode === 'topic' ? topicById[topicParam]?.title : { due: 'Scheduled review', weak: 'Weak areas', mistakes: 'Mistake review', quiz: 'Quick recall test' }[mode]

  if (!items) return <Loading text="Preparing your session…" />
  if (!items.length) return <div className="page"><Empty title="Nothing to review here" icon="check">You're all caught up. <a href="#/revise">Back to revision</a></Empty></div>
  if (!item) {
    const score = results.length ? results.filter((r) => r.ok).length / results.length : 0
    return (
      <div className="page" style={{ maxWidth: 760 }}>
        <div className="card" style={{ textAlign: 'center', padding: 36 }}>
          <Icon name="check" size={36} /><h1 className="mt-s">Session complete</h1>
          <p className="dim">{results.length} item(s) · {Math.round(score * 100)}% recalled correctly.</p>
          {mode === 'verify' && <div className={`verdict ${score >= 0.75 ? 'ok' : 'no'} mt`} style={{ textAlign: 'left' }}><Icon name={score >= 0.75 ? 'check' : 'alert'} /><div>{score >= 0.75 ? <><b>Prior knowledge confirmed.</b> This topic now counts as studied with evidence. Prove it fully with a hint-free exercise.</> : <><b>Some gaps showed up.</b> Worth going through the lesson — you can move quickly through the parts you know.</>}</div></div>}
          <div className="row mt" style={{ justifyContent: 'center' }}>
            <a className="btn" href="#/revise">Revision home</a>
            {mode === 'verify' || mode === 'topic' ? <a className="btn primary" href={`#/topic/${topicParam}${score >= 0.75 ? '/practice' : ''}`}>{score >= 0.75 ? 'Go to practice' : 'Open the lesson'}</a> : <a className="btn primary" href="#/">Back to today</a>}
          </div>
        </div>
      </div>
    )
  }
  const tid = item.type === 'mistake' || item.type === 'flash' ? item.card.topicId : item.topicId
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="row mb"><a className="btn ghost sm" href="#/revise"><Icon name="back" size={14} />Exit</a><b>{title}</b><span className="spacer" /><span className="muted small">{i + 1} / {items.length}</span></div>
      <Bar value={i / items.length} />
      <div className="card mt">
        <div className="row mb-s"><span className="badge">{topicById[tid]?.title || 'General'}</span><span className="badge outline">{item.type === 'flash' ? 'Flashcard' : item.type === 'quiz' ? 'Question' : item.type === 'recall' ? 'Explain' : 'Mistake'}</span>{'card' in item && item.card && item.card.reps > 0 && <span className="muted tiny">reviewed {item.card.reps}× · next {inDays(item.card.due)}</span>}</div>
        {item.type === 'flash' && <>
          <div className="flash"><div dangerouslySetInnerHTML={{ __html: item.fc.q }} />{shown && <div className="ans" dangerouslySetInnerHTML={{ __html: item.fc.a }} />}</div>
          {!shown ? <div className="row" style={{ justifyContent: 'center' }}><button className="btn primary lg" onClick={() => setShown(true)}>Show answer <kbd>space</kbd></button></div> : <RateButtons onRate={rate} />}
        </>}
        {item.type === 'mistake' && <>
          <div className="flash"><div><div className="muted small mb-s">Your past mistake — what is the correct understanding?</div>{item.card.front}</div>{shown && <div className="ans" style={{ textAlign: 'left' }}><Markdown text={item.card.back || ''} /></div>}</div>
          {!shown ? <div className="row" style={{ justifyContent: 'center' }}><button className="btn primary lg" onClick={() => setShown(true)}>Show</button></div> : <RateButtons onRate={rate} />}
        </>}
        {item.type === 'quiz' && <>
          <div className="prose" style={{ fontWeight: 550, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: item.q.q }} />
          {item.q.options.map((o, k) => <button key={k} className={`quiz-opt ${shown ? (k === item.q.answer ? 'right' : sel === k ? 'wrong' : '') : sel === k ? 'sel' : ''}`} onClick={() => !shown && setSel(k)}><span className="letter">{String.fromCharCode(65 + k)}</span><span dangerouslySetInnerHTML={{ __html: o }} /></button>)}
          {!shown ? <button className="btn primary" disabled={sel === null} onClick={answerQuiz}>Check</button> : <>
            {item.q.explain && <div className="hint mb-s" dangerouslySetInnerHTML={{ __html: item.q.explain }} />}
            {item.card ? <RateButtons onRate={rate} suggested={sel === item.q.answer ? 3 : 1} /> : <button className="btn primary" onClick={() => { setResults([...results, { ok: sel === item.q.answer, topicId: tid }]); next() }}>Next</button>}
          </>}
        </>}
        {item.type === 'recall' && <>
          <div className="prose" style={{ fontWeight: 550, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: item.r.q }} />
          <textarea className="textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} disabled={shown} placeholder="Answer from memory…" />
          {!shown ? <button className="btn primary mt-s" onClick={() => setShown(true)}>Reveal</button> : <>
            <div className="card flat tight mt-s small"><b>Key points:</b><ul>{item.r.keyPoints.map((k, n) => <li key={n}>{k}</li>)}</ul></div>
            {item.card ? <div className="mt-s"><RateButtons onRate={rate} /></div> : <div className="row mt-s"><button className="btn" onClick={() => { setResults([...results, { ok: false, topicId: tid }]); next() }}>Missed key points</button><button className="btn primary" onClick={() => { setResults([...results, { ok: true, topicId: tid }]); next() }}>Covered them</button></div>}
          </>}
        </>}
      </div>
      <KeyNav onSpace={() => !shown && (item.type === 'flash' || item.type === 'mistake') && setShown(true)} onRate={(r) => shown && 'card' in item && item.card && item.type !== 'quiz' && rate(r)} />
    </div>
  )
}

function RateButtons({ onRate, suggested }: { onRate: (r: Rating) => void; suggested?: number }) {
  return (
    <div>
      <div className="muted small mb-s" style={{ textAlign: 'center' }}>How well did you recall it? (keys 1–4)</div>
      <div className="rate-btns">
        {([[1, 'Forgot', 'see again soon'], [2, 'Hard', 'needed effort'], [3, 'Good', 'recalled'], [4, 'Easy', 'instant']] as const).map(([r, l, d]) => (
          <button key={r} className={`r${r}`} style={suggested === r ? { borderColor: 'var(--accent)' } : undefined} onClick={() => onRate(r as Rating)}>{l}<small>{d}</small></button>
        ))}
      </div>
    </div>
  )
}
function KeyNav({ onSpace, onRate }: { onSpace: () => void; onRate: (r: Rating) => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key === ' ') { e.preventDefault(); onSpace() }
      if (['1', '2', '3', '4'].includes(e.key)) onRate(Number(e.key) as Rating)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  return null
}
