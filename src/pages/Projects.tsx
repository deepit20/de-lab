import { lazy, Suspense, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ProjectWork } from '../db'
import { loadProjects, topicById, trackById } from '../content'
import type { ProjectDef } from '../types'
import { go, useLearner, useStudyClock } from '../lib/hooks'
import { runPython, runSql, type PyResult, type SqlResult } from '../lib/engines'
import { ago } from '../lib/util'
import { Bar, Empty, Html, Icon, Level, Loading, Markdown, ResultTable, Seg, Tabs, toast } from '../components/ui'
import DagView from '../components/DagView'

const CodeEditor = lazy(() => import('../components/CodeEditor'))
const LEVEL_INFO: Record<string, string> = { guided: 'Explanations and step-by-step guidance.', independent: 'Requirements only — you design the solution.', production: 'Realistic constraints: quality, orchestration, recovery, logging, docs.' }

export default function Projects({ id }: { id?: string }) {
  const [defs, setDefs] = useState<ProjectDef[] | null>(null)
  const works = useLiveQuery(() => db.projects.toArray(), [], [])
  useEffect(() => { loadProjects().then(setDefs) }, [])
  if (!defs) return <Loading />
  if (id) { const d = defs.find((x) => x.id === id); return d ? <ProjectPage def={d} /> : <div className="page"><Empty title="Project not found" /></div> }
  return (
    <div className="page">
      <div className="page-head"><div><h1>Projects</h1><p>Where separate skills become end-to-end ability. Move from guided builds to production-style systems you can defend in interviews.</p></div></div>
      {(['guided', 'independent', 'production'] as const).map((lvl) => (
        <div key={lvl} className="mb">
          <h2 style={{ textTransform: 'capitalize' }}>{lvl}</h2><p className="dim small">{LEVEL_INFO[lvl]}</p>
          <div className="grid g2">{defs.filter((d) => d.level === lvl).map((d) => {
            const w = works.find((x) => x.id === d.id)
            const done = w ? d.milestones.filter((m) => w.milestones[m.id]).length : 0
            return (
              <div key={d.id} className="card" style={{ cursor: 'pointer' }} onClick={() => go(`/projects/${d.id}`)}>
                <div className="row mb-s">{d.tracks.map((t) => <span key={t} className="badge" style={{ color: trackById[t]?.color }}>{trackById[t]?.short}</span>)}<span className="spacer" /><span className="muted tiny">~{d.hours}h</span>{w && <span className={`badge ${w.status === 'done' ? 'good' : 'accent'}`}>{w.status}</span>}</div>
                <h3>{d.title}</h3><p className="dim small">{d.summary}</p>
                {w && <><Bar value={done / d.milestones.length} color="var(--good)" /><div className="muted tiny mt-s">{done}/{d.milestones.length} milestones · updated {ago(w.updatedAt)}</div></>}
              </div>
            )
          })}</div>
        </div>
      ))}
    </div>
  )
}

