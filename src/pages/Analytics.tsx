import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { topicById, tracks } from '../content'
import { DIMS, DIM_LABEL } from '../types'
import { go, useLearner } from '../lib/hooks'
import { LEVELS, levelColor } from '../lib/competency'
import { addDays, DAY, dayKeyOf, fmtMin, pct, todayKey } from '../lib/util'
import { BarChart, Heatmap, LineChart } from '../components/Charts'
import { Bar, Loading } from '../components/ui'

const weekKey = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime() }

export default function Analytics() {
  const { comps, evidence } = useLearner()
  const activity = useLiveQuery(() => db.activity.where('at').above(Date.now() - 120 * DAY).toArray(), [], [])
  const attempts = useLiveQuery(() => db.attempts.toArray(), [], [])
  const reviews = useLiveQuery(() => db.reviews.toArray(), [], [])
  const interviews = useLiveQuery(() => db.interviews.where('status').equals('done').sortBy('at'), [], [])
  const projects = useLiveQuery(() => db.projects.toArray(), [], [])

  const m = useMemo(() => {
    const now = Date.now()
    const byDay: Record<string, number> = {}
    for (const a of activity) byDay[a.day] = (byDay[a.day] || 0) + a.seconds / 60
    const days: { day: string; minutes: number }[] = []
    const start = addDays(todayKey(), -(16 * 7 - 1))
    for (let i = 0; i < 16 * 7; i++) { const k = addDays(start, i); days.push({ day: k, minutes: byDay[k] || 0 }) }
    const weeks: number[] = []
    for (let w = 11; w >= 0; w--) weeks.push(weekKey(now - w * 7 * DAY))
    const wl = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    const minutesW = weeks.map((w) => ({ label: wl(w), value: activity.filter((a) => weekKey(a.at) === w).reduce((s, a) => s + a.seconds, 0) / 3600 }))
    // skill growth: distinct items solved independently per week
    const indepW = weeks.map((w) => ({ label: wl(w), value: new Set(evidence?.filter((e) => weekKey(e.at) === w && e.independent && e.hints === 0 && e.score >= 0.8 && e.dim !== 'understand').map((e) => e.itemId)).size }))
    const firstTry: Record<string, boolean> = {}
    for (const a of [...attempts].sort((x, y) => x.at - y.at)) if (!(a.exerciseId in firstTry)) firstTry[a.exerciseId] = a.passed && a.hints === 0
    const solved = new Set(attempts.filter((a) => a.passed).map((a) => a.exerciseId))
    const indep = new Set(attempts.filter((a) => a.passed && a.hints === 0).map((a) => a.exerciseId))
    const hintW = weeks.map((w) => { const a = attempts.filter((x) => weekKey(x.at) === w); return { label: wl(w), value: a.length ? a.reduce((s, x) => s + x.hints, 0) / a.length : 0 } })
    const recallW = weeks.map((w) => { const r = reviews.filter((x) => weekKey(x.at) === w); return { label: wl(w), value: r.length ? (r.filter((x) => x.rating >= 3).length / r.length) * 100 : 0 } })
    const total30 = activity.filter((a) => a.at > now - 30 * DAY).reduce((s, a) => s + a.seconds, 0) / 60
    const activeDays30 = new Set(activity.filter((a) => a.at > now - 30 * DAY).map((a) => a.day)).size
    const kindTime: Record<string, number> = {}
    for (const a of activity.filter((x) => x.at > now - 30 * DAY)) kindTime[a.kind] = (kindTime[a.kind] || 0) + a.seconds / 60
    return { days, minutesW, indepW, hintW, recallW, total30, activeDays30, firstTry, solved, indep, kindTime }
  }, [activity, attempts, reviews, evidence])

  if (!comps) return <Loading />
  const all = Object.values(comps)
  const studied = all.filter((c) => c.level >= 1)
  const dimAvg = DIMS.map((d) => ({ d, v: studied.length ? studied.reduce((s, c) => s + c.dims[d], 0) / studied.length : 0 }))
  const ftList = Object.values(m.firstTry)
  const ftRate = ftList.length ? ftList.filter(Boolean).length / ftList.length : 0
  const recallAll = reviews.length ? reviews.filter((r) => r.rating >= 3).length / reviews.length : 0
  const forgotten = all.filter((c) => c.forgotten)
  const basicOnly = all.filter((c) => c.level === 2)
  const strong = all.filter((c) => c.level >= 4)
  const ivData = interviews.map((s) => ({ label: `${new Date(s.at).toLocaleDateString()} · ${s.kind}`, value: s.overall || 0 }))

  return (
    <div className="page">
      <div className="page-head"><div><h1>Analytics</h1><p>Time spent is not skill. These views separate effort (study time) from evidence of ability (independent solutions, retention, interview performance).</p></div></div>
      <div className="kpis mb">
        <div className="kpi"><div className="v">{fmtMin(m.total30)}</div><div className="l">Study time · 30 days</div><div className="d">{m.activeDays30} active days</div></div>
        <div className="kpi"><div className="v">{strong.length}</div><div className="l">Topics independent+</div><div className="d">of {all.length}</div></div>
        <div className="kpi"><div className="v">{m.indep.size}/{m.solved.size}</div><div className="l">Exercises solved without hints / solved</div></div>
        <div className="kpi"><div className="v">{ftList.length ? pct(ftRate) : '—'}</div><div className="l">First-try independent rate</div></div>
        <div className="kpi"><div className="v">{reviews.length ? pct(recallAll) : '—'}</div><div className="l">Revision recall rate</div></div>
        <div className="kpi"><div className="v">{interviews.length ? Math.round(interviews.slice(-5).reduce((s, x) => s + (x.overall || 0), 0) / Math.min(5, interviews.length)) : '—'}</div><div className="l">Interview score (last 5)</div></div>
      </div>

      <div className="grid g2 mb">
        <div className="card"><h3>Effort: study hours per week</h3><BarChart data={m.minutesW} format={(v) => `${v.toFixed(1)} h`} /></div>
        <div className="card"><h3>Skill: new problems solved independently per week</h3><BarChart data={m.indepW} color="var(--lv4)" format={(v) => `${v} problem(s)`} /><div className="muted tiny">If hours rise but this stays flat, shift time from reading to unassisted practice.</div></div>
      </div>

      <div className="card mb">
        <div className="card-head"><h3>Consistency — last 16 weeks</h3><span className="muted small">Days studied in the last 30: {m.activeDays30}</span></div>
        <Heatmap days={m.days} />
      </div>

      <div className="card mb">
        <div className="card-head"><h3>Competency map</h3><div className="row tiny muted" style={{ gap: 10 }}>{LEVELS.map((l, i) => <span key={l} className="row" style={{ gap: 4 }}><i className="dot" style={{ background: levelColor(i) }} />{l}</span>)}</div></div>
        <div className="col" style={{ gap: 10 }}>
          {tracks.filter((t) => t.modules.some((x) => x.topics.length)).map((t) => (
            <div key={t.id} className="row nowrap" style={{ alignItems: 'flex-start' }}>
              <span className="small" style={{ width: 130, flex: 'none', fontWeight: 600 }}>{t.short}</span>
              <div className="row" style={{ gap: 3 }}>{t.modules.flatMap((x) => x.topics).map((x) => (
                <span key={x.id} title={`${x.title}: ${comps[x.id].label}${comps[x.id].forgotten ? ' (fading)' : ''}`} onClick={() => go(`/topic/${x.id}/progress`)} style={{ width: 22, height: 22, borderRadius: 5, background: levelColor(comps[x.id].level), cursor: 'pointer', outline: comps[x.id].forgotten ? '2px dashed var(--bad)' : comps[x.id].claimedOnly ? '2px dotted var(--text3)' : undefined, outlineOffset: 1 }} />
              ))}</div>
            </div>
          ))}
        </div>
        <div className="muted tiny mt-s">Dashed red outline = fading; dotted = claimed but not verified. Click a square for its evidence.</div>
      </div>

      <div className="grid g2 mb">
        <div className="card"><h3>Skill dimensions (average over studied topics)</h3>
          <div className="dimbars">{dimAvg.map(({ d, v }) => <div key={d} className="dimbar"><span>{DIM_LABEL[d]}</span><Bar value={v} /><span className="muted tiny">{pct(v)}</span></div>)}</div>
          <div className="muted tiny mt-s">A gap between Understanding and Independent coding/Applying means you know it but cannot yet do it alone.</div>
        </div>
        <div className="card"><h3>Where your knowledge stands</h3>
          <div className="small mb-s"><b>Can implement independently ({strong.length}):</b> <span className="dim">{strong.slice(0, 12).map((c) => topicById[c.topicId].title).join(', ') || '—'}</span></div>
          <div className="small mb-s"><b>Understood only at a basic level ({basicOnly.length}):</b> <span className="dim">{basicOnly.slice(0, 10).map((c) => topicById[c.topicId].title).join(', ') || '—'}</span></div>
          <div className="small mb-s"><b>Probably fading ({forgotten.length}):</b> <span className="dim">{forgotten.map((c) => topicById[c.topicId].title).join(', ') || '—'}</span></div>
          <div className="small"><b>Claimed, not verified ({all.filter((c) => c.claimedOnly).length}):</b> <span className="dim">run verification checks from Revision.</span></div>
        </div>
      </div>

      <div className="grid g2 mb">
        <div className="card"><h3>Coding: average hints per attempt</h3><BarChart data={m.hintW} color="var(--warn)" format={(v) => v.toFixed(2)} /><div className="muted tiny">Falling is good — you are needing less help.</div></div>
        <div className="card"><h3>Revision effectiveness: recall rate per week (%)</h3><BarChart data={m.recallW} color="var(--info)" max={100} format={(v) => `${Math.round(v)}%`} /><div className="muted tiny">Stable 85–92% means the schedule is well tuned.</div></div>
      </div>

      <div className="grid g2">
        <div className="card"><h3>Interview scores over time</h3>{ivData.length ? <LineChart data={ivData} /> : <div className="muted small">Complete interview rounds to see your trend.</div>}</div>
        <div className="card"><h3>Where time goes (30 days)</h3>
          {Object.keys(m.kindTime).length === 0 ? <div className="muted small">No activity yet.</div> : <div className="dimbars">{Object.entries(m.kindTime).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="dimbar"><span style={{ textTransform: 'capitalize' }}>{k}</span><Bar value={v / Math.max(...Object.values(m.kindTime))} /><span className="muted tiny">{fmtMin(v)}</span></div>)}</div>}
          {projects.length > 0 && <><hr className="sep" /><div className="step-kind mb-s">Projects</div>{projects.map((p) => { const vals = Object.values(p.rubric); return <div key={p.id} className="row small mb-s"><span style={{ flex: 1 }}>{p.id}</span><span className="badge">{p.status}</span><span className="muted tiny">{vals.length ? `rubric ${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)}/5` : 'not self-reviewed'}</span></div> })}</>}
        </div>
      </div>
    </div>
  )
}
