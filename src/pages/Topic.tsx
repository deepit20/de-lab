import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { loadBank, loadTopic, topicById, trackById, dependents, topicsInOrder, topicIndex } from '../content'
import type { BankQ, TopicContent } from '../types'
import { DIM_LABEL } from '../types'
import { go, useExercises, useLearner, useStudyClock } from '../lib/hooks'
import { ensureFlashcards, touchTopic } from '../lib/record'
import { LEVEL_HINT } from '../lib/competency'
import { ago, pct } from '../lib/util'
import Exercise from '../components/Exercise'
import { QuizBlock, RecallBlock } from '../components/Checks'
import { HighlightableHtml } from '../components/NotesView'
import { NoteEditor, NoteList } from '../components/PersonalNotes'
import { TopicPdfButton } from '../components/PdfExport'
import { Bar, Diff, Empty, Html, Icon, KindBadge, Level, Loading, Seg, Tabs, toast } from '../components/ui'

type Tab = 'lesson' | 'notes' | 'practice' | 'mine' | 'interview' | 'progress'
const STEP_LABEL: Record<string, string> = { concept: 'Concept', example: 'Example', practice: 'Practise', check: 'Check', challenge: 'Harder', scenario: 'Real world', interview: 'Interview', summary: 'Summary' }

export default function Topic({ id, tab: tabParam }: { id: string; tab?: string }) {
  const meta = topicById[id]
  const [content, setContent] = useState<TopicContent | null>(null)
  const [tab, setTab] = useState<Tab>((tabParam as Tab) || 'lesson')
  const { comps, progress } = useLearner()
  const exercises = useExercises()
  const bookmarked = useLiveQuery(() => db.bookmarks.where('ref').equals(id).first(), [id])
  useStudyClock('learn', id)
  useEffect(() => { loadTopic(id).then(setContent).catch(() => setContent(null)) }, [id])
  useEffect(() => { if (tabParam) setTab(tabParam as Tab) }, [tabParam])
  if (!meta) return <div className="page"><Empty title="Topic not found" /></div>
  if (!content || !comps) return <Loading />
  const track = trackById[meta.track]
  const comp = comps[id]
  const hasLesson = content.lesson.length > 0
  const idx = topicIndex[id]
  const prev = topicsInOrder[idx - 1], next = topicsInOrder[idx + 1]
  const toggleBookmark = async () => {
    if (bookmarked) await db.bookmarks.delete(bookmarked.id!)
    else { await db.bookmarks.add({ kind: 'topic', ref: id, label: meta.title, topicId: id, at: Date.now() }); toast('Topic bookmarked') }
  }
  const setT = (t: Tab) => { setTab(t); history.replaceState(null, '', `#/topic/${id}/${t}`) }

  return (
    <div className="page">
      <div className="crumbs"><a href="#/learn">Roadmap</a> / <a href={`#/learn/${track.id}`}>{track.title}</a> / {track.modules.find((m) => m.id === meta.module)?.title}</div>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1>{meta.title}</h1>
          <div className="row" style={{ gap: 8 }}>
            <Level level={comp.level} label={comp.label} />
            <span className="badge outline">~{meta.minutes} min</span>
            <span className="badge outline">{meta.kind === 'code' ? 'Coding topic' : meta.kind === 'design' ? 'Design topic' : 'Concept topic'}</span>
            <Diff d={meta.complexity} />
            {meta.prereqs.length > 0 && <span className="muted small">Builds on: {meta.prereqs.map((p, i) => <span key={p}>{i ? ', ' : ''}<a href={`#/topic/${p}`}>{topicById[p]?.title}</a></span>)}</span>}
          </div>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={toggleBookmark}><Icon name="bookmark" size={15} stroke={bookmarked ? 3 : 1.8} />{bookmarked ? 'Bookmarked' : 'Bookmark'}</button>
          {prev && <button className="btn ghost" title={prev.title} onClick={() => go(`/topic/${prev.id}`)}><Icon name="back" size={15} /></button>}
          {next && <button className="btn ghost" title={next.title} onClick={() => go(`/topic/${next.id}`)}><Icon name="arrow" size={15} /></button>}
        </div>
      </div>
      <Tabs value={tab} onChange={setT} tabs={[
        { id: 'lesson', label: 'Lesson', icon: 'play' }, { id: 'notes', label: 'Notes', icon: 'book' }, { id: 'practice', label: `Practice${content.exercises.length ? ` (${content.exercises.length})` : ''}`, icon: 'code' },
        { id: 'mine', label: 'My notes', icon: 'edit' }, { id: 'interview', label: 'Interview', icon: 'mic' }, { id: 'progress', label: 'My level', icon: 'target' },
      ]} />
      {tab === 'lesson' && (hasLesson ? <Lesson id={id} content={content} exercises={exercises} startStep={progress[id]?.step || 0} onFinish={() => setT('practice')} /> : <NoLesson content={content} onNotes={() => setT('notes')} />)}
      {tab === 'notes' && <NotesTab id={id} content={content} />}
      {tab === 'practice' && <PracticeTab id={id} content={content} exercises={exercises} />}
      {tab === 'mine' && <MineTab id={id} />}
      {tab === 'interview' && <InterviewTab id={id} />}
      {tab === 'progress' && <ProgressTab id={id} />}
    </div>
  )
}