function ProjectPage({ def }: { def: ProjectDef }) {
  const work = useLiveQuery(() => db.projects.get(def.id), [def.id])
  const { comps } = useLearner()
  const [tab, setTab] = useState<'brief' | 'build' | 'design' | 'review'>('brief')
  useStudyClock('project', def.topics[0], def.id)
  const start = async () => {
    const w: ProjectWork = { id: def.id, status: 'active', milestones: {}, files: { ...(def.starter || { 'pipeline.py': '# Your pipeline code\n' }) }, design: '', reflection: '', rubric: {}, log: [{ at: Date.now(), text: 'Project started' }], startedAt: Date.now(), updatedAt: Date.now() }
    await db.projects.put(w); setTab('build')
  }
  const patch = async (p: Partial<ProjectWork>) => { if (work) await db.projects.put({ ...work, ...p, updatedAt: Date.now() }) }
  const toggleMs = async (mid: string) => {
    if (!work) return
    const on = !work.milestones[mid]
    await patch({ milestones: { ...work.milestones, [mid]: on }, log: [...work.log, { at: Date.now(), text: `${on ? 'Completed' : 'Reopened'}: ${def.milestones.find((m) => m.id === mid)?.title}` }] })
    if (on) for (const t of def.topics) await db.evidence.add({ topicId: t, itemId: `${def.id}:${mid}`, dim: 'apply', score: def.level === 'guided' ? 0.7 : 1, hints: def.level === 'guided' ? 1 : 0, independent: def.level !== 'guided', source: 'project', at: Date.now() })
  }
  const done = work ? def.milestones.filter((m) => work.milestones[m.id]).length : 0
  return (
    <div className="page">
      <div className="crumbs"><a href="#/projects">Projects</a> / {def.level}</div>
      <div className="page-head">
        <div><h1>{def.title}</h1><div className="row">{def.tracks.map((t) => <span key={t} className="badge">{trackById[t]?.title}</span>)}<span className="badge accent">{def.level}</span><span className="muted small">~{def.hours} hours</span></div></div>
        {!work ? <button className="btn primary lg" onClick={start}><Icon name="rocket" size={16} />Start project</button> : (
          <div className="row"><div style={{ width: 200 }}><Bar value={done / def.milestones.length} color="var(--good)" /><div className="muted tiny mt-s">{done}/{def.milestones.length} milestones</div></div>
            <select className="select" style={{ width: 120 }} value={work.status} onChange={(e) => patch({ status: e.target.value as any })}><option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option></select></div>
        )}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'brief', label: 'Brief & milestones', icon: 'flag' }, { id: 'build', label: 'Workspace', icon: 'code' }, { id: 'design', label: 'Design doc & log', icon: 'note' }, { id: 'review', label: 'Self-review & defence', icon: 'mic' }]} />
      {tab === 'brief' && (
        <div className="topic-layout">
          <div className="col" style={{ minWidth: 0 }}>
            <div className="card"><Html html={def.brief} /></div>
            <div className="card"><h3><Icon name="flag" />Milestones</h3>
              {def.milestones.map((m, i) => (
                <div key={m.id} className="plan-item mb-s" style={{ alignItems: 'flex-start' }}>
                  <button className={`check ${work?.milestones[m.id] ? 'on' : ''}`} disabled={!work} onClick={() => toggleMs(m.id)}>{work?.milestones[m.id] && <Icon name="check" size={13} stroke={3} />}</button>
                  <div style={{ flex: 1, minWidth: 0 }}><b>{i + 1}. {m.title}</b><Html html={m.detail} className="prose small" />
                    {m.hints.length > 0 && <details><summary className="small" style={{ cursor: 'pointer' }}>Guidance ({m.hints.length})</summary><ul className="small">{m.hints.map((h, k) => <li key={k} dangerouslySetInnerHTML={{ __html: h }} />)}</ul></details>}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="col">
            <div className="card tight"><div className="step-kind mb-s">Skills practised</div><div className="row" style={{ gap: 4 }}>{def.skills.map((s) => <span key={s} className="badge">{s}</span>)}</div></div>
            <div className="card tight"><div className="step-kind mb-s">Related topics</div>{def.topics.map((t) => <div key={t} className="row small mb-s"><a href={`#/topic/${t}`} style={{ flex: 1 }}>{topicById[t]?.title}</a>{comps && <Level level={comps[t]?.level ?? 0} />}</div>)}</div>
            <div className="card tight"><div className="step-kind mb-s">Deliverables</div><ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{def.deliverables.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
          </div>
        </div>
      )}
      {tab === 'build' && (work ? <Workspace work={work} patch={patch} /> : <Empty title="Start the project to open its workspace" />)}
      {tab === 'design' && (work ? <DesignTab work={work} patch={patch} /> : <Empty title="Start the project first" />)}
      {tab === 'review' && (work ? <ReviewTab def={def} work={work} patch={patch} /> : <Empty title="Start the project first" />)}
    </div>
  )
}

function Workspace({ work, patch }: { work: ProjectWork; patch: (p: Partial<ProjectWork>) => Promise<void> }) {
  const names = Object.keys(work.files)
  const [file, setFile] = useState(names[0])
  const [code, setCode] = useState(work.files[names[0]] || '')
  const [py, setPy] = useState<PyResult | null>(null)
  const [sql, setSql] = useState<SqlResult | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setCode(work.files[file] ?? '') }, [file])
  useEffect(() => { const t = setTimeout(() => { if (work.files[file] !== code) patch({ files: { ...work.files, [file]: code } }) }, 800); return () => clearTimeout(t) }, [code])
  const isSql = file.endsWith('.sql')
  const run = async () => {
    setBusy(true); setErr(''); setPy(null); setSql(null)
    try {
      if (isSql) setSql(await runSql(code, { playground: true }))
      else {
        // make other project .py files importable as modules
        const mods = Object.entries(work.files).filter(([n]) => n.endsWith('.py') && n !== file).map(([n, c]) => `open(${JSON.stringify('/home/pyodide/' + n)}, "w").write(${JSON.stringify(c)}); sys.modules.pop(${JSON.stringify(n.replace(/\.py$/, ''))}, None)`).join('\n')
        setPy(await runPython((mods ? `import importlib, sys\n${mods}\nimportlib.invalidate_caches()\n` : '') + code, [], '', 60000))
      }
    } catch (e: any) { setErr(e.message) }
    setBusy(false)
  }
  const addFile = () => { const n = prompt('File name (e.g. transform.py, checks.sql, dag.py):'); if (n && !work.files[n]) { patch({ files: { ...work.files, [n]: '' } }); setFile(n) } }
  return (
    <div className="workspace">
      <div className="col" style={{ minWidth: 0 }}>
        <div className="row">{names.map((n) => <button key={n} className={`btn sm ${n === file ? 'primary' : ''}`} onClick={() => setFile(n)}>{n}</button>)}<button className="btn sm ghost" onClick={addFile}><Icon name="plus" size={13} />File</button></div>
        <div className="editor-shell"><div className="editor-bar"><code>{file}</code><span className="muted tiny">autosaved</span><span className="spacer" /><button className="btn sm primary" onClick={run} disabled={busy}>{busy ? <span className="spin" /> : <Icon name="play" size={13} />}Run</button></div>
          <Suspense fallback={<div style={{ minHeight: 420 }} />}><CodeEditor key={file} value={code} onChange={setCode} lang={isSql ? 'sql' : 'python'} onRun={run} errorLine={py?.line ?? null} minHeight={420} maxHeight={800} /></Suspense></div>
      </div>
      <div className="col" style={{ minWidth: 0 }}>
        <div className="output"><div className="output-head">Output</div><pre className="console" style={{ minHeight: 140 }}>{py?.stdout || (busy ? 'Running…' : 'Run a file to see output.')}</pre></div>
        {(err || (py && !py.ok)) && <div className="output"><div className="output-head">Error</div><pre className="console err-text">{err || py?.error}</pre></div>}
        {sql && <div className="output"><div className="output-head">{sql.total} rows</div><ResultTable columns={sql.columns} rows={sql.rows} total={sql.total} /></div>}
        {py?.dags?.length ? py.dags.map((d: any) => <DagView key={d.dag_id} dag={d} />) : null}
        {py?.review?.length ? <div className="card tight"><div className="step-kind mb-s">Engineering review</div>{py.review.map((r, i) => <div key={i} className="small">• Line {r.line}: {r.msg}</div>)}</div> : null}
        <div className="muted tiny">Files from /data are available. Other project .py files can be imported as modules. SQL files run against the playground database.</div>
      </div>
    </div>
  )
}

