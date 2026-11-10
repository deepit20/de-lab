import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type InterviewItem, type InterviewSession } from '../db'
import { loadBank, loadProjects, loadSkills, topicById, tracks, trackById } from '../content'
import type { BankQ, Exercise as Ex } from '../types'
import { go, useExercises, useLearner, useRoute, useStudyClock } from '../lib/hooks'
import { aiEnabled, analyzeJD, evaluateAnswer, nextFollowUp, type JDResult } from '../lib/ai'
import { analyzeText } from '../lib/comm'
import { keyPointCoverage } from '../components/Checks'
import { recordRecall } from '../lib/record'
import { ago, shuffle, DAY } from '../lib/util'
import { LEVELS } from '../lib/competency'
import Exercise from '../components/Exercise'
import { Bar, Empty, Html, Icon, Level, Loading, Seg, toast } from '../components/ui'

export default function Interview({ view, id }: { view?: string; id?: string }) {
  useStudyClock('interview')
  if (view === 'bank') return <Bank />
  if (view === 'mock') return <MockSetup />
  if (view === 'session' && id) return <SessionRun id={Number(id)} />
  if (view === 'jd') return <JDPrep />
  if (view === 'history') return <History />
  return <Hub />
}

function Hub() {
  const sessions = useLiveQuery(() => db.interviews.orderBy('at').reverse().toArray(), [], [])
  const done = sessions.filter((s) => s.status === 'done' && s.overall != null)
  const cards = [
    { to: '/interview/bank', i: 'list', t: 'Question bank', d: 'Concept, scenario, coding and behavioural questions across every track, with key points and model answers.' },
    { to: '/interview/mock?kind=mock', i: 'mic', t: 'Mock interview', d: 'Guided (hints allowed) or realistic (no hints, timed, follow-up questions). 15 to 60 minutes.' },
    { to: '/interview/mock?kind=timed', i: 'clock', t: 'Timed coding round', d: 'SQL and Python problems under time pressure — no hints, judged on correctness.' },
    { to: '/interview/mock?kind=scenario', i: 'alert', t: 'Scenario round', d: 'Pipeline failures, duplicates, schema changes, late data, slow queries, recovery.' },
    { to: '/interview/mock?kind=defence', i: 'rocket', t: 'Project defence', d: 'Explain architecture, decisions and trade-offs of a project you built.' },
    { to: '/interview/jd', i: 'target', t: 'Job description prep', d: 'Paste a JD: required vs preferred skills, your matches and gaps, and a prep plan.' },
  ]
  return (
    <div className="page">
      <div className="page-head"><div><h1>Interview preparation</h1><p>Practise answering, coding and explaining under realistic conditions. Every attempt is saved so you can see improvement.</p></div><a className="btn" href="#/interview/history"><Icon name="chart" size={15} />History ({done.length})</a></div>
      {done.length > 0 && <div className="kpis mb">
        <div className="kpi"><div className="v">{done.length}</div><div className="l">Rounds completed</div></div>
        <div className="kpi"><div className="v">{Math.round(done.slice(0, 5).reduce((s, x) => s + (x.overall || 0), 0) / Math.min(5, done.length))}</div><div className="l">Avg score (last 5)</div></div>
        <div className="kpi"><div className="v">{done.filter((x) => x.at > Date.now() - 7 * DAY).length}</div><div className="l">This week</div></div>
      </div>}
      <div className="grid g3">{cards.map((c) => <div key={c.to} className="card" style={{ cursor: 'pointer' }} onClick={() => go(c.to)}><h3><Icon name={c.i} />{c.t}</h3><p className="dim small" style={{ margin: 0 }}>{c.d}</p></div>)}</div>
    </div>
  )
}

function scoreAnswer(q: { keyPoints: string[] }, answer: string) {
  const cov = keyPointCoverage(answer, q.keyPoints)
  const coverage = q.keyPoints.length ? cov.filter(Boolean).length / q.keyPoints.length : answer.trim().length > 60 ? 0.6 : 0.2
  const m = analyzeText(answer)
  const communication = m.score / 100
  const depth = Math.min(1, m.words / 120) * 0.6 + (m.tradeoffs ? 0.2 : 0) + (m.examples ? 0.2 : 0)
  const overall = Math.round((coverage * 0.6 + depth * 0.2 + communication * 0.2) * 100)
  return { coverage, cov, communication, depth, overall, metrics: m }
}