function NoLesson({ content, onNotes }: { content: TopicContent; onNotes: () => void }) {
  return (
    <div className="card">
      <h3>Study guide</h3>
      <p className="dim">This topic has {content.crisp ? 'revision notes' : 'an outline'} but no step-by-step lesson yet. Study the key points, write your own explanation in <b>My notes</b>, then check yourself.</p>
      {content.crisp ? <Html html={content.crisp} /> : content.outlineHtml ? <Html html={content.outlineHtml} /> : null}
      <div className="row mt"><button className="btn primary" onClick={onNotes}>Open notes</button></div>
      {content.quiz.length > 0 && <div className="col mt">{content.quiz.map((q) => <QuizBlock key={q.id} q={q} topicId={content.id} />)}</div>}
    </div>
  )
}

function Lesson({ id, content, exercises, startStep, onFinish }: { id: string; content: TopicContent; exercises: any; startStep: number; onFinish: () => void }) {
  const steps = content.lesson
  const [step, setStep] = useState(Math.min(startStep, steps.length - 1))
  const [side, setSide] = useState(false)
  const prog = useLiveQuery(() => db.progress.get(id), [id])
  const done = new Set(prog?.stepsDone || [])
  useEffect(() => { touchTopic(id, { step }) }, [step, id])
  const s = steps[step]
  const complete = async () => {
    const stepsDone = [...new Set([...(prog?.stepsDone || []), step])]
    if (step < steps.length - 1) { await touchTopic(id, { stepsDone, step: step + 1 }); setStep(step + 1); document.getElementById('main')?.scrollTo({ top: 0, behavior: 'smooth' }) }
    else {
      await touchTopic(id, { stepsDone, status: 'studied', completedAt: Date.now() })
      const n = await ensureFlashcards(id)
      toast(`Lesson complete${n ? ` — ${n} flashcards added to revision` : ''}. Now prove it in Practice.`)
      onFinish()
    }
  }
  return (
    <div className={side ? 'topic-layout split' : ''}>
      <div style={{ minWidth: 0 }}>
        <div className="stepper">
          {steps.map((x, i) => <button key={i} className={`${i === step ? 'on' : ''} ${done.has(i) ? 'done' : ''}`} onClick={() => setStep(i)} title={x.title}><i /><span>{STEP_LABEL[x.kind] || x.kind}</span></button>)}
        </div>
        <div className="card">
          <div className="row mb-s"><span className="step-kind">Step {step + 1} of {steps.length} · {STEP_LABEL[s.kind] || s.kind}</span><span className="spacer" />
            <button className="btn sm ghost" onClick={() => setSide(!side)}><Icon name="sidebar" size={14} />{side ? 'Hide notes' : 'Notes beside me'}</button></div>
          <h2>{s.title}</h2>
          <div className="col" style={{ gap: 14 }}>
            {s.blocks.map((b, i) => {
              if (b.t === 'html') return <Html key={i} html={b.html} />
              if (b.t === 'exercise') { const ex = exercises?.[b.id]; return ex ? <Exercise key={b.id} ex={ex} mode="learn" compact /> : <Loading key={i} /> }
              if (b.t === 'quiz') { const q = content.quiz.find((x) => x.id === b.id); return q ? <QuizBlock key={b.id} q={q} topicId={id} /> : null }
              if (b.t === 'recall') { const r = content.recall.find((x) => x.id === b.id); return r ? <RecallBlock key={b.id} r={r} topicId={id} /> : null }
              return null
            })}
          </div>
          <div className="row mt">
            {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}><Icon name="back" size={15} />Back</button>}
            <span className="spacer" />
            <span className="muted small">Progress is saved — you can stop any time.</span>
            <button className="btn primary" onClick={complete}>{step < steps.length - 1 ? <>Continue<Icon name="arrow" size={15} /></> : <>Finish lesson<Icon name="check" size={15} /></>}</button>
          </div>
        </div>
      </div>
      {side && <div className="card" style={{ position: 'sticky', top: 70, maxHeight: '80vh', overflowY: 'auto' }}><div className="step-kind mb-s">Crisp notes</div><Html html={content.crisp || content.outlineHtml || '<p>No notes yet.</p>'} /></div>}
    </div>
  )
}