function DesignTab({ work, patch }: { work: ProjectWork; patch: (p: Partial<ProjectWork>) => Promise<void> }) {
  const [d, setD] = useState(work.design || '## Problem\n\n## Architecture\n(sources → ingestion → storage → transformation → serving)\n\n## Data model\n\n## Decisions & trade-offs\n| Decision | Options considered | Why |\n|---|---|---|\n\n## Data quality checks\n\n## Failure handling & recovery\n\n## What I would improve\n')
  const [prev, setPrev] = useState(false)
  const [entry, setEntry] = useState('')
  return (
    <div className="topic-layout">
      <div className="card" style={{ minWidth: 0 }}>
        <div className="row mb-s"><h3 style={{ margin: 0 }}>Design document</h3><span className="spacer" /><Seg value={prev ? 'p' : 'e'} onChange={(v) => setPrev(v === 'p')} options={[{ id: 'e', label: 'Edit' }, { id: 'p', label: 'Preview' }]} /><button className="btn sm primary" onClick={() => { patch({ design: d }); toast('Saved') }}>Save</button></div>
        {prev ? <Markdown text={d} /> : <textarea className="textarea" rows={26} value={d} onChange={(e) => setD(e.target.value)} />}
      </div>
      <div className="card">
        <h3>Work log</h3>
        <div className="row nowrap mb-s"><input className="input" placeholder="What did you do / discover?" value={entry} onChange={(e) => setEntry(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && entry.trim()) { patch({ log: [...work.log, { at: Date.now(), text: entry.trim() }] }); setEntry('') } }} /></div>
        <div className="list" style={{ maxHeight: 520, overflowY: 'auto' }}>{[...work.log].reverse().map((l, i) => <div key={i} className="item small"><span className="muted tiny" style={{ width: 90, flex: 'none' }}>{new Date(l.at).toLocaleDateString()}</span>{l.text}</div>)}</div>
      </div>
    </div>
  )
}