function Bank() {
  const { query } = useRoute()
  const [bank, setBank] = useState<BankQ[] | null>(null)
  const [track, setTrack] = useState('all')
  const [type, setType] = useState('all')
  const [q, setQ] = useState(query.get('q') || '')
  const [open, setOpen] = useState<string | null>(query.get('q'))
  useEffect(() => { loadBank().then(setBank) }, [])
  if (!bank) return <Loading />
  const types = [...new Set(bank.map((b) => b.type))]
  const list = bank.filter((b) => (track === 'all' || b.track === track) && (type === 'all' || b.type === type) && (!q || b.q.toLowerCase().includes(q.toLowerCase()) || b.id === q))
  return (
    <div className="page">
      <div className="crumbs"><a href="#/interview">Interview</a> / Question bank</div>
      <div className="page-head"><div><h1>Question bank</h1><p>{bank.length} questions. Answer before you look — the key points are how a strong answer is judged.</p></div></div>
      <div className="row mb">
        <select className="select" style={{ width: 170 }} value={track} onChange={(e) => setTrack(e.target.value)}><option value="all">All tracks</option>{tracks.map((t) => <option key={t.id} value={t.id}>{t.short}</option>)}</select>
        <select className="select" style={{ width: 150 }} value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small">{list.length} shown</span>
      </div>
      <div className="col">{list.map((b) => open === b.id ? <AnswerCard key={b.id} q={b} onClose={() => setOpen(null)} /> : (
        <div key={b.id} className="card tight row nowrap" style={{ cursor: 'pointer' }} onClick={() => setOpen(b.id)}>
          <span className="dot" style={{ background: trackById[b.track]?.color || 'var(--text3)' }} /><span style={{ flex: 1 }}>{b.q}</span><span className="badge outline">{b.type}</span><span className="badge">{'●'.repeat(b.level)}</span>
        </div>
      ))}</div>
    </div>
  )
}

function AnswerCard({ q, onClose }: { q: BankQ; onClose: () => void }) {
  const [text, setText] = useState('')
  const [shown, setShown] = useState(false)
  const [ai, setAi] = useState<any>(null)
  const [hasAI, setHasAI] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { aiEnabled().then(setHasAI) }, [])
  const s = useMemo(() => scoreAnswer(q, text), [shown])
  const reveal = async () => {
    setShown(true)
    const sc = scoreAnswer(q, text)
    await db.interviews.add({ kind: 'quick', mode: 'guided', title: q.q.slice(0, 80), tracks: [q.track], durationMin: 0, items: [{ qid: q.id, q: q.q, answer: text, sec: 0, score: sc.overall, keyHit: q.keyPoints.filter((_, i) => sc.cov[i]) }], overall: sc.overall, breakdown: { coverage: Math.round(sc.coverage * 100), communication: Math.round(sc.communication * 100) }, at: Date.now(), ai: false, status: 'done' })
    if (q.topic) await recordRecall(q.topic, q.id, sc.coverage, 'interview', 'interview')
  }
  const runAI = async () => { setBusy(true); try { setAi(await evaluateAnswer(q, text)) } catch (e: any) { toast(e.message) } setBusy(false) }
  return (
    <div className="card">
      <div className="row mb-s"><span className="badge">{trackById[q.track]?.short || 'General'}</span><span className="badge outline">{q.type}</span><span className="spacer" /><button className="btn sm ghost" onClick={onClose}><Icon name="x" size={14} /></button></div>
      <h3>{q.q}</h3>
      {q.context && <Html html={q.context} />}
      <textarea className="textarea" rows={7} value={text} onChange={(e) => setText(e.target.value)} disabled={shown} placeholder="Structure: one-line answer → explanation → example → trade-off." />
      {!shown ? <div className="row mt-s"><button className="btn primary" disabled={text.trim().length < 15} onClick={reveal}>Evaluate my answer</button><span className="muted small">{text.trim().split(/\s+/).filter(Boolean).length} words</span></div> : (
        <div className="mt">
          <div className="row mb-s"><b style={{ fontSize: 20 }}>{s.overall}/100</b><span className="muted small">Key-point coverage {Math.round(s.coverage * 100)}% · communication {Math.round(s.communication * 100)}% (offline estimate)</span>
            <span className="spacer" />{hasAI && !ai && <button className="btn" onClick={runAI} disabled={busy}>{busy ? <span className="spin" /> : <Icon name="sparkles" size={15} />}Detailed AI feedback</button>}</div>
          <div className="grid g2">
            <div className="card flat tight"><div className="step-kind mb-s">Key points</div>{q.keyPoints.map((k, i) => <div key={i} className="small" style={{ color: s.cov[i] ? 'var(--good)' : 'var(--text2)' }}>{s.cov[i] ? '✔' : '○'} {k}</div>)}</div>
            <div className="card flat tight"><div className="step-kind mb-s">Communication</div>{s.metrics.tips.length ? s.metrics.tips.map((t, i) => <div key={i} className="small mb-s">• {t}</div>) : <div className="small">Clear and well structured.</div>}</div>
          </div>
          {ai && <AIEval e={ai} />}
          {q.answer && <details className="mt-s"><summary style={{ cursor: 'pointer' }} className="small">Model answer</summary><Html html={q.answer} /></details>}
          {q.followUps.length > 0 && <div className="small dim mt-s"><b>Likely follow-ups:</b> {q.followUps.join(' · ')}</div>}
        </div>
      )}
    </div>
  )
}

