import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise as Ex } from '../types'
import { gradeSql, runPython, runSql, sqlSchema, pyWorker, type PyResult, type SqlGrade, type SqlResult } from '../lib/engines'
import { explainPyError, explainSqlError, reviewSql } from '../lib/explain'
import { recordExercise, addMistake } from '../lib/record'
import { aiEnabled, socraticHint } from '../lib/ai'
import { Diff, Html, Icon, KindBadge, Markdown, Modal, ResultTable, toast } from './ui'
import DagView from './DagView'
import SchemaPanel, { type SchemaTable } from './SchemaPanel'
import type { EditorApi } from './CodeEditor'
import { db } from '../db'

const CodeEditor = lazy(() => import('./CodeEditor'))
const tableCache = new Map<string, Promise<SchemaTable[]>>()
const loadTables = (setup: string) => { if (!tableCache.has(setup)) tableCache.set(setup, sqlSchema(false, setup)); return tableCache.get(setup)! }
const draftKey = (id: string) => `draft:${id}`

export type ExMode = 'learn' | 'practice' | 'timed' | 'interview' | 'revision'

export default function Exercise({ ex, mode = 'practice', onDone, compact }: { ex: Ex; mode?: ExMode; onDone?: (passed: boolean) => void; compact?: boolean }) {
  const strict = mode === 'timed' || mode === 'interview'
  const [code, setCode] = useState(() => { try { return localStorage.getItem(draftKey(ex.id)) ?? ex.starter } catch { return ex.starter } })
  const [busy, setBusy] = useState<'' | 'run' | 'check'>('')
  const [status, setStatus] = useState('')
  const [sqlRes, setSqlRes] = useState<SqlResult | null>(null)
  const [grade, setGrade] = useState<SqlGrade | null>(null)
  const [py, setPy] = useState<PyResult | null>(null)
  const [err, setErr] = useState<string>('')
  const [hints, setHints] = useState(0)
  const [aiHints, setAiHints] = useState<string[]>([])
  const [fails, setFails] = useState(0)
  const [passed, setPassed] = useState<boolean | null>(null)
  const [showSol, setShowSol] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [mcq, setMcq] = useState<number | null>(null)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [mistakeOpen, setMistakeOpen] = useState(false)
  const [hasAI, setHasAI] = useState(false)
  const [schema, setSchema] = useState<Record<string, string[]> | undefined>()
  const [solvedBefore, setSolvedBefore] = useState(false)
  const t0 = useRef(Date.now())
  const isCode = ex.lang === 'sql' || ex.lang === 'python'

  useEffect(() => { aiEnabled().then(setHasAI); db.attempts.where('exerciseId').equals(ex.id).toArray().then((a) => setSolvedBefore(a.some((x) => x.passed))) }, [ex.id])
  useEffect(() => { try { localStorage.setItem(draftKey(ex.id), code) } catch { /* ignore */ } }, [code, ex.id])
  useEffect(() => {
    if (ex.lang === 'sql') loadTables(ex.setup).then((t) => { setTables(t); setSchema(Object.fromEntries(t.map((x) => [x.name, x.cols.map((c) => c.name)]))) }).catch(() => {})
    if (ex.lang === 'python') return pyWorker.onStatus(setStatus)
  }, [ex.lang, ex.setup])
  const [tables, setTables] = useState<SchemaTable[]>([])
  const [showTables, setShowTablesState] = useState(() => { try { return localStorage.getItem('show-tables') !== '0' } catch { return true } })
  const setShowTables = (v: boolean) => { setShowTablesState(v); try { localStorage.setItem('show-tables', v ? '1' : '0') } catch { /* ignore */ } }
  const editorApi = useRef<EditorApi | null>(null)
  const relevant = useMemo(() => tables.map((t) => t.name).filter((n) => new RegExp(`\\b${n}\\b`, 'i').test(ex.solution + ' ' + ex.starter)), [tables, ex.id])

  const hintsUnlocked = !strict && (fails > 0 || hints > 0 || mode === 'revision' || Date.now() - t0.current > 90000)
  const canReveal = !strict && (fails >= 2 || hints >= ex.hints.length) && ex.solution
  const review = useMemo(() => (ex.lang === 'sql' && (grade || sqlRes) ? reviewSql(code) : []), [grade, sqlRes, code, ex.lang])

  async function run() {
    setBusy('run'); setErr(''); setGrade(null)
    try {
      if (ex.lang === 'sql') { setSqlRes(await runSql(code, { setup: ex.setup, explain: true })) }
      else { const r = await runPython(code, ex.tests.filter((t) => !t.hidden), ''); setPy(r) }
    } catch (e: any) { setErr(e.message); setSqlRes(null); setPy(null) }
    setBusy('')
  }

  async function check() {
    setBusy('check'); setErr('')
    const ms = Date.now() - t0.current
    let ok = false, score = 0
    const feedback: string[] = []
    let error: string | undefined
    try {
      if (ex.lang === 'sql') {
        const g = await gradeSql(code, ex)
        setGrade(g); setSqlRes(g.mine || null)
        ok = g.ok; score = g.ok ? 1 : 0; feedback.push(...g.feedback); if (g.error) { error = g.error; setErr(g.error) }
      } else if (ex.lang === 'python') {
        const r = await runPython(code, ex.tests, ex.check)
        setPy(r)
        if (!r.ok) { error = r.error || 'error' }
        const total = r.tests.length + (r.check ? 1 : 0) + (ex.stdout != null ? 1 : 0)
        let good = r.tests.filter((t) => t.ok).length + (r.check?.ok ? 1 : 0)
        if (ex.stdout != null) { const want = ex.stdout.trim().split('\n').map((l) => l.trimEnd()).join('\n'); const got = r.stdout.trim().split('\n').map((l) => l.trimEnd()).join('\n'); if (want === got) good++; else feedback.push('Printed output does not match the expected output.') }
        score = total ? good / total : r.ok ? 1 : 0
        ok = r.ok && score === 1
      } else if (ex.lang === 'mcq') {
        ok = mcq === ex.answer; score = ok ? 1 : 0
      } else {
        const n = ex.review.length || 1
        score = Object.values(checked).filter(Boolean).length / n
        ok = score >= 0.7
      }
    } catch (e: any) { setErr(e.message); error = e.message }
    const h = hints + aiHints.length + (revealed ? 3 : 0)
    await recordExercise(ex, { code: ex.lang === 'mcq' ? String(mcq) : code, passed: ok, score, hints: h, ms, mode, feedback, error })
    setPassed(ok)
    if (!ok) setFails((f) => f + 1)
    if (ok) { toast(h === 0 ? 'Solved independently — strong evidence of skill.' : 'Solved — try it again later without hints to prove independence.'); onDone?.(true) }
    setBusy('')
  }

  async function aiNudge() {
    try {
      const fb = err || grade?.feedback.join(' ') || py?.error || py?.tests.filter((t) => !t.ok).map((t) => `${t.label}: got ${t.got} expected ${t.expected}`).join('; ') || ''
      const h = await socraticHint(ex.prompt.replace(/<[^>]+>/g, ' '), code, fb, [...ex.hints.slice(0, hints), ...aiHints])
      setAiHints((a) => [...a, h])
    } catch (e: any) { toast(e.message) }
  }

  const pyHelp = py && !py.ok ? explainPyError(py.etype, py.error || '') : err ? explainPyError(null, err) : null
  const sqlHelp = ex.lang === 'sql' && (err || grade?.error) ? explainSqlError(err || grade?.error || '') : null

  return (
    <div className="card" style={compact ? { boxShadow: 'none' } : undefined}>
      <div className="row mb-s">
        <span className="badge outline">{ex.lang === 'sql' ? 'SQL' : ex.lang === 'python' ? 'Python' : ex.lang === 'mcq' ? 'Choice' : 'Written'}</span>
        <KindBadge kind={ex.kind} /><Diff d={ex.difficulty} />
        {ex.interview && <span className="badge accent">Interview-style</span>}
        {solvedBefore && <span className="badge good" title="Re-solving a problem you have seen counts as weaker evidence">Solved before</span>}
        <span className="spacer" />
        <span className="muted tiny">~{ex.minutes} min</span>
      </div>
      <h3 style={{ marginBottom: 6 }}>{ex.title}</h3>
      <Html html={ex.prompt} className="prose" />

      {ex.lang === 'mcq' && ex.choices && (
        <div className="mt-s">
          {ex.choices.map((c, i) => (
            <button key={i} className={`quiz-opt ${passed !== null ? (i === ex.answer ? 'right' : mcq === i ? 'wrong' : '') : mcq === i ? 'sel' : ''}`} onClick={() => passed === null && setMcq(i)}>
              <span className="letter">{String.fromCharCode(65 + i)}</span><span dangerouslySetInnerHTML={{ __html: c }} />
            </button>
          ))}
        </div>
      )}

      {ex.lang === 'text' && (
        <div className="col mt-s">
          <textarea className="textarea" rows={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Think it through and write your answer — structure it like you would in an interview." />
          {revealed && ex.review.length > 0 && (
            <div className="card flat tight">
              <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Self-check: tick what your answer genuinely covered</div>
              {ex.review.map((r, i) => <label key={i} className="row small" style={{ gap: 8, marginBottom: 4 }}><input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })} />{r}</label>)}
            </div>
          )}
        </div>
      )}

      {isCode && (
        <div className={`mt-s ${ex.lang === 'sql' && showTables ? 'sql-workbench' : ''}`}>
          <div className="editor-shell">
            <div className="editor-bar">
              <span className="muted">{ex.lang === 'sql' ? 'SQLite practice DB' : 'Python 3 (Pyodide) · files in /data'}</span>
              <span className="spacer" />
              <span className="muted tiny"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> run</span>
              {ex.lang === 'sql' && <button className={`btn sm ${showTables ? 'ghost' : ''}`} onClick={() => setShowTables(!showTables)} title="Show the tables you can query"><Icon name="database" size={14} />{showTables ? 'Hide tables' : 'Show tables'}</button>}
              <button className="btn sm ghost" onClick={() => { if (confirm('Reset to the starter code?')) setCode(ex.starter) }} title="Reset"><Icon name="repeat" size={14} /></button>
            </div>
            <Suspense fallback={<div style={{ minHeight: 180 }} />}>
              <CodeEditor value={code} onChange={setCode} lang={ex.lang as 'sql' | 'python'} onRun={run} errorLine={py?.line ?? null} schema={schema} minHeight={compact ? 160 : 220} apiRef={editorApi} />
            </Suspense>
          </div>
          {ex.lang === 'sql' && showTables && (
            <SchemaPanel tables={tables} setup={ex.setup} highlight={strict ? [] : relevant} compact={compact} onInsert={(t) => { if (editorApi.current) editorApi.current.insert(t); else setCode(code + (code.endsWith(' ') || !code ? '' : ' ') + t) }} />
          )}
        </div>
      )}

      <div className="row mt-s">
        {isCode && <button className="btn" onClick={run} disabled={!!busy}>{busy === 'run' ? <span className="spin" /> : <Icon name="play" size={14} />}Run</button>}
        {ex.lang === 'text' && !revealed ? (
          <button className="btn primary" disabled={code.trim().length < 20} onClick={() => setRevealed(true)}><Icon name="eye" size={15} />Compare with model answer</button>
        ) : (
          <button className="btn primary" onClick={check} disabled={!!busy || (ex.lang === 'mcq' && (mcq === null || passed !== null))}>{busy === 'check' ? <span className="spin" /> : <Icon name="check" size={15} />}{ex.lang === 'text' ? 'Score my answer' : 'Submit'}</button>
        )}
        {!strict && ex.hints.length > 0 && (
          <button className="btn ghost" disabled={!hintsUnlocked || hints >= ex.hints.length} onClick={() => setHints((h) => h + 1)} title={hintsUnlocked ? 'Each hint lowers the evidence weight a little' : 'Try first — hints unlock after your first attempt or 90 seconds'}>
            <Icon name="bulb" size={15} />Hint {hints}/{ex.hints.length}{!hintsUnlocked && <Icon name="lock" size={12} />}
          </button>
        )}
        {!strict && hasAI && isCode && hintsUnlocked && <button className="btn ghost" onClick={aiNudge}><Icon name="sparkles" size={15} />Ask tutor</button>}
        {canReveal && !showSol && <button className="btn ghost" onClick={() => { if (confirm('Viewing the solution marks this attempt as assisted. Prefer one more try?')) { setShowSol(true); setRevealed(true) } }}><Icon name="eye" size={15} />Solution</button>}
        <span className="spacer" />
        {(passed === false || err) && !strict && <button className="btn sm ghost" onClick={() => setMistakeOpen(true)}><Icon name="flag" size={14} />Log mistake</button>}
      </div>
      {status && <div className="muted small mt-s row"><span className="spin" />{status}</div>}

      {!strict && hints > 0 && <div className="col mt-s">{ex.hints.slice(0, hints).map((h, i) => <div key={i} className="hint"><b>Hint {i + 1}:</b> <span dangerouslySetInnerHTML={{ __html: h }} /></div>)}</div>}
      {aiHints.map((h, i) => <div key={i} className="hint mt-s"><b>Tutor:</b> {h}</div>)}

      {passed !== null && (
        <div className={`verdict mt ${passed ? 'ok' : 'no'}`}>
          <Icon name={passed ? 'check' : 'x'} size={20} />
          <div className="col" style={{ gap: 4 }}>
            <b>{passed ? (hints + aiHints.length === 0 && !revealed ? 'Correct — solved independently.' : 'Correct (with help).') : 'Not quite yet.'}</b>
            {grade?.feedback.map((f, i) => <span key={i} className="small">{f}</span>)}
            {!passed && fails === 0 && !strict && <span className="small dim">Before changing code: what did you expect, and what did you get? Compare your result to the expected shape.</span>}
          </div>
        </div>
      )}

      {(err || (py && !py.ok)) && (
        <div className="output mt">
          <div className="output-head"><Icon name="alert" size={14} />Error{py?.line ? ` on line ${py.line}` : ''}</div>
          <pre className="console err-text">{err || py?.error}</pre>
          {(pyHelp || sqlHelp) && !strict && (
            <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)' }} className="small">
              {pyHelp && <><b>{pyHelp.title}.</b> {pyHelp.meaning}<ul style={{ margin: '6px 0', paddingLeft: 18 }}>{pyHelp.causes.map((c, i) => <li key={i}>{c}</li>)}</ul><span className="dim">Debug tip: {pyHelp.debug}</span></>}
              {sqlHelp && <><b>What this usually means:</b> {sqlHelp}</>}
            </div>
          )}
        </div>
      )}

      {ex.lang === 'sql' && sqlRes && !err && (
        <div className="output mt">
          <div className="output-head">Your result · {sqlRes.total} row(s) · {sqlRes.ms.toFixed(1)} ms{sqlRes.changes ? ` · ${sqlRes.changes} row(s) changed` : ''}</div>
          <ResultTable columns={sqlRes.columns} rows={sqlRes.rows} total={sqlRes.total} />
        </div>
      )}
      {ex.lang === 'sql' && grade && !grade.ok && grade.expected && !strict && (
        <details className="mt-s"><summary className="small" style={{ cursor: 'pointer' }}>Show the expected result shape ({grade.expected.total} rows: {grade.expected.columns.join(', ')})</summary>
          <div className="output mt-s"><ResultTable columns={grade.expected.columns} rows={grade.expected.rows.slice(0, fails >= 2 ? 200 : 3)} total={grade.expected.total} /></div>
          {fails < 2 && <div className="muted tiny">Only the first 3 rows are shown until your second attempt.</div>}
        </details>
      )}
      {ex.lang === 'sql' && (grade?.plan || sqlRes?.plan)?.length ? (
        <details className="mt-s"><summary className="small" style={{ cursor: 'pointer' }}>Query plan (EXPLAIN QUERY PLAN)</summary>
          <pre className="console small" style={{ margin: '6px 0', background: 'var(--code-bg)', padding: 10, borderRadius: 8 }}>{(grade?.plan || sqlRes?.plan)!.map((p) => `${p.detail}`).join('\n')}</pre>
          <div className="muted tiny">SCAN = reads every row; SEARCH … USING INDEX = jumps straight to matching rows; USE TEMP B-TREE = an extra sort step.</div>
        </details>
      ) : null}

      {ex.lang === 'python' && py && (
        <div className="output mt">
          <div className="output-head">Output · {py.ms.toFixed(0)} ms</div>
          {py.stdout ? <pre className="console">{py.stdout}</pre> : <div className="muted small" style={{ padding: 10 }}>(nothing printed)</div>}
          {py.tests.length > 0 && <div style={{ borderTop: '1px solid var(--line)' }}>
            {py.tests.map((t, i) => (
              <div key={i} className="test-row">
                <span style={{ color: t.ok ? 'var(--good)' : 'var(--bad)' }}>{t.ok ? '✔' : '✘'}</span>
                <div style={{ minWidth: 0 }}>
                  <div>{t.hidden ? <i>hidden test{t.label && t.label !== t.call ? ` — ${t.label}` : ''}</i> : t.label}</div>
                  {!t.ok && (!t.hidden || fails >= 1) && <div className="muted">{t.error ? t.error : `got ${t.got}  expected ${t.expected}`}</div>}
                </div>
              </div>
            ))}
          </div>}
          {py.check && <div className="test-row"><span style={{ color: py.check.ok ? 'var(--good)' : 'var(--bad)' }}>{py.check.ok ? '✔' : '✘'}</span><span>{py.check.ok ? 'All checks passed' : py.check.msg}</span></div>}
        </div>
      )}
      {py?.dags?.length > 0 && <div className="col mt">{py!.dags.map((d: any) => <DagView key={d.dag_id} dag={d} />)}</div>}

      {!strict && (review.length > 0 || (py?.review?.length ?? 0) > 0) && (
        <div className="card flat tight mt">
          <div className="small" style={{ fontWeight: 650, marginBottom: 4 }}>Engineering review</div>
          {review.map((r, i) => <div key={i} className="small" style={{ color: r.sev === 'warn' ? 'var(--warn)' : 'var(--text2)' }}>• {r.msg}</div>)}
          {py?.review.map((r, i) => <div key={i} className="small" style={{ color: r.sev === 'warn' ? 'var(--warn)' : 'var(--text2)' }}>• Line {r.line}: {r.msg}</div>)}
        </div>
      )}

      {(passed || showSol || (ex.lang === 'text' && revealed)) && (
        <div className="mt">
          {(showSol || ex.lang === 'text') && ex.solution && <>
            <div className="small" style={{ fontWeight: 650, marginBottom: 6 }}>{ex.lang === 'text' ? 'Model answer' : 'Reference solution'}</div>
            {ex.lang === 'text' ? <Markdown text={ex.solution} /> : <pre className="console" style={{ background: 'var(--code-bg)', padding: 12, borderRadius: 10, border: '1px solid var(--line)', fontSize: 13, overflowX: 'auto' }}>{ex.solution}</pre>}
          </>}
          {passed && ex.lang !== 'text' && ex.solution && !showSol && <details className="mt-s"><summary className="small" style={{ cursor: 'pointer' }}>Compare with the reference solution</summary><pre className="console" style={{ background: 'var(--code-bg)', padding: 12, borderRadius: 10, fontSize: 13, overflowX: 'auto' }}>{ex.solution}</pre></details>}
          {ex.explain && <div className="mt-s"><Html html={ex.explain} /></div>}
        </div>
      )}
      <MistakeModal open={mistakeOpen} onClose={() => setMistakeOpen(false)} ex={ex} code={code} error={err || py?.error || grade?.feedback.join(' ') || ''} />
    </div>
  )
}