function ReviewTab({ def, work, patch }: { def: ProjectDef; work: ProjectWork; patch: (p: Partial<ProjectWork>) => Promise<void> }) {
  const [refl, setRefl] = useState(work.reflection)
  const rubric = def.rubric.length ? def.rubric : [{ id: 'correct', label: 'Correctness', desc: 'Produces the right data for all cases' }, { id: 'quality', label: 'Data quality', desc: 'Validates inputs, handles bad records' }, { id: 'reliability', label: 'Reliability', desc: 'Idempotent, retries, recoverable' }, { id: 'code', label: 'Code quality', desc: 'Readable, modular, tested' }, { id: 'docs', label: 'Documentation', desc: 'Someone else could run and understand it' }]
  const avg = rubric.length ? rubric.reduce((s, r) => s + (work.rubric[r.id] || 0), 0) / rubric.length : 0
  return (
    <div className="grid g2">
      <div className="card">
        <h3>Self-assessment rubric</h3><p className="dim small">Score honestly (1 = missing, 5 = production-ready). Low scores are your improvement plan.</p>
        {rubric.map((r) => (
          <div key={r.id} className="mb-s">
            <div className="row"><b className="small" style={{ flex: 1 }}>{r.label}</b><div className="seg">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={work.rubric[r.id] === n ? 'on' : ''} onClick={() => patch({ rubric: { ...work.rubric, [r.id]: n } })}>{n}</button>)}</div></div>
            <div className="muted tiny">{r.desc}</div>
          </div>
        ))}
        <div className="row mt"><b>Average: {avg.toFixed(1)} / 5</b></div>
        <label className="field mt">Reflection — what was hard, what would you change?<textarea className="textarea" rows={6} value={refl} onChange={(e) => setRefl(e.target.value)} onBlur={() => patch({ reflection: refl })} /></label>
      </div>
      <div className="card">
        <h3><Icon name="mic" />Project defence</h3><p className="dim small">Interviewers will ask you to explain this project. Practise these out loud or in writing.</p>
        <ol className="small">{def.defence.map((q, i) => <li key={i} style={{ marginBottom: 6 }}>{q}</li>)}</ol>
        <a className="btn primary" href={`#/interview/mock?defence=${def.id}`}>Start a project-defence round</a>
      </div>
    </div>
  )
}
