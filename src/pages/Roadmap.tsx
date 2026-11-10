import { useEffect, useState } from 'react'
import { tracks, trackById, topicById, loadProjects } from '../content'
import { go, useLearner } from '../lib/hooks'
import { levelColor } from '../lib/competency'
import { Bar, Icon, Level, Loading } from '../components/ui'
import type { ProjectDef } from '../types'

export default function Roadmap({ trackId }: { trackId?: string }) {
  const { comps, progress, ready } = useLearner()
  const [projects, setProjects] = useState<ProjectDef[]>([])
  useEffect(() => { loadProjects().then(setProjects) }, [])
  if (!ready || !comps) return <Loading />
  const track = trackId ? trackById[trackId] : undefined

  if (!track) return (
    <div className="page">
      <div className="page-head"><div><h1>Learning roadmap</h1><p>Ten tracks in a deliberate order — each builds on the last. You can jump anywhere; prerequisites are shown, never forced.</p></div></div>
      <div className="grid g-auto">
        {tracks.map((t) => {
          const ts = t.modules.flatMap((m) => m.topics)
          const ind = ts.filter((x) => comps[x.id].level >= 4).length
          const st = ts.filter((x) => comps[x.id].level >= 1).length
          const cur = ts.find((x) => progress[x.id]?.status === 'in_progress')
          return (
            <div key={t.id} className="card track-card" style={{ ['--c' as any]: t.color }} onClick={() => go(`/learn/${t.id}`)}>
              <div className="row"><span className="track-num">{String(t.order).padStart(2, '0')}</span><span className="spacer" /><span className="plan-ico" style={{ background: `color-mix(in srgb, ${t.color} 15%, transparent)`, color: t.color }}><Icon name={t.icon} /></span></div>
              <div><h3 style={{ marginBottom: 4 }}>{t.title}</h3><div className="dim small">{t.description}</div></div>
              {ts.length > 0 ? <>
                <div className="mini-bars" title="Each bar is a topic, coloured by level">{ts.map((x) => <i key={x.id} style={{ background: levelColor(comps[x.id].level) }} />)}</div>
                <div className="muted tiny">{t.modules.length} modules · {ts.length} topics · {st} studied · {ind} independent{cur ? ` · in progress: ${cur.title}` : ''}</div>
              </> : <div className="muted tiny">{t.modules.reduce((a, m) => a + m.projects.length, 0)} projects across 3 levels</div>}
            </div>
          )
        })}
      </div>
    </div>
  )

  const all = track.modules.flatMap((m) => m.topics)
  return (
    <div className="page">
      <div className="crumbs"><a href="#/learn">Roadmap</a> / {track.title}</div>
      <div className="page-head">
        <div><h1 className="row"><span className="dot" style={{ background: track.color, width: 12, height: 12 }} />{track.title}</h1><p>{track.description}</p><p className="small muted" style={{ marginTop: 6 }}><b>Why it matters:</b> {track.why}</p></div>
        {all.length > 0 && <div className="card tight" style={{ minWidth: 220 }}><div className="small muted">Independent</div><div className="row"><b style={{ fontSize: 20 }}>{all.filter((x) => comps[x.id].level >= 4).length}/{all.length}</b></div><Bar value={all.filter((x) => comps[x.id].level >= 4).length / all.length} color="var(--lv4)" /></div>}
      </div>
      <div className="row mb" style={{ gap: 6 }}>{tracks.map((t) => <button key={t.id} className={`btn sm ${t.id === track.id ? 'primary' : 'ghost'}`} onClick={() => go(`/learn/${t.id}`)}>{t.short}</button>)}</div>
      {track.modules.map((m, mi) => (
        <div key={m.id} className="card module-block">
          <div className="row mb-s"><span className="track-num">MODULE {mi + 1}</span><h3 style={{ margin: 0 }}>{m.title}</h3></div>
          {m.summary && <div className="dim small mb-s">{m.summary}</div>}
          {m.topics.map((t) => {
            const c = comps[t.id]
            const missing = t.prereqs.filter((p) => (comps[p]?.level ?? 0) < 1 && !progress[p]?.prior)
            return (
              <div key={t.id} className={`topic-row ${missing.length ? 'locked' : ''}`} onClick={() => go(`/topic/${t.id}`)}>
                <span className="dot" style={{ background: levelColor(c.level), width: 10, height: 10 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{t.title}</div>
                  <div className="meta">
                    ~{t.minutes} min · {t.kind === 'code' ? 'coding' : t.kind}{t.complexity === 3 ? ' · advanced' : t.complexity === 2 ? ' · intermediate' : ''}
                    {t.n.ex ? ` · ${t.n.ex} exercises` : ''}{t.authored === 'outline' ? ' · outline notes' : ''}
                    {missing.length > 0 && <> · <Icon name="lock" size={11} /> builds on {missing.map((p) => topicById[p]?.title).join(', ')}</>}
                  </div>
                </div>
                {progress[t.id]?.status === 'in_progress' && <span className="badge accent">In progress</span>}
                <Level level={c.level} label={c.label} />
              </div>
            )
          })}
          {m.projects.length > 0 && <div className="grid g2">{m.projects.map((pid) => { const p = projects.find((x) => x.id === pid); return p ? (
            <div key={pid} className="card flat tight" style={{ cursor: 'pointer' }} onClick={() => go(`/projects/${pid}`)}>
              <div className="row"><span className="badge accent">{p.level}</span><span className="muted tiny">~{p.hours}h</span></div>
              <b className="mt-s" style={{ display: 'block' }}>{p.title}</b><div className="dim small">{p.summary}</div>
            </div>) : null })}</div>}
        </div>
      ))}
    </div>
  )
}
