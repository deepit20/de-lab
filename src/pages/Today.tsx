import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, kvGet, kvSet, type DayPlan, type PlanItem } from '../db'
import { go, useExercises, useLearner, useProfile } from '../lib/hooks'
import { buildPlan, nextTopic } from '../lib/planner'
import { topicById, topicsInOrder, tracks, trackById } from '../content'
import { LEVELS, levelColor } from '../lib/competency'
import { addDays, ago, fmtMin, greeting, todayKey, uid, DAY } from '../lib/util'
import { Bar, Icon, Level, Loading, toast } from '../components/ui'
import { isDemo } from '../lib/demo'

const KIND_ICON: Record<string, string> = { review: 'repeat', learn: 'book', verify: 'check', practice: 'target', retry: 'code', project: 'rocket', interview: 'mic', explain: 'chat', custom: 'star' }
const KIND_LABEL: Record<string, string> = { review: 'Revision', learn: 'Learn', verify: 'Verify', practice: 'Practice', retry: 'Retry', project: 'Project', interview: 'Interview', explain: 'Explain', custom: 'Your task' }

function openItem(i: PlanItem) {
  const map: Record<string, string> = {
    review: '/revise/session', learn: `/topic/${i.ref}`, verify: `/revise/session?mode=verify&topic=${i.ref}`, practice: `/topic/${i.ref}/practice`,
    retry: `/practice/${i.ref}`, project: `/projects/${i.ref}`, interview: '/interview/mock?quick=1', explain: '/communicate',
  }
  if (map[i.kind]) go(map[i.kind])
}