function AIEval({ e }: { e: any }) {
  return (
    <div className="card flat mt-s">
      <div className="row mb-s"><Icon name="sparkles" /><b>AI interviewer feedback · {e.overall}/100</b></div>
      <div className="dimbars mb-s">{Object.entries(e.scores).map(([k, v]: any) => <div key={k} className="dimbar"><span style={{ textTransform: 'capitalize' }}>{k}</span><Bar value={v / 10} /><span className="muted tiny">{v}/10</span></div>)}</div>
      <div className="grid g2"><div><b className="small">Strengths</b><ul className="small">{e.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div><div><b className="small">Gaps</b><ul className="small">{e.gaps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div></div>
      <div className="small"><b>A stronger answer:</b> {e.better}</div>
      {e.followUp && <div className="small mt-s"><b>Follow-up to prepare:</b> {e.followUp}</div>}
    </div>
  )
}

function MockSetup() {
  const { query } = useRoute()
  const exercises = useExercises()
  const { comps } = useLearner()
  const [kind, setKind] = useState<'mock' | 'timed' | 'scenario' | 'defence'>((query.get('kind') as any) || (query.get('defence') ? 'defence' : 'mock'))
  const [mode, setMode] = useState<'guided' | 'realistic'>('realistic')
  const [dur, setDur] = useState(query.get('quick') ? 15 : 30)
  const [sel, setSel] = useState<string[]>(query.get('topic') ? [topicById[query.get('topic')!]?.track] : ['sql', 'py', 'def'])
  const [project, setProject] = useState(query.get('defence') || '')
  const [projects, setProjects] = useState<any[]>([])
  const [hasAI, setHasAI] = useState(false)
  useEffect(() => { loadProjects().then(setProjects); aiEnabled().then(setHasAI) }, [])
  const start = async () => {
    const bank = await loadBank()
    const topic = query.get('topic')
    const per = kind === 'timed' ? 12 : 6
    const n = Math.max(2, Math.round(dur / per))
    let items: InterviewItem[] = []
    if (kind === 'timed') {
      const pool = Object.values(exercises || {}).filter((e) => (e.lang === 'sql' || e.lang === 'python') && sel.includes(e.track) && e.difficulty >= 2)
      items = shuffle(pool).slice(0, n).map((e) => ({ qid: 'ex:' + e.id, q: e.title, answer: '', sec: 0 }))
    } else if (kind === 'defence') {
      const p = projects.find((x) => x.id === project)
      const qs: string[] = p?.defence?.length ? p.defence : ['Walk me through the architecture of your project.', 'What was the hardest technical decision and why?', 'How do you guarantee data quality?', 'What happens if the pipeline fails halfway?', 'How would it scale to 100x the data?', 'What would you do differently?']
      items = qs.slice(0, n + 1).map((q) => ({ q, answer: '', sec: 0 }))
    } else {
      let pool = bank.filter((b) => (topic ? b.topic === topic : sel.includes(b.track) || (b.track === 'int' && kind === 'mock')))
      if (kind === 'scenario') pool = bank.filter((b) => b.type === 'scenario' || b.type === 'design')
      // prefer questions on topics already studied; never only ones answered recently
      const recent = new Set((await db.interviews.where('at').above(Date.now() - 5 * DAY).toArray()).flatMap((s) => s.items.map((i) => i.qid)))
      pool = shuffle(pool).sort((a, b) => Number(recent.has(a.id)) - Number(recent.has(b.id)) || ((comps?.[b.topic || '']?.level ?? 0) - (comps?.[a.topic || '']?.level ?? 0)) * 0.3)
      items = pool.slice(0, n).map((b) => ({ qid: b.id, q: b.q, answer: '', sec: 0 }))
    }
    if (!items.length) { toast('No questions available for that selection yet.'); return }
    const id = await db.interviews.add({ kind, mode, title: kind === 'defence' ? `Defence: ${projects.find((x) => x.id === project)?.title || 'my project'}` : `${kind === 'timed' ? 'Timed coding' : kind === 'scenario' ? 'Scenario round' : 'Mock interview'} · ${sel.map((s) => trackById[s]?.short).join(', ')}`, tracks: sel, durationMin: dur, items, at: Date.now(), ai: hasAI && mode === 'realistic', status: 'active' })
    go(`/interview/session/${id}`)
  }
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="crumbs"><a href="#/interview">Interview</a> / New round</div>
      <h1>Set up a round</h1>
      <div className="card col" style={{ gap: 16 }}>
        <label className="field">Round type<Seg value={kind} onChange={setKind} options={[{ id: 'mock', label: 'Mock interview' }, { id: 'timed', label: 'Timed coding' }, { id: 'scenario', label: 'Scenarios' }, { id: 'defence', label: 'Project defence' }]} /></label>
        <label className="field">Mode<Seg value={mode} onChange={setMode} options={[{ id: 'guided', label: 'Guided — hints & key points available' }, { id: 'realistic', label: 'Realistic — no hints' + (hasAI ? ', AI follow-ups' : '') }]} /></label>
        <label className="field">Duration<Seg value={String(dur)} onChange={(v) => setDur(Number(v))} options={[15, 30, 45, 60].map((d) => ({ id: String(d), label: `${d} min` }))} /></label>
        {kind === 'defence' ? (
          <label className="field">Project<select className="select" value={project} onChange={(e) => setProject(e.target.value)}><option value="">My own project (generic questions)</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        ) : kind !== 'scenario' && (
          <div className="field">Tracks<div className="row" style={{ gap: 6 }}>{tracks.filter((t) => t.id !== 'proj').map((t) => <button key={t.id} className={`btn sm ${sel.includes(t.id) ? 'primary' : ''}`} onClick={() => setSel(sel.includes(t.id) ? sel.filter((x) => x !== t.id) : [...sel, t.id])}>{t.short}</button>)}</div></div>
        )}
        {mode === 'realistic' && !hasAI && <div className="banner info small"><Icon name="sparkles" />Add an API key in Settings to get adaptive follow-up questions and detailed AI evaluation. Without it, answers are scored on key-point coverage and communication.</div>}
        <div className="row"><span className="spacer" /><button className="btn primary lg" onClick={start} disabled={!exercises || (!sel.length && kind !== 'defence' && kind !== 'scenario')}><Icon name="play" size={15} />Start</button></div>
      </div>
    </div>
  )
}

function SessionRun({ id }: { id: number }) {
  const s = useLiveQuery(() => db.interviews.get(id), [id])
  const exercises = useExercises()
  const [bank, setBank] = useState<BankQ[]>([])
  const [i, setI] = useState(0)
  const [text, setText] = useState('')
  const [follow, setFollow] = useState<{ q: string; answer: string }[]>([])
  const [pendingFollow, setPendingFollow] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [evaluating, setEvaluating] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const qStart = useRef(Date.now())
  // drafts survive reloads/closed windows so a round can be paused and resumed
  const draftKey = `iv:${id}:${i}`
  useEffect(() => { try { setText(localStorage.getItem(draftKey) || '') } catch { /* ignore */ } }, [draftKey])
  useEffect(() => { try { text ? localStorage.setItem(draftKey, text) : localStorage.removeItem(draftKey) } catch { /* ignore */ } }, [text, draftKey])
  useEffect(() => { if (s && s.status === 'active') { const firstOpen = s.items.findIndex((it) => !it.answer); if (firstOpen > 0 && i === 0) setI(firstOpen) } }, [s?.id])
  useEffect(() => { loadBank().then(setBank) }, [])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  if (!s || !exercises) return <Loading />
  if (s.status === 'done') return <Result s={s} />
  const item = s.items[i]
  const left = Math.max(0, s.at + s.durationMin * 60000 - now)
  const bq = bank.find((b) => b.id === item?.qid)
  const exId = item?.qid?.startsWith('ex:') ? item.qid.slice(3) : null
  const ex: Ex | null = exId ? exercises[exId] : null
  const saveItem = async (patch: Partial<InterviewItem>) => { const items = [...s.items]; items[i] = { ...items[i], ...patch }; await db.interviews.put({ ...s, items }); return items }
  const submit = async () => {
    if (s.ai && !ex && follow.length < 1 && !pendingFollow && text.trim().length > 20) {
      try { const f = await nextFollowUp(item.q, [{ q: item.q, answer: text }]); setPendingFollow(f); return } catch { /* continue without */ }
    }
    await advance()
  }
  const answerFollow = async (a: string) => { setFollow([...follow, { q: pendingFollow!, answer: a }]); setPendingFollow(null) }
  const advance = async () => {
    const items = await saveItem({ answer: text, sec: Math.round((Date.now() - qStart.current) / 1000), followups: follow })
    setText(''); setFollow([]); setShowKeys(false); qStart.current = Date.now()
    if (i + 1 < s.items.length && left > 0) setI(i + 1)
    else await finish(items)
  }
  const finish = async (items = s.items) => {
    setEvaluating(true)
    const bmap = Object.fromEntries(bank.map((b) => [b.id, b]))
    const scored: InterviewItem[] = []
    const atts = await db.attempts.where('mode').equals('timed').toArray()
    for (const it of items) {
      if (it.qid?.startsWith('ex:')) { const a = atts.filter((x) => x.exerciseId === it.qid!.slice(3) && x.at >= s.at); const best = a.some((x) => x.passed) ? 100 : a.length ? 25 : 0; scored.push({ ...it, score: best }); continue }
      const q = bmap[it.qid || ''] || { keyPoints: [], q: it.q }
      const sc = scoreAnswer(q, it.answer + ' ' + (it.followups || []).map((f) => f.answer).join(' '))
      let res: InterviewItem = { ...it, score: sc.overall, scores: { correctness: Math.round(sc.coverage * 10), depth: Math.round(sc.depth * 10), communication: Math.round(sc.communication * 10) }, keyHit: (q.keyPoints || []).filter((_: any, k: number) => sc.cov[k]) }
      if (s.ai && it.answer.trim()) { try { const e = await evaluateAnswer(q as any, it.answer, it.followups); res = { ...res, score: e.overall, scores: e.scores, feedback: `**Strengths:** ${e.strengths.join('; ')}\n\n**Gaps:** ${e.gaps.join('; ')}\n\n**Stronger answer:** ${e.better}` } } catch { /* offline score stays */ } }
      if ((q as BankQ).topic) await recordRecall((q as BankQ).topic!, (q as BankQ).id, (res.score || 0) / 100, 'interview', 'interview')
      scored.push(res)
    }
    const overall = Math.round(scored.reduce((a, x) => a + (x.score || 0), 0) / Math.max(1, scored.length))
    const dims: Record<string, number[]> = {}
    for (const x of scored) for (const [k, v] of Object.entries(x.scores || {})) (dims[k] ||= []).push(v * 10)
    const breakdown = Object.fromEntries(Object.entries(dims).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]))
    await db.interviews.put({ ...s, items: scored, overall, breakdown, status: 'done' })
    setEvaluating(false)
  }
  async function endNow() {
    // keep whatever is typed for the current question; unanswered questions stay empty
    const items = text.trim() ? await saveItem({ answer: text, sec: Math.round((Date.now() - qStart.current) / 1000), followups: follow }) : s!.items
    await finish(items.filter((it, k) => k <= i || it.answer))
  }
  if (evaluating) return <Loading text="Evaluating your answers…" />
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000)
  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="row mb"><b>{s.title}</b><span className="badge">{s.mode}</span><span className="spacer" /><span className="muted small">Question {i + 1}/{s.items.length}</span><span className={`timer ${left < 120000 ? 'low' : ''}`}>{mm}:{String(ss).padStart(2, '0')}</span>
        {confirmEnd ? <><span className="small">End now?</span><button className="btn sm danger" onClick={endNow}>Yes, get feedback</button><button className="btn sm ghost" onClick={() => setConfirmEnd(false)}>Continue</button></> : <button className="btn sm" onClick={() => setConfirmEnd(true)}>End</button>}</div>
      <Bar value={i / s.items.length} />
      {left === 0 && <div className="banner mt">Time is up — submit this answer to finish.</div>}
      <div className="mt">
        {ex ? <><Exercise key={ex.id} ex={ex} mode={s.mode === 'guided' ? 'practice' : 'timed'} /><div className="row mt"><span className="spacer" /><button className="btn primary" onClick={advance}>Next question<Icon name="arrow" size={15} /></button></div></> : (
          <div className="card">
            <div className="step-kind mb-s">{bq?.type || 'question'}</div>
            <h2>{item.q}</h2>
            {bq?.context && <Html html={bq.context} />}
            {follow.map((f, k) => <div key={k} className="card flat tight mb-s small"><b>Follow-up:</b> {f.q}<div className="dim mt-s">{f.answer}</div></div>)}
            {pendingFollow ? <FollowUp q={pendingFollow} onAnswer={answerFollow} /> : <>
              <textarea className="textarea" rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="Answer as you would speak it. Structure: answer → explain → example → trade-off." autoFocus />
              <div className="row mt-s">
                {s.mode === 'guided' && bq && <button className="btn ghost" onClick={() => setShowKeys(!showKeys)}><Icon name="bulb" size={15} />{showKeys ? 'Hide' : 'Show'} key points</button>}
                <span className="muted small">{text.trim().split(/\s+/).filter(Boolean).length} words</span><span className="spacer" />
                <button className="btn primary" onClick={follow.length || !s.ai ? advance : submit}>{i + 1 < s.items.length ? 'Submit & next' : 'Submit & finish'}<Icon name="arrow" size={15} /></button>
              </div>
              {showKeys && bq && <div className="hint mt-s"><ul style={{ margin: 0 }}>{bq.keyPoints.map((k, n) => <li key={n}>{k}</li>)}</ul></div>}
            </>}
          </div>
        )}
      </div>
    </div>
  )
}
function FollowUp({ q, onAnswer }: { q: string; onAnswer: (a: string) => void }) {
  const [a, setA] = useState('')
  return <div className="card flat"><div className="step-kind mb-s">Interviewer follow-up</div><b>{q}</b><textarea className="textarea mt-s" rows={5} value={a} onChange={(e) => setA(e.target.value)} autoFocus /><div className="row mt-s"><span className="spacer" /><button className="btn primary" onClick={() => onAnswer(a)} disabled={!a.trim()}>Answer</button></div></div>
}