export function MistakeModal({ open, onClose, ex, code, error, topicId }: { open: boolean; onClose: () => void; ex?: Ex; code?: string; error?: string; topicId?: string }) {
  const [f, setF] = useState({ category: 'logic', title: '', what: '', wrong: '', correct: '', lesson: '' })
  useEffect(() => { if (open) setF({ category: error && /Error|error/.test(error) ? 'syntax' : 'logic', title: ex ? `${ex.title}` : '', what: error ? error.split('\n').slice(-3).join(' ').slice(0, 300) : '', wrong: '', correct: '', lesson: '' }) }, [open])
  const save = async () => {
    await addMistake({ topicId: ex?.topic || topicId, exerciseId: ex?.id, category: f.category as any, title: f.title || 'Mistake', what: f.what, wrong: f.wrong, correct: f.correct, lesson: f.lesson, code })
    toast('Saved to your mistake journal — it will come back in revision.')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose}>
      <h2>Log a mistake</h2>
      <p className="dim small">Writing down the wrong assumption is one of the most effective ways to stop repeating it. It becomes a revision card.</p>
      <div className="col">
        <div className="row">
          <label className="field" style={{ flex: 1 }}>Title<input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="field">Type<select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['concept', 'syntax', 'logic', 'assumption', 'debugging', 'performance', 'interview'].map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <label className="field">What happened<textarea className="textarea" rows={2} value={f.what} onChange={(e) => setF({ ...f, what: e.target.value })} /></label>
        <label className="field">What I wrongly assumed<textarea className="textarea" rows={2} value={f.wrong} onChange={(e) => setF({ ...f, wrong: e.target.value })} placeholder="e.g. I thought COUNT(col) counts NULLs" /></label>
        <label className="field">What is actually correct<textarea className="textarea" rows={2} value={f.correct} onChange={(e) => setF({ ...f, correct: e.target.value })} /></label>
        <label className="field">Lesson / how I'll catch it next time<textarea className="textarea" rows={2} value={f.lesson} onChange={(e) => setF({ ...f, lesson: e.target.value })} /></label>
        <div className="row"><span className="spacer" /><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={!f.wrong && !f.lesson}>Save</button></div>
      </div>
    </Modal>
  )
}
