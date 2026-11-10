import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { topicById, tracks, trackById } from '../content'
import { go, useExercises } from '../lib/hooks'
import Exercise from '../components/Exercise'
import { Diff, Empty, Icon, KindBadge, Loading } from '../components/ui'
import { shuffle } from '../lib/util'

export default function Practice({ exId }: { exId?: string }) {
  const exercises = useExercises()
  const attempts = useLiveQuery(() => db.attempts.toArray(), [], [])
  const [track, setTrack] = useState('all')
  const [kind, setKind] = useState('all')
  const [lang, setLang] = useState('all')
  const [diff, setDiff] = useState(0)
  const [st, setSt] = useState('all')
  const stat = useMemo(() => {
    const m: Record<string, 'indep' | 'helped' | 'tried'> = {}
    for (const a of attempts) { const cur = m[a.exerciseId]; const v = a.passed ? (a.hints === 0 ? 'indep' : 'helped') : 'tried'; if (!cur || v === 'indep' || (v === 'helped' && cur === 'tried')) m[a.exerciseId] = v }
    return m
  }, [attempts])
  if (!exercises) return <Loading />
  if (exId) {
    const ex = exercises[exId]
    if (!ex) return <div className="page"><Empty title="Exercise not found" /></div>
    return (
      <div className="page" style={{ maxWidth: 1100 }}>
        <div className="crumbs"><a href="#/practice">Practice</a> / <a href={`#/topic/${ex.topic}`}>{topicById[ex.topic]?.title}</a></div>
        <Exercise key={ex.id} ex={ex} mode="practice" />
      </div>
    )
  }
  const all = Object.values(exercises)
  const list = all.filter((e) => (track === 'all' || e.track === track) && (kind === 'all' || e.kind === kind) && (lang === 'all' || e.lang === lang) && (!diff || e.difficulty === diff) && (st === 'all' || (st === 'new' ? !stat[e.id] : st === 'unsolved' ? stat[e.id] === 'tried' : st === 'helped' ? stat[e.id] === 'helped' : stat[e.id] === 'indep')))
  const solved = all.filter((e) => stat[e.id] === 'indep').length
  const random = () => { const pool = list.filter((e) => stat[e.id] !== 'indep'); const pick = shuffle(pool.length ? pool : list)[0]; if (pick) go(`/practice/${pick.id}`) }
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Practice</h1><p>{all.length} exercises — concept, coding, debugging, scenario and interview-style. {solved} solved independently.</p></div>
        <div className="row"><button className="btn" onClick={random}><Icon name="spark" size={15} />Surprise me</button><a className="btn" href="#/playground/sql"><Icon name="database" size={15} />SQL playground</a><a className="btn" href="#/playground/python"><Icon name="code" size={15} />Python playground</a></div>
      </div>
      <div className="card mb">
        <div className="row">
          <select className="select" style={{ width: 170 }} value={track} onChange={(e) => setTrack(e.target.value)}><option value="all">All tracks</option>{tracks.map((t) => <option key={t.id} value={t.id}>{t.short}</option>)}</select>
          <select className="select" style={{ width: 150 }} value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All types</option>{['coding', 'debug', 'scenario', 'predict', 'concept', 'assignment'].map((k) => <option key={k} value={k}>{k}</option>)}</select>
          <select className="select" style={{ width: 130 }} value={lang} onChange={(e) => setLang(e.target.value)}><option value="all">Any language</option><option value="sql">SQL</option><option value="python">Python</option><option value="mcq">Choice</option><option value="text">Written</option></select>
          <select className="select" style={{ width: 130 }} value={diff} onChange={(e) => setDiff(Number(e.target.value))}><option value={0}>Any level</option><option value={1}>Basic</option><option value={2}>Intermediate</option><option value={3}>Advanced</option></select>
          <select className="select" style={{ width: 170 }} value={st} onChange={(e) => setSt(e.target.value)}><option value="all">Any status</option><option value="new">Not attempted</option><option value="unsolved">Attempted, unsolved</option><option value="helped">Solved with help</option><option value="indep">Solved independently</option></select>
          <span className="muted small">{list.length} shown</span>
        </div>
      </div>
      <div className="card">
        {list.length === 0 && <Empty title="No exercises match these filters" />}
        <div className="list">{list.sort((a, b) => (trackById[a.track]?.order - trackById[b.track]?.order) || a.difficulty - b.difficulty).map((e) => {
          const s = stat[e.id]
          return (
            <div key={e.id} className="item click" onClick={() => go(`/practice/${e.id}`)}>
              <span style={{ width: 18, color: s === 'indep' ? 'var(--good)' : s === 'helped' ? 'var(--warn)' : s === 'tried' ? 'var(--bad)' : 'var(--text3)' }}>{s === 'indep' ? '✔' : s === 'helped' ? '◐' : s === 'tried' ? '✘' : '○'}</span>
              <div style={{ flex: 1, minWidth: 0 }}><b className="small">{e.title}</b><div className="muted tiny"><span className="dot" style={{ background: trackById[e.track]?.color, width: 6, height: 6 }} /> {topicById[e.topic]?.title}</div></div>
              <KindBadge kind={e.kind} /><span className="badge outline">{e.lang}</span><Diff d={e.difficulty} />
            </div>
          )
        })}</div>
      </div>
    </div>
  )
}
