import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { loadCommunication, loadEnglish, topicById, tracks } from '../content'
import { useStudyClock } from '../lib/hooks'
import { analyzeText } from '../lib/comm'
import { aiEnabled, communicationFeedback } from '../lib/ai'
import { recordRecall } from '../lib/record'
import { ago, shuffle } from '../lib/util'
import { Bar, Empty, Icon, Loading, Markdown, Tabs, toast } from '../components/ui'

const AUDIENCES = [
  { id: 'interviewer', label: 'a technical interviewer', tip: 'Precise terms, trade-offs, an example.' },
  { id: 'stakeholder', label: 'a non-technical stakeholder', tip: 'No jargon, focus on impact and why it matters.' },
  { id: 'junior', label: 'a junior colleague', tip: 'Build from basics, use an analogy, then the real thing.' },
]

export default function Communicate() {
  const [tab, setTab] = useState<'explain' | 'frameworks' | 'english' | 'history'>('explain')
  useStudyClock('communication')
  return (
    <div className="page">
      <div className="page-head"><div><h1>Communication</h1><p>Explaining clearly is a technical skill. Practise explaining concepts, structuring answers and professional English.</p></div></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'explain', label: 'Explain a concept', icon: 'chat' }, { id: 'frameworks', label: 'Answer structures', icon: 'list' }, { id: 'english', label: 'English practice', icon: 'edit' }, { id: 'history', label: 'My attempts', icon: 'clock' }]} />
      {tab === 'explain' && <Explain />}
      {tab === 'frameworks' && <Frameworks />}
      {tab === 'english' && <English />}
      {tab === 'history' && <History />}
    </div>
  )
}

function Explain() {
  const [topic, setTopic] = useState('dw-scd')
  const [aud, setAud] = useState('interviewer')
  const [text, setText] = useState('')
  const [res, setRes] = useState<ReturnType<typeof analyzeText> | null>(null)
  const [fb, setFb] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasAI, setHasAI] = useState(false)
  useEffect(() => { aiEnabled().then(setHasAI) }, [])
  const a = AUDIENCES.find((x) => x.id === aud)!
  const task = `Explain "${topicById[topic]?.title}" to ${a.label}.`
  const check = async () => {
    const m = analyzeText(text); setRes(m); setFb('')
    await db.comm.add({ promptId: `explain:${topic}:${aud}`, area: 'explain', text, metrics: m, topicId: topic, at: Date.now() })
    await recordRecall(topic, `explain:${aud}`, Math.min(1, m.score / 100), 'explain', 'explain')
  }
  const ai = async () => { setBusy(true); try { const f = await communicationFeedback(task, text); setFb(f); } catch (e: any) { toast(e.message) } setBusy(false) }
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', alignItems: 'start' }}>
      <div className="card col">
        <div className="row nowrap">
          <select className="select" value={topic} onChange={(e) => { setTopic(e.target.value); setRes(null) }}>{tracks.map((t) => <optgroup key={t.id} label={t.title}>{t.modules.flatMap((m) => m.topics).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</optgroup>)}</select>
          <select className="select" style={{ width: 240 }} value={aud} onChange={(e) => setAud(e.target.value)}>{AUDIENCES.map((x) => <option key={x.id} value={x.id}>to {x.label}</option>)}</select>
        </div>
        <div className="hint"><b>{task}</b> {a.tip}</div>
        <textarea className="textarea" rows={11} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write it as you would say it. 100–200 words is a good interview length." />
        <div className="row"><button className="btn primary" disabled={text.trim().length < 30} onClick={check}><Icon name="check" size={15} />Check my explanation</button>{hasAI && res && <button className="btn" disabled={busy} onClick={ai}>{busy ? <span className="spin" /> : <Icon name="sparkles" size={15} />}Language & clarity feedback</button>}<span className="muted small">{text.trim().split(/\s+/).filter(Boolean).length} words</span></div>
      </div>
      <div className="col">
        {!res ? <div className="card"><h3>What good looks like</h3><ul className="small dim"><li>Start with a one-sentence definition.</li><li>Say why it exists — what problem it solves.</li><li>Explain how it works, step by step.</li><li>Give a concrete example (ideally your own).</li><li>Mention a trade-off or limitation.</li><li>Close with a one-line summary.</li></ul></div> : <>
          <div className="card"><div className="row"><div className="stat"><b>{res.score}</b><span>clarity score (offline)</span></div><span className="spacer" /><div className="col small" style={{ gap: 2, alignItems: 'flex-end' }}><span>{res.words} words · {res.sentences} sentences</span><span>avg {res.avgSentence} words/sentence</span></div></div>
            <div className="row mt-s" style={{ gap: 6 }}>{[['Example', res.examples], ['Trade-off', res.tradeoffs], ['Signposting', res.structure.length > 0], ['Numbers', res.numbers > 0]].map(([l, ok]) => <span key={l as string} className={`badge ${ok ? 'good' : ''}`}>{ok ? '✔' : '○'} {l}</span>)}</div>
            <ul className="small mt-s">{res.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
          {fb && <div className="card"><h3><Icon name="sparkles" />Coach feedback</h3><Markdown text={fb} /></div>}
        </>}
      </div>
    </div>
  )
}