function Result({ s }: { s: InterviewSession }) {
  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="crumbs"><a href="#/interview">Interview</a> / <a href="#/interview/history">History</a></div>
      <div className="page-head"><div><h1>{s.title}</h1><p>{new Date(s.at).toLocaleString()} · {s.mode} · {s.items.length} questions{s.ai ? ' · AI-evaluated' : ' · offline evaluation'}</p></div><div className="card tight" style={{ textAlign: 'center', minWidth: 140 }}><div className="muted small">Overall</div><b style={{ fontSize: 30 }}>{s.overall}</b><div className="muted tiny">/ 100</div></div></div>
      {s.breakdown && Object.keys(s.breakdown).length > 0 && <div className="card mb"><div className="dimbars">{Object.entries(s.breakdown).map(([k, v]) => <div key={k} className="dimbar"><span style={{ textTransform: 'capitalize' }}>{k}</span><Bar value={v / 100} /><span className="muted tiny">{v}</span></div>)}</div></div>}
      <div className="col">{s.items.map((it, k) => (
        <div key={k} className="card">
          <div className="row mb-s"><b style={{ flex: 1 }}>{k + 1}. {it.q}</b><span className={`badge ${(it.score || 0) >= 70 ? 'good' : (it.score || 0) >= 45 ? 'warn' : 'bad'}`}>{it.score ?? '—'}</span></div>
          {it.answer && <div className="small dim" style={{ whiteSpace: 'pre-wrap' }}>{it.answer}</div>}
          {it.followups?.map((f, n) => <div key={n} className="small mt-s"><b>Follow-up:</b> {f.q}<div className="dim">{f.answer}</div></div>)}
          {it.keyHit && <div className="tiny muted mt-s">Key points covered: {it.keyHit.length ? it.keyHit.join(' · ') : 'none detected'}</div>}
          {it.feedback && <div className="card flat tight mt-s small" style={{ whiteSpace: 'pre-wrap' }}>{it.feedback.replace(/\*\*/g, '')}</div>}
        </div>
      ))}</div>
      <div className="row mt"><a className="btn" href="#/interview">Back</a><a className="btn primary" href="#/interview/mock">Another round</a></div>
    </div>
  )
}

