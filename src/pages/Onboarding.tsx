import { useEffect, useState } from 'react'
import { db, getProfile, BACKGROUNDS, DEFAULT_SETTINGS, type Background, type TopicProgress } from '../db'
import { tracks } from '../content'
import { go } from '../lib/hooks'
import { ensureFlashcards } from '../lib/record'
import { Icon, Seg } from '../components/ui'

type Prior = 'none' | 'some' | 'confident'

/** A sensible starting guess of prior knowledge per background (always editable, never counted as mastery). */
const GUESS: Record<Background, Record<string, Prior>> = {
  new: {},
  student: { 'sql-m1': 'some', 'py-m1': 'some', 'py-m2': 'some' },
  analyst: { 'sql-m1': 'confident', 'sql-m2': 'confident', 'sql-m3': 'confident', 'sql-m4': 'some', 'sql-m5': 'some', 'py-m1': 'some', 'def-m1': 'some', 'dw-m1': 'some', 'dw-m2': 'some' },
  developer: { 'py-m1': 'confident', 'py-m2': 'confident', 'py-m3': 'confident', 'py-m4': 'some', 'py-m5': 'some', 'py-m6': 'some', 'sql-m1': 'some', 'sql-m2': 'some', 'sql-m3': 'some' },
  engineer: Object.fromEntries(tracks.filter((t) => ['sql', 'py', 'def', 'etl'].includes(t.id)).flatMap((t) => t.modules.map((m) => [m.id, 'some' as Prior]))),
  other: {},
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PRESETS: { label: string; week: number[] }[] = [
  { label: 'A little (≈30 min/day)', week: [60, 30, 30, 30, 30, 30, 60] },
  { label: 'Steady (≈1 h/day)', week: [120, 60, 60, 60, 60, 45, 120] },
  { label: 'Intensive (≈2 h/day)', week: [180, 120, 120, 120, 120, 90, 180] },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [background, setBackground] = useState<Background | ''>('')
  const [goal, setGoal] = useState('')
  const [about, setAbout] = useState('')
  const [week, setWeek] = useState<number[]>(DEFAULT_SETTINGS.weekMinutes)
  const [custom, setCustom] = useState(false)
  const [prior, setPrior] = useState<Record<string, Prior>>({})
  const [saving, setSaving] = useState(false)
  const [firstRun, setFirstRun] = useState(true)

  useEffect(() => {
    getProfile().then((p) => { setFirstRun(!p.onboarded); setName(p.name); setGoal(p.goal === 'Become a confident Data Engineer' ? '' : p.goal); setWeek(p.settings.weekMinutes); setBackground(p.background || ''); setAbout(p.about || '') })
    db.progress.toArray().then((ps) => {
      const m: Record<string, Prior> = {}
      for (const t of tracks) for (const mod of t.modules) { const x = mod.topics.map((tp) => ps.find((p) => p.topicId === tp.id)?.prior).find(Boolean); if (x) m[mod.id] = x as Prior }
      setPrior(m)
    })
  }, [])
  // pre-fill prior knowledge from the chosen background (only for modules the learner hasn't set)
  const priorFor = (modId: string): Prior => prior[modId] || (background ? GUESS[background][modId] : undefined) || 'none'

  async function finish(usePriors: boolean) {
    setSaving(true)
    const now = Date.now()
    for (const t of tracks) for (const mod of t.modules) for (const tp of mod.topics) {
      const pr: Prior = usePriors ? priorFor(mod.id) : 'none'
      const cur = await db.progress.get(tp.id)
      if (!cur && pr === 'none') continue
      const rec: TopicProgress = cur ? { ...cur, prior: pr } : { topicId: tp.id, status: 'not_started', step: 0, seconds: 0, prior: pr, firstAt: now }
      await db.progress.put(rec)
      // prior topics join revision (spread over 3 weeks) so knowledge is verified without a day-one backlog
      if (pr !== 'none') await ensureFlashcards(tp.id, 21)
    }
    await db.plans.clear()
    const p = await getProfile()
    await db.profile.put({
      ...p, name: name.trim(), goal: goal.trim() || 'Become a confident Data Engineer', background: background || undefined, about: about.trim() || undefined, onboarded: true,
      settings: { ...p.settings, weekMinutes: week, dailyMinutes: week[new Date().getDay()] || 60 },
    })
    go('/')
  }

  const ok = name.trim().length > 0
  const Skip = ({ onClick, label = 'Skip' }: { onClick: () => void; label?: string }) => <button className="btn ghost" onClick={onClick}>{label}</button>

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'start center', padding: '6vh 16px' }}>
      <div style={{ width: 'min(820px, 100%)' }}>
        <div className="row mb"><div className="brand-mark">DE</div><b style={{ fontSize: 18 }}>DE Lab</b><span className="spacer" /><span className="muted small">{step === 0 ? 'Takes under a minute' : `Step ${step + 1} of 3 · optional`}</span></div>

        {step === 0 && (
          <div className="card">
            <h1>{firstRun ? 'Welcome to DE Lab' : 'Your profile'}</h1>
            <p className="dim">A personal Data Engineering workspace: lessons, notes, coding practice, revision, projects and interview prep. Everything stays private in this browser — no account needed.</p>
            <label className="field mt" style={{ maxWidth: 380 }}>What should we call you?
              <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" onKeyDown={(e) => e.key === 'Enter' && ok && finish(true)} />
            </label>
            <div className="field mt">Which describes you best? <span className="muted" style={{ fontWeight: 400 }}>(optional — tailors your starting point)</span>
              <div className="row" style={{ gap: 6 }}>
                {BACKGROUNDS.map((b) => <button key={b.id} className={`btn sm ${background === b.id ? 'primary' : ''}`} onClick={() => setBackground(background === b.id ? '' : b.id)}>{b.label}</button>)}
              </div>
            </div>
            {firstRun && <div className="banner info mt"><Icon name="eye" /><span>Just looking around? <b>Explore a demo workspace</b> with six weeks of sample progress — you can start your own any time.</span><span className="spacer" /><button className="btn sm" disabled={saving} onClick={async () => { setSaving(true); const m = await import('../lib/demo'); await m.loadDemo(); go('/') }}>Explore the demo</button></div>}
            <div className="row mt">
              <span className="muted small">You can change all of this later in Settings.</span>
              <span className="spacer" />
              <button className="btn" disabled={!ok} onClick={() => setStep(1)}>Customise more</button>
              <button className="btn primary lg" disabled={!ok || saving} onClick={() => finish(true)}>{saving ? <span className="spin" /> : <Icon name="rocket" size={16} />}Start learning</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="card">
            <h1>Your time and goal</h1>
            <p className="dim">Used by the daily planner. You can change today's time any day, and missed days never create an impossible backlog.</p>
            <div className="field">How much time do you usually have?
              <div className="row" style={{ gap: 6 }}>
                {PRESETS.map((p) => <button key={p.label} className={`btn sm ${!custom && week.join() === p.week.join() ? 'primary' : ''}`} onClick={() => { setWeek(p.week); setCustom(false) }}>{p.label}</button>)}
                <button className={`btn sm ${custom ? 'primary' : ''}`} onClick={() => setCustom(true)}>Per day…</button>
              </div>
            </div>
            {custom && <div className="grid mt-s" style={{ gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 8 }}>
              {DAYS.map((d, i) => (
                <label key={d} className="field" style={{ alignItems: 'center' }}>{d}
                  <select className="select" value={week[i]} onChange={(e) => { const w = [...week]; w[i] = Number(e.target.value); setWeek(w) }}>
                    {[0, 15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m ? `${m}m` : 'off'}</option>)}
                  </select>
                </label>
              ))}
            </div>}
            <label className="field mt">Your goal <span className="muted" style={{ fontWeight: 400 }}>(optional)</span><input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Land a Data Engineering job in 6 months" /></label>
            <label className="field mt">Anything about your experience? <span className="muted" style={{ fontWeight: 400 }}>(optional — only used to tailor AI feedback if you enable it)</span><input className="input" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="e.g. 2 years of SQL and Power BI, learning Python" /></label>
            <div className="row mt"><button className="btn" onClick={() => setStep(0)}>Back</button><span className="spacer" /><Skip onClick={() => finish(true)} label="Skip the rest & start" /><button className="btn primary lg" onClick={() => setStep(2)}>Next<Icon name="arrow" size={16} /></button></div>
          </div>
        )}

        {step === 2 && (
          <div className="card">
            <h1>What have you already studied?</h1>
            <p className="dim">Optional. Mark what you've covered so you don't restart from zero — those topics are flagged <b>"claimed"</b> until a short check confirms them. {background && 'We pre-filled a guess from your background.'}</p>
            <div className="col mt" style={{ gap: 16 }}>
              {tracks.filter((t) => t.modules.some((m) => m.topics.length)).map((t) => (
                <div key={t.id}>
                  <div className="row mb-s"><span className="dot" style={{ background: t.color }} /><b>{t.title}</b><span className="spacer" />
                    <span className="muted tiny">set all:</span>
                    {(['none', 'some', 'confident'] as Prior[]).map((v) => <button key={v} className="btn sm ghost" onClick={() => setPrior({ ...prior, ...Object.fromEntries(t.modules.map((m) => [m.id, v])) })}>{v === 'none' ? 'new' : v}</button>)}
                  </div>
                  <div className="grid g2" style={{ gap: 6 }}>
                    {t.modules.filter((m) => m.topics.length).map((m) => (
                      <div key={m.id} className="row nowrap" style={{ justifyContent: 'space-between', padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 9 }}>
                        <span className="small" style={{ minWidth: 0 }}>{m.title}</span>
                        <Seg options={[{ id: 'none', label: 'New' }, { id: 'some', label: 'Some' }, { id: 'confident', label: 'Confident' }]} value={priorFor(m.id)} onChange={(v) => setPrior({ ...prior, [m.id]: v as Prior })} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="row mt"><button className="btn" onClick={() => setStep(1)}>Back</button><span className="spacer" />
              <Skip onClick={() => finish(false)} label="Skip — start everything as new" />
              <button className="btn primary lg" disabled={saving} onClick={() => finish(true)}>{saving ? <span className="spin" /> : <Icon name="rocket" size={16} />}Start learning</button></div>
          </div>
        )}
      </div>
    </div>
  )
}