export default function Today() {
  const profile = useProfile()
  const { comps, progress, ready } = useLearner()
  const exercises = useExercises()
  const today = todayKey()
  const plan = useLiveQuery(() => db.plans.get(today), [today])
  // undefined = still loading (the plan must not be built from half-loaded data)
  const dueQ = useLiveQuery(() => db.cards.where('due').belowOrEqual(Date.now()).filter((c) => !c.suspended).toArray(), [])
  const attemptsQ = useLiveQuery(() => db.attempts.toArray(), [])
  const activeProject = useLiveQuery(() => db.projects.where('status').equals('active').first().then((p) => p ?? null), [])
  const interviews7Q = useLiveQuery(() => db.interviews.where('at').above(Date.now() - 7 * DAY).count(), [])
  const due = dueQ ?? [], attempts = attemptsQ ?? [], interviews7 = interviews7Q ?? 0
  const dataLoaded = dueQ !== undefined && attemptsQ !== undefined && activeProject !== undefined && interviews7Q !== undefined
  const activity = useLiveQuery(() => db.activity.where('at').above(Date.now() - 14 * DAY).toArray(), [], [])
  const recent = useLiveQuery(() => db.attempts.orderBy('at').reverse().limit(6).toArray(), [], [])
  const [minutes, setMinutes] = useState<number | null>(null)
  const [adding, setAdding] = useState('')

  const failed = useMemo(() => {
    if (!exercises) return []
    const by: Record<string, boolean> = {}
    for (const a of attempts) by[a.exerciseId] = by[a.exerciseId] || a.passed
    return Object.entries(by).filter(([, ok]) => !ok).map(([id]) => exercises[id]).filter(Boolean).map((e) => ({ exerciseId: e.id, topicId: e.topic, title: e.title }))
  }, [attempts, exercises])

  async function generate(mins: number, keepDone = true) {
    if (!comps) return
    const carry = await kvGet<PlanItem[]>('carry', [])
    const { items, note } = buildPlan({ minutes: mins, due, comps, progress, failed, activeProject: activeProject ? { id: activeProject.id, title: activeProject.id } : undefined, interviewsLast7: interviews7, carry, reviewShare: profile!.settings.reviewShare })
    const done = keepDone && plan ? plan.items.filter((i) => i.status === 'done') : []
    const p: DayPlan = { date: today, minutes: mins, items: [...done, ...items.filter((i) => !done.some((d) => d.kind === i.kind && d.ref === i.ref))], createdAt: Date.now(), note }
    await db.plans.put(p)
    await kvSet('carry', [])
  }
  useEffect(() => {
    if (ready && profile && plan === undefined && exercises && dataLoaded) generate(profile.settings.weekMinutes[new Date().getDay()] || profile.settings.dailyMinutes, false)
  }, [ready, profile, plan, exercises, dataLoaded])

  const update = async (id: string, patch: Partial<PlanItem>) => { if (!plan) return; await db.plans.put({ ...plan, items: plan.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }) }
  const postpone = async (i: PlanItem) => {
    const carry = await kvGet<PlanItem[]>('carry', [])
    await kvSet('carry', [...carry, { ...i, id: uid(), status: 'todo' }])
    await update(i.id, { status: 'postponed' })
    toast(`Moved to ${new Date(Date.now() + DAY).toLocaleDateString(undefined, { weekday: 'long' })}.`)
  }
  const remove = async (id: string) => { if (plan) await db.plans.put({ ...plan, items: plan.items.filter((i) => i.id !== id) }) }
  const addCustom = async () => { if (!plan || !adding.trim()) return; await db.plans.put({ ...plan, items: [...plan.items, { id: uid(), kind: 'custom', ref: '', title: adding.trim(), minutes: 15, reason: 'Added by you.', status: 'todo' }] }); setAdding('') }

  if (!ready || !comps || !profile) return <Loading />
  const curId = nextTopic(progress, comps)
  const cur = curId ? topicById[curId] : undefined
  const curProg = curId ? progress[curId] : undefined
  const levels = [0, 0, 0, 0, 0, 0]
  for (const c of Object.values(comps)) levels[c.level]++
  const weak = topicsInOrder.map((t) => comps[t.id]).filter((c) => c.forgotten || ((c.level === 2 || c.level === 3) && !c.claimedOnly)).slice(0, 5)
  const claimed = topicsInOrder.filter((t) => comps[t.id].claimedOnly).length
  const studyDays = new Set(activity.map((a) => a.day)).size
  const planMin = plan?.items.filter((i) => i.status !== 'postponed').reduce((s, i) => s + i.minutes, 0) || 0
  const doneMin = plan?.items.filter((i) => i.status === 'done').reduce((s, i) => s + i.minutes, 0) || 0
  const backupAge = profile.settings.lastBackupAt ? (Date.now() - profile.settings.lastBackupAt) / DAY : 999
  const curModule = cur ? trackById[cur.track].modules.find((m) => m.id === cur.module) : undefined
  const modDone = curModule ? curModule.topics.filter((t) => comps[t.id].level >= 4).length : 0

  return (
    <div className="page">
      {backupAge > 7 && (attempts.length > 5) && !isDemo() &&<div className="banner mb"><Icon name="download" /><span>Your learning history lives only in this browser. {profile.settings.lastBackupAt ? `Last backup ${ago(profile.settings.lastBackupAt)}.` : 'You have not made a backup yet.'}</span><span className="spacer" /><a className="btn sm" href="#/settings">Back up now</a></div>}
      <div className="hero mb">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="muted small">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <h1 style={{ marginTop: 2 }}>{greeting()}{profile.name ? `, ${profile.name}` : ''}.</h1>
            {cur && <>
              <div className="dim">{curProg?.status === 'in_progress' ? 'You paused in' : 'Next up'}: <b>{cur.title}</b> <span className="muted">· {trackById[cur.track].title}</span></div>
              <div className="row mt">
                <button className="btn primary lg" onClick={() => go(`/topic/${cur.id}`)}><Icon name="play" size={15} />{curProg?.status === 'in_progress' ? `Resume (step ${(curProg.step || 0) + 1})` : 'Start lesson'}</button>
                {due.length > 0 && <button className="btn lg" onClick={() => go('/revise/session')}><Icon name="repeat" size={16} />{due.length} due review{due.length === 1 ? '' : 's'}</button>}
              </div>
            </>}
          </div>
          <div className="col" style={{ alignItems: 'flex-end', gap: 6 }}>
            <span className="muted small">Time available today</span>
            <div className="seg">{[15, 30, 45, 60, 90, 120].map((m) => <button key={m} className={(minutes ?? plan?.minutes) === m ? 'on' : ''} onClick={() => { setMinutes(m); generate(m) }}>{m < 60 ? `${m}m` : `${m / 60}h`}</button>)}</div>
            <span className="muted tiny">The plan rebuilds around what you have already done.</span>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h3><Icon name="list" />Today's plan</h3>
              <div className="row"><span className="muted small">{fmtMin(doneMin)} of {fmtMin(planMin)}</span><button className="btn sm ghost" onClick={() => plan && generate(plan.minutes)} title="Rebuild plan"><Icon name="repeat" size={14} />Rebuild</button></div>
            </div>
            <Bar value={planMin ? doneMin / planMin : 0} color="var(--good)" />
            {plan?.note && <div className="muted small mt-s">{plan.note}</div>}
            <div className="col mt" style={{ gap: 8 }}>
              {!plan && <Loading text="Building your plan…" />}
              {plan?.items.filter((i) => i.status !== 'postponed').map((i) => (
                <div key={i.id} className={`plan-item ${i.status === 'done' ? 'done' : ''}`}>
                  <button className={`check ${i.status === 'done' ? 'on' : ''}`} onClick={() => update(i.id, { status: i.status === 'done' ? 'todo' : 'done' })} aria-label="Mark done">{i.status === 'done' && <Icon name="check" size={13} stroke={3} />}</button>
                  <div className="plan-ico"><Icon name={KIND_ICON[i.kind]} size={17} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}><span className="badge">{KIND_LABEL[i.kind]}</span><b className="pt" style={{ cursor: i.kind !== 'custom' ? 'pointer' : undefined }} onClick={() => openItem(i)}>{i.title}</b></div>
                    <div className="muted small" style={{ marginTop: 2 }}>{i.reason}</div>
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                    <select className="select" style={{ width: 82, padding: '3px 6px', fontSize: 12 }} value={i.minutes} onChange={(e) => update(i.id, { minutes: Number(e.target.value) })}>{[...new Set([5, 10, 15, 20, 25, 30, 45, 60, 90, i.minutes])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m} min</option>)}</select>
                    <div className="row" style={{ gap: 2 }}>
                      {i.kind !== 'custom' && i.status !== 'done' && <button className="btn sm primary" onClick={() => openItem(i)}>Go</button>}
                      <button className="btn sm ghost" title="Postpone to tomorrow" onClick={() => postpone(i)}><Icon name="clock" size={13} /></button>
                      <button className="btn sm ghost" title="Remove" onClick={() => remove(i.id)}><Icon name="x" size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="row nowrap"><input className="input" placeholder="Add your own task (e.g. 'Watch Airflow talk', 'Re-read SCD notes')" value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} /><button className="btn" onClick={addCustom}><Icon name="plus" size={15} />Add</button></div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3><Icon name="target" />Competency overview</h3><a className="small" href="#/analytics">Details →</a></div>
            <div className="row mb" style={{ gap: 14 }}>
              {LEVELS.map((l, i) => <div key={l} className="stat"><b style={{ color: i ? levelColor(i) : undefined }}>{levels[i]}</b><span>{l}</span></div>)}
              {claimed > 0 && <div className="stat"><b>{claimed}</b><span>Claimed, unverified</span></div>}
            </div>
            <div className="col" style={{ gap: 9 }}>
              {tracks.filter((t) => t.modules.some((m) => m.topics.length)).map((t) => {
                const ts = t.modules.flatMap((m) => m.topics)
                const indep = ts.filter((x) => comps[x.id].level >= 4).length
                const studied = ts.filter((x) => comps[x.id].level >= 1).length
                return (
                  <div key={t.id} className="dimbar" style={{ gridTemplateColumns: '130px 1fr 70px', cursor: 'pointer' }} onClick={() => go(`/learn/${t.id}`)}>
                    <span className="row nowrap" style={{ gap: 6 }}><span className="dot" style={{ background: t.color }} />{t.short}</span>
                    <div className="bar" style={{ display: 'flex' }}><i style={{ width: `${(indep / ts.length) * 100}%`, background: 'var(--lv4)', borderRadius: 0 }} /><i style={{ width: `${((studied - indep) / ts.length) * 100}%`, background: 'var(--lv1)', borderRadius: 0, opacity: 0.6 }} /></div>
                    <span className="muted tiny">{indep}/{ts.length} indep.</span>
                  </div>
                )
              })}
            </div>
            <div className="muted tiny mt-s">Dark segment = independently demonstrated. Light = studied but not yet proven.</div>
          </div>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3><Icon name="repeat" />Revision</h3><a className="small" href="#/revise">Open →</a></div>
            <div className="row"><div className="stat"><b>{due.length}</b><span>due now</span></div><span className="spacer" /><button className="btn primary" disabled={!due.length} onClick={() => go('/revise/session')}>Start</button></div>
            {due.length > 40 && <div className="muted small mt-s">A backlog after time away is normal — the most at-risk cards come first, and a short session still helps.</div>}
          </div>
          <div className="card">
            <div className="card-head"><h3><Icon name="alert" />Needs attention</h3></div>
            {weak.length === 0 ? <div className="muted small">Nothing weak yet — keep going. Topics show up here when they are fading or only partially understood.</div> :
              <div className="list">{weak.map((c) => <div key={c.topicId} className="item click" onClick={() => go(`/topic/${c.topicId}/practice`)}><div style={{ flex: 1, minWidth: 0 }}><div className="small" style={{ fontWeight: 600 }}>{topicById[c.topicId].title}</div><div className="muted tiny">{c.forgotten ? 'Fading since last practice' : c.next}</div></div><Level level={c.level} /></div>)}</div>}
          </div>
          {curModule && (
            <div className="card">
              <div className="card-head"><h3><Icon name="flag" />Milestone</h3></div>
              <div className="small">Module: <b>{curModule.title}</b></div>
              <div className="mt-s"><Bar value={modDone / curModule.topics.length} color="var(--lv4)" /></div>
              <div className="muted tiny mt-s">{modDone}/{curModule.topics.length} topics independent · then the module assignment</div>
            </div>
          )}
          <div className="card">
            <div className="card-head"><h3><Icon name="clock" />Consistency</h3></div>
            <div className="row"><div className="stat"><b>{studyDays}/14</b><span>days studied (last 2 weeks)</span></div></div>
            <div className="muted tiny mt-s">Consistency beats intensity. A missed day is fine — the plan adapts.</div>
          </div>
          <div className="card">
            <div className="card-head"><h3><Icon name="code" />Recent activity</h3></div>
            {recent.length === 0 ? <div className="muted small">No attempts yet.</div> : <div className="list">{recent.map((a) => (
              <div key={a.id} className="item click" onClick={() => go(`/practice/${a.exerciseId}`)}>
                <span style={{ color: a.passed ? 'var(--good)' : 'var(--bad)' }}>{a.passed ? '✔' : '✘'}</span>
                <div style={{ flex: 1, minWidth: 0 }} className="small"><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exercises?.[a.exerciseId]?.title || a.exerciseId}</div><div className="muted tiny">{topicById[a.topicId]?.title} · {ago(a.at)}{a.hints ? ` · ${a.hints} hint(s)` : ''}</div></div>
              </div>))}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