function History() {
  const sessions = useLiveQuery(() => db.interviews.orderBy('at').reverse().toArray(), [], [])
  const done = sessions.filter((s) => s.status === 'done')
  return (
    <div className="page">
      <div className="crumbs"><a href="#/interview">Interview</a> / History</div>
      <h1>Interview history</h1>
      {done.length === 0 ? <Empty title="No completed rounds yet" /> : <div className="card"><div className="list">{done.map((s) => (
        <div key={s.id} className="item click" onClick={() => go(`/interview/session/${s.id}`)}>
          <span className="badge">{s.kind}</span><div style={{ flex: 1, minWidth: 0 }}><div className="small" style={{ fontWeight: 600 }}>{s.title}</div><div className="muted tiny">{ago(s.at)} · {s.items.length} question(s) · {s.mode}</div></div>
          <div style={{ width: 120 }}><Bar value={(s.overall || 0) / 100} color={(s.overall || 0) >= 70 ? 'var(--good)' : 'var(--warn)'} /></div><b style={{ width: 36, textAlign: 'right' }}>{s.overall}</b>
          <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this record?')) db.interviews.delete(s.id!) }}><Icon name="trash" size={13} /></button>
        </div>))}</div></div>}
    </div>
  )
}

interface Skill { id: string; label: string; track: string; topics: string[]; keywords: string[] }
function JDPrep() {
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [skills, setSkills] = useState<Skill[]>([])
  const [local, setLocal] = useState<any>(null)
  const [ai, setAi] = useState<JDResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [hasAI, setHasAI] = useState(false)
  const [bank, setBank] = useState<BankQ[]>([])
  const { comps } = useLearner()
  const saved = useLiveQuery(() => db.jds.orderBy('at').reverse().toArray(), [], [])
  useEffect(() => { loadSkills().then((s) => setSkills(s.skills || [])); aiEnabled().then(setHasAI); loadBank().then(setBank) }, [])
  const analyse = async () => {
    const lower = text.toLowerCase()
    const prefIdx = lower.search(/preferred|nice to have|nice-to-have|bonus|good to have|plus:|desirable/)
    const found = skills.map((s) => {
      const hits = s.keywords.map((k) => ({ k, i: lower.indexOf(k.toLowerCase()) })).filter((h) => h.i >= 0)
      if (!hits.length) return null
      const first = Math.min(...hits.map((h) => h.i))
      const must = prefIdx < 0 || first < prefIdx
      const lv = s.topics.map((t) => comps?.[t]?.level ?? 0)
      const level = lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : 0
      return { ...s, must, matched: hits.map((h) => h.k), level }
    }).filter(Boolean) as (Skill & { must: boolean; matched: string[]; level: number })[]
    const years = text.match(/(\d+)\+?\s*(?:-\s*\d+\s*)?years?/i)?.[0]
    const priorities = [...found].sort((a, b) => Number(b.must) - Number(a.must) || a.level - b.level)
    const readiness = found.length ? Math.round((found.reduce((a, s) => a + Math.min(1, s.level / 4) * (s.must ? 2 : 1), 0) / found.reduce((a, s) => a + (s.must ? 2 : 1), 0)) * 100) : 0
    const res = { found, years, priorities: priorities.slice(0, 8).map((p) => p.id), readiness }
    setLocal(res); setAi(null)
    await db.jds.add({ title: title || 'Untitled role', text, result: res, at: Date.now(), ai: false })
  }
  const runAI = async () => {
    setBusy(true)
    try {
      const summary = Object.values(comps || {}).filter((c) => c.level > 0).map((c) => `${topicById[c.topicId]?.title}: ${LEVELS[c.level]}`).join('\n') || 'No measured competency yet.'
      setAi(await analyzeJD(text, summary))
    } catch (e: any) { toast(e.message) }
    setBusy(false)
  }
  const qs = local ? bank.filter((b) => local.found.some((f: Skill) => f.topics.includes(b.topic || '') || f.track === b.track)).slice(0, 10) : []
  return (
    <div className="page">
      <div className="crumbs"><a href="#/interview">Interview</a> / Job description</div>
      <div className="page-head"><div><h1>Job description preparation</h1><p>Paste a JD to see required skills, how your measured competency matches, and what to prepare first.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', alignItems: 'start' }}>
        <div className="card col">
          <input className="input" placeholder="Role / company (for your records)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="textarea" rows={16} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full job description here…" />
          <div className="row"><button className="btn primary" disabled={text.length < 80} onClick={analyse}><Icon name="target" size={15} />Analyse</button>{hasAI && local && <button className="btn" disabled={busy} onClick={runAI}>{busy ? <span className="spin" /> : <Icon name="sparkles" size={15} />}Deeper AI analysis</button>}</div>
          {saved.length > 0 && <div><div className="step-kind mb-s mt">Saved analyses</div>{saved.slice(0, 6).map((j) => <div key={j.id} className="row small mb-s"><a style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setText(j.text); setTitle(j.title); setLocal(j.result); setAi(null) }}>{j.title}</a><span className="muted tiny">{ago(j.at)}</span><button className="btn sm ghost" onClick={() => db.jds.delete(j.id!)}><Icon name="x" size={12} /></button></div>)}</div>}
        </div>
        <div className="col">
          {!local && <Empty title="Results appear here" icon="target">Skills are detected from the JD text using a Data Engineering skill taxonomy and compared with your evidence-based levels.</Empty>}
          {local && <>
            <div className="card"><div className="row"><div className="stat"><b>{local.readiness}%</b><span>role readiness (weighted by must-haves)</span></div>{local.years && <span className="badge warn">Experience asked: {local.years}</span>}</div>
              <div className="muted tiny mt-s">Source: the JD text you pasted. Skills and priorities are inferred — they are not verified company information.</div></div>
            <div className="card"><h3>Skills found</h3>
              {(['must', 'pref'] as const).map((grp) => {
                const list = local.found.filter((f: any) => (grp === 'must') === f.must)
                return list.length ? <div key={grp} className="mb-s"><div className="step-kind mb-s">{grp === 'must' ? 'Required / must-have' : 'Preferred / nice to have'}</div>{list.map((f: any) => (
                  <div key={f.id} className="row small mb-s"><span style={{ flex: 1 }}><b>{f.label}</b> <span className="muted tiny">({f.matched.join(', ')})</span></span><Level level={Math.round(f.level)} />{f.topics[0] && <a className="btn sm ghost" href={`#/topic/${f.topics.find((t: string) => (comps?.[t]?.level ?? 0) < 4) || f.topics[0]}`}>Prepare</a>}</div>
                ))}</div> : null
              })}
            </div>
            <div className="card"><h3>Preparation priorities</h3><ol className="small">{local.priorities.map((id: string) => { const f = local.found.find((x: any) => x.id === id); return <li key={id}>{f.label} — {f.must ? 'required' : 'preferred'}, you are at <b>{LEVELS[Math.round(f.level)]}</b></li> })}</ol></div>
            {qs.length > 0 && <div className="card"><h3>Relevant practice questions</h3>{qs.map((q) => <a key={q.id} href={`#/interview/bank?q=${q.id}`} className="small" style={{ display: 'block', marginBottom: 4 }}>• {q.q}</a>)}</div>}
          </>}
          {ai && <div className="card"><h3><Icon name="sparkles" />AI analysis: {ai.role} ({ai.seniority})</h3>
            <div className="grid g2"><div><div className="step-kind mb-s">Must-have</div>{ai.mustHave.map((m, i) => <div key={i} className="small mb-s"><b>{m.skill}</b><div className="muted tiny">“{m.evidence}”</div></div>)}</div><div><div className="step-kind mb-s">Nice to have</div>{ai.niceToHave.map((m, i) => <div key={i} className="small mb-s"><b>{m.skill}</b><div className="muted tiny">“{m.evidence}”</div></div>)}</div></div>
            <div className="step-kind mb-s mt">Likely questions (inferred, not verified)</div><ul className="small">{ai.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            <div className="step-kind mb-s">Plan</div><ol className="small">{ai.priorities.map((q, i) => <li key={i}>{q}</li>)}</ol>
            {ai.notes && <div className="small dim">{ai.notes}</div>}</div>}
        </div>
      </div>
    </div>
  )
}