function Frameworks() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { loadCommunication().then(setData) }, [])
  if (!data) return <Loading />
  return <div className="grid g2">{(data.frameworks || []).map((f: any) => (
    <div key={f.id} className="card"><h3>{f.name}</h3><p className="dim small">{f.when}</p>
      <ol className="small">{f.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>
      {f.example && <details><summary className="small" style={{ cursor: 'pointer' }}>Example</summary><Markdown text={f.example} /></details>}
    </div>
  ))}</div>
}

function English() {
  const [data, setData] = useState<any>(null)
  const [set, setSet] = useState<any[]>([])
  const [i, setI] = useState(0)
  const [ans, setAns] = useState('')
  const [shown, setShown] = useState(false)
  const [cat, setCat] = useState('all')
  const [hasAI, setHasAI] = useState(false)
  const [fb, setFb] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { loadEnglish().then((d) => { setData(d); setSet(shuffle(d.exercises || [])) }); aiEnabled().then(setHasAI) }, [])
  if (!data) return <Loading />
  const list = set.filter((x) => cat === 'all' || x.type === cat)
  const ex = list[i % Math.max(1, list.length)]
  const next = () => { setI(i + 1); setAns(''); setShown(false); setFb('') }
  const reveal = async () => { setShown(true); await db.comm.add({ promptId: ex.id, area: 'english', text: ans, metrics: { type: ex.type, correct: ex.choices ? ans === String(ex.answer) : null }, at: Date.now() }) }
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', alignItems: 'start' }}>
      <div className="card">
        <div className="pill-nav mb">{['all', ...new Set((data.exercises || []).map((x: any) => x.type))].map((c: any) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => { setCat(c); setI(0); setShown(false); setAns('') }}>{c}</button>)}</div>
        {!ex ? <Empty title="No exercises" /> : <>
          <div className="step-kind mb-s">{ex.type}</div>
          <h3>{ex.prompt}</h3>
          {ex.text && <div className="card flat tight mb-s" style={{ fontStyle: 'italic' }}>“{ex.text}”</div>}
          {ex.choices ? ex.choices.map((c: string, k: number) => <button key={k} className={`quiz-opt ${shown ? (k === ex.answer ? 'right' : String(k) === ans ? 'wrong' : '') : String(k) === ans ? 'sel' : ''}`} onClick={() => !shown && setAns(String(k))}><span className="letter">{String.fromCharCode(65 + k)}</span>{c}</button>)
            : <textarea className="textarea" rows={5} value={ans} onChange={(e) => setAns(e.target.value)} disabled={shown} placeholder="Your version…" />}
          {!shown ? <div className="row mt-s"><button className="btn primary" disabled={!ans} onClick={reveal}>Check</button><button className="btn ghost" onClick={next}>Skip</button></div> : <>
            <div className="hint mt-s"><b>{ex.choices ? 'Explanation' : 'A strong version'}:</b> {ex.model || ex.explain}{ex.explain && ex.model && <div className="mt-s">{ex.explain}</div>}</div>
            <div className="row mt-s">{hasAI && !ex.choices && <button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { setFb(await communicationFeedback(ex.prompt + (ex.text ? `: "${ex.text}"` : ''), ans)) } catch (e: any) { toast(e.message) } setBusy(false) }}>{busy ? <span className="spin" /> : <Icon name="sparkles" size={15} />}Feedback on my version</button>}<span className="spacer" /><button className="btn primary" onClick={next}>Next<Icon name="arrow" size={15} /></button></div>
            {fb && <div className="card flat mt-s"><Markdown text={fb} /></div>}
          </>}
        </>}
      </div>
      <div className="col">
        {(data.phrasebook || []).map((p: any) => <div key={p.title} className="card tight"><div className="step-kind mb-s">{p.title}</div>{p.phrases.map((x: string, k: number) => <div key={k} className="small mb-s">• {x}</div>)}</div>)}
      </div>
    </div>
  )
}

function History() {
  const items = useLiveQuery(() => db.comm.orderBy('at').reverse().limit(100).toArray(), [], [])
  const ex = items.filter((x) => x.area === 'explain')
  if (!items.length) return <Empty title="No attempts yet" />
  return (
    <div className="card">
      {ex.length > 1 && <div className="mb"><div className="step-kind mb-s">Clarity score trend (explanations)</div><div className="row nowrap" style={{ gap: 3, alignItems: 'flex-end', height: 60 }}>{[...ex].reverse().slice(-30).map((x) => <div key={x.id} title={`${x.metrics.score}`} style={{ width: 10, height: `${x.metrics.score * 0.6}px`, background: 'var(--accent)', borderRadius: 3 }} />)}</div></div>}
      <div className="list">{items.map((x) => <div key={x.id} className="item small"><span className="badge">{x.area}</span><span style={{ flex: 1 }} className="dim">{x.text.slice(0, 120)}</span>{x.metrics?.score && <div style={{ width: 80 }}><Bar value={x.metrics.score / 100} /></div>}<span className="muted tiny">{ago(x.at)}</span></div>)}</div>
    </div>
  )
}