function NotesTab({ id, content }: { id: string; content: TopicContent }) {
  const avail = [content.detailed && 'detailed', content.crisp && 'crisp', content.memory && 'memory'].filter(Boolean) as string[]
  const [view, setView] = useState(avail[0] || 'outline')
  const [quote, setQuote] = useState<string | null>(null)
  const html = view === 'detailed' ? content.detailed : view === 'crisp' ? content.crisp : view === 'memory' ? content.memory : content.outlineHtml || ''
  const copy = async () => {
    const tmp = document.createElement('div'); tmp.innerHTML = html
    tmp.querySelectorAll('h2,h3').forEach((h) => (h.textContent = '\n## ' + h.textContent))
    tmp.querySelectorAll('li').forEach((li) => (li.textContent = '- ' + li.textContent))
    setQuote(tmp.innerText.replace(/\n{3,}/g, '\n\n').trim())
  }
  return (
    <div className="topic-layout">
      <div className="card" style={{ minWidth: 0 }}>
        <div className="row mb">
          <Seg value={view} onChange={setView} options={[...(content.detailed ? [{ id: 'detailed', label: 'Detailed' }] : []), ...(content.crisp ? [{ id: 'crisp', label: 'Crisp' }] : []), ...(content.memory ? [{ id: 'memory', label: 'Memory' }] : []), ...(!avail.length ? [{ id: 'outline', label: 'Outline' }] : [])]} />
          <span className="spacer" />
          <button className="btn sm ghost" onClick={copy} title="Make an editable copy in My notes"><Icon name="edit" size={14} />Customised copy</button>
          <TopicPdfButton topicId={id} defaultView={view} />
        </div>
        {quote !== null ? <NoteEditor topicId={id} initial={{ title: `${topicById[id].title} — my version`, body: quote, kind: quote.length > 600 ? 'copy' : 'note' }} onClose={() => setQuote(null)} /> : null}
        {!html && <Empty title="Notes for this topic are not written yet">Use the outline and your own notes for now.</Empty>}
        {html && <HighlightableHtml html={html} topicId={id} view={view} onAddNote={(q) => setQuote(`> ${q}\n\n`)} />}
        {view === 'memory' && content.flashcards.length > 0 && <div className="mt"><h3>Flashcards</h3><div className="grid g2">{content.flashcards.map((f) => <details key={f.id} className="memory-card"><summary style={{ cursor: 'pointer' }} dangerouslySetInnerHTML={{ __html: f.q }} /><div className="mt-s dim" dangerouslySetInnerHTML={{ __html: f.a }} /></details>)}</div></div>}
      </div>
      <div className="toc">
        {view === 'detailed' && content.toc.length > 0 && <div className="card tight"><div className="step-kind mb-s">On this page</div>{content.toc.filter((t) => t.depth >= 2).map((t) => <a key={t.id} className={t.depth === 3 ? 'd3' : ''} href={`#/topic/${id}/notes`} onClick={(e) => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' }) }}>{t.text}</a>)}</div>}
        <div className="card tight small dim"><b>Tip:</b> select any text to highlight it, bookmark it, or quote it into a personal note. Click a highlight to comment or delete it.</div>
        {(dependents[id] || []).length > 0 && <div className="card tight small"><div className="step-kind mb-s">Unlocks</div>{dependents[id].map((d) => <a key={d} href={`#/topic/${d}`} style={{ display: 'block' }}>{topicById[d]?.title}</a>)}</div>}
      </div>
    </div>
  )
}

function PracticeTab({ id, content, exercises }: { id: string; content: TopicContent; exercises: any }) {
  const attempts = useLiveQuery(() => db.attempts.where('topicId').equals(id).toArray(), [id], [])
  const [open, setOpen] = useState<string | null>(null)
  const list = content.exercises.map((e) => exercises?.[e]).filter(Boolean)
  const status = (eid: string) => { const a = attempts.filter((x) => x.exerciseId === eid); return a.some((x) => x.passed && x.hints === 0) ? 'indep' : a.some((x) => x.passed) ? 'helped' : a.length ? 'tried' : 'new' }
  const ex = open ? exercises?.[open] : null
  return (
    <div className="col" style={{ gap: 16 }}>
      {ex ? <><button className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(null)}><Icon name="back" size={15} />All exercises</button><Exercise key={ex.id} ex={ex} mode="practice" /></> : <>
        <div className="card">
          <div className="card-head"><h3><Icon name="code" />Exercises</h3><span className="muted small">Ordered from basic to advanced. Solving without hints counts most.</span></div>
          {list.length === 0 && <Empty title="No coding exercises for this topic yet">Use the checks below, the playground, or the interview questions.</Empty>}
          <div className="list">{list.sort((a: any, b: any) => a.difficulty - b.difficulty).map((e: any) => {
            const st = status(e.id)
            return (
              <div key={e.id} className="item click" onClick={() => setOpen(e.id)}>
                <span style={{ width: 18, color: st === 'indep' ? 'var(--good)' : st === 'helped' ? 'var(--warn)' : st === 'tried' ? 'var(--bad)' : 'var(--text3)' }}>{st === 'indep' ? '✔' : st === 'helped' ? '◐' : st === 'tried' ? '✘' : '○'}</span>
                <div style={{ flex: 1, minWidth: 0 }}><b className="small">{e.title}</b><div className="muted tiny">{st === 'indep' ? 'Solved independently' : st === 'helped' ? 'Solved with help — retry without hints' : st === 'tried' ? 'Not solved yet' : 'Not attempted'}</div></div>
                <KindBadge kind={e.kind} /><span className="badge outline">{e.lang}</span><Diff d={e.difficulty} />
              </div>
            )
          })}</div>
        </div>
        {(content.quiz.length > 0 || content.recall.length > 0) && <div className="card"><h3><Icon name="brain" />Concept checks</h3><div className="col">{content.quiz.map((q) => <QuizBlock key={q.id} q={q} topicId={id} />)}{content.recall.map((r) => <RecallBlock key={r.id} r={r} topicId={id} />)}</div></div>}
      </>}
    </div>
  )
}

function MineTab({ id }: { id: string }) {
  const mistakes = useLiveQuery(() => db.mistakes.where('topicId').equals(id).toArray(), [id], [])
  const hls = useLiveQuery(() => db.highlights.where('topicId').equals(id).toArray(), [id], [])
  return (
    <div className="topic-layout">
      <div style={{ minWidth: 0 }}><NoteList topicId={id} /></div>
      <div className="col">
        <div className="card tight"><div className="step-kind mb-s">Highlights ({hls.length})</div>{hls.length === 0 ? <div className="muted small">Select text in Notes to highlight.</div> : hls.map((h) => <div key={h.id} className="small mb-s"><mark className={`hl ${h.color === 'yellow' ? '' : h.color}`}>{h.text.slice(0, 140)}</mark>{h.comment && <div className="muted tiny">💬 {h.comment}</div>}</div>)}</div>
        <div className="card tight"><div className="step-kind mb-s">Mistakes ({mistakes.length})</div>{mistakes.length === 0 ? <div className="muted small">Mistakes you log on this topic appear here.</div> : mistakes.map((m) => <div key={m.id} className="small mb-s"><b>{m.title}</b><div className="dim">✘ {m.wrong}</div><div style={{ color: 'var(--good)' }}>✔ {m.correct}</div></div>)}<a className="small" href="#/notes/mistakes">Mistake journal →</a></div>
      </div>
    </div>
  )
}

function InterviewTab({ id }: { id: string }) {
  const [bank, setBank] = useState<BankQ[]>([])
  useEffect(() => { loadBank().then((b) => setBank(b.filter((q) => q.topic === id))) }, [id])
  return (
    <div className="card">
      <div className="card-head"><h3><Icon name="mic" />Interview questions on this topic</h3><a className="btn sm" href={`#/interview/mock?topic=${id}`}>Practise as a mock round</a></div>
      {bank.length === 0 && <Empty title="No topic-specific questions yet">Try the general question bank.</Empty>}
      <div className="col">{bank.map((q) => (
        <details key={q.id} className="card flat tight">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{q.q} <span className="badge outline">{q.type}</span></summary>
          <div className="mt-s small"><b>Key points:</b><ul>{q.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul></div>
          {q.answer && <Html html={q.answer} />}
          {q.followUps.length > 0 && <div className="small dim"><b>Likely follow-ups:</b> {q.followUps.join(' · ')}</div>}
        </details>
      ))}</div>
    </div>
  )
}

function ProgressTab({ id }: { id: string }) {
  const { comps } = useLearner()
  const ev = useLiveQuery(() => db.evidence.where('topicId').equals(id).reverse().sortBy('at'), [id], [])
  const c = comps?.[id]
  if (!c) return <Loading />
  return (
    <div className="grid g2">
      <div className="card">
        <div className="card-head"><h3>Current level</h3><Level level={c.level} label={c.label} /></div>
        <p className="dim small">{LEVEL_HINT[c.level]}</p>
        <div className="dimbars mt">
          {(['understand', 'explain', 'implement', 'debug', 'apply', 'interview'] as const).map((d) => (
            <div key={d} className="dimbar">
              <span>{DIM_LABEL[d]}{c.required.includes(d) && <b title="Required for this topic"> *</b>}</span>
              <div className="bar"><i style={{ width: pct(c.dims[d]), background: c.dims[d] >= c.threshold ? 'var(--lv4)' : 'var(--accent)' }} />{c.required.includes(d) && <span className="thr" style={{ left: pct(c.threshold) }} />}</div>
              <span className="muted tiny">{pct(c.dims[d])}</span>
            </div>
          ))}
        </div>
        <div className="muted tiny mt-s">* required for this topic · marker = target ({pct(c.threshold)}) · scores fade slowly without practice and recover with revision.</div>
        <div className="verdict info mt"><Icon name="arrow" /><div><b>Next:</b> {c.next}</div></div>
        <ul className="small dim mt-s">{c.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
      </div>
      <div className="card">
        <h3>Evidence log</h3>
        {ev.length === 0 ? <Empty title="No evidence yet">Answer checks, solve exercises, explain concepts.</Empty> :
          <div className="list" style={{ maxHeight: 480, overflowY: 'auto' }}>{ev.slice(0, 80).map((e) => (
            <div key={e.id} className="item small"><span className="badge">{DIM_LABEL[e.dim]}</span><span style={{ flex: 1 }} className="dim">{e.source}{e.hints ? ` · ${e.hints} hint(s)` : ''}</span><Bar value={e.score} /><span className="muted tiny" style={{ width: 80, textAlign: 'right' }}>{ago(e.at)}</span></div>
          ))}</div>}
      </div>
    </div>
  )
}
