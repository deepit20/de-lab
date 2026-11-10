import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import SchemaPanel from '../components/SchemaPanel'
import type { EditorApi } from '../components/CodeEditor'
import { pyFiles, pyRead, pyWorker, resetPlayground, runPython, runSql, sqlSchema, type PyResult, type SqlResult } from '../lib/engines'
import { explainPyError, explainSqlError, reviewSql } from '../lib/explain'
import { useLocalState, useStudyClock } from '../lib/hooks'
import { Icon, ResultTable, Seg, toast } from '../components/ui'
import DagView from '../components/DagView'

const CodeEditor = lazy(() => import('../components/CodeEditor'))

const SQL_SAMPLES: Record<string, string> = {
  'Explore orders': 'SELECT o.order_id, o.order_date, c.name, o.status, o.amount\nFROM orders o\nJOIN customers c ON c.customer_id = o.customer_id\nORDER BY o.order_date DESC\nLIMIT 20;',
  'Monthly revenue': "SELECT strftime('%Y-%m', order_date) AS month,\n       COUNT(*) AS orders,\n       ROUND(SUM(amount), 2) AS revenue\nFROM orders\nWHERE status <> 'cancelled'\nGROUP BY month\nORDER BY month;",
  'Window: running total': "SELECT sale_date, store_id, revenue,\n       SUM(revenue) OVER (PARTITION BY store_id ORDER BY sale_date) AS running_revenue\nFROM daily_sales\nORDER BY store_id, sale_date;",
  'Dedupe staging (latest per key)': 'WITH ranked AS (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC) AS rn\n  FROM stg_customers\n)\nSELECT * FROM ranked WHERE rn = 1;',
  'Create your own table': "CREATE TABLE IF NOT EXISTS my_events (id INTEGER PRIMARY KEY, kind TEXT, ts TEXT);\nINSERT INTO my_events (kind, ts) VALUES ('login', '2025-01-01 10:00:00'), ('click', '2025-01-01 10:01:00');\nSELECT * FROM my_events;",
}
const PY_SAMPLES: Record<string, string> = {
  'Read a CSV': 'import csv\n\nwith open("/data/orders.csv", newline="") as f:\n    rows = list(csv.DictReader(f))\n\nprint(len(rows), "orders")\nprint(rows[0])\n\nrevenue = sum(float(r["amount"]) for r in rows if r["status"] != "cancelled")\nprint(f"Revenue: {revenue:,.2f}")',
  'pandas basics': 'import pandas as pd\n\norders = pd.read_csv("/data/orders.csv", parse_dates=["order_date"])\nprint(orders.dtypes)\nmonthly = (orders[orders.status != "cancelled"]\n           .groupby(orders.order_date.dt.to_period("M"))["amount"].sum())\nprint(monthly.tail())',
  'PySpark (emulated)': 'from pyspark.sql import SparkSession, functions as F, Window\n\nspark = SparkSession.builder.appName("practice").getOrCreate()\norders = spark.read.csv("/data/orders.csv", header=True, inferSchema=True)\n\nby_channel = (orders.filter(F.col("status") != "cancelled")\n                    .groupBy("channel")\n                    .agg(F.count("*").alias("orders"), F.round(F.sum("amount"), 2).alias("revenue"))\n                    .orderBy(F.desc("revenue")))\nby_channel.show()\nby_channel.explain()',
  'Airflow DAG (emulated)': 'from datetime import datetime, timedelta\nfrom airflow import DAG\nfrom airflow.operators.python import PythonOperator\nfrom airflow.operators.empty import EmptyOperator\n\ndef extract(**ctx):\n    print("extracting for", ctx["ds"])\n    return 42\n\ndef load(ti, **ctx):\n    rows = ti.xcom_pull(task_ids="extract")\n    print("loading", rows, "rows")\n\nwith DAG("orders_daily", start_date=datetime(2025, 1, 1), schedule="@daily", catchup=False,\n         default_args={"retries": 2, "retry_delay": timedelta(minutes=5)}) as dag:\n    start = EmptyOperator(task_id="start")\n    extract_task = PythonOperator(task_id="extract", python_callable=extract)\n    load_task = PythonOperator(task_id="load", python_callable=load)\n    start >> extract_task >> load_task\n\ndag.test()',
  'Parse a log file': 'import re\nfrom collections import Counter\n\npattern = re.compile(r"^(\\S+) (\\w+) pipeline=(\\S+)")\nlevels = Counter()\nwith open("/data/pipeline.log") as f:\n    for line in f:\n        m = pattern.match(line)\n        if m:\n            levels[(m.group(3), m.group(2))] += 1\nfor k, v in sorted(levels.items()):\n    print(k, v)',
}

export default function Playground({ lang }: { lang: 'sql' | 'python' }) {
  useStudyClock('playground', undefined, lang)
  return lang === 'sql' ? <SqlPlayground /> : <PyPlayground />
}

function SqlPlayground() {
  const [code, setCode] = useLocalState('pg:sql', SQL_SAMPLES['Explore orders'])
  const [res, setRes] = useState<SqlResult | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [tables, setTables] = useState<Awaited<ReturnType<typeof sqlSchema>>>([])
  const editorApi = useRef<EditorApi | null>(null)
  const loadSchema = () => sqlSchema(true).then(setTables).catch((e) => setErr(e.message))
  useEffect(() => { loadSchema() }, [])
  const run = async () => { setBusy(true); setErr(''); try { setRes(await runSql(code, { playground: true, explain: true })); loadSchema() } catch (e: any) { setErr(e.message); setRes(null) } setBusy(false) }
  const schemaMap = Object.fromEntries(tables.map((t) => [t.name, t.cols.map((c) => c.name)]))
  const review = res ? reviewSql(code) : []
  return (
    <div className="page wide">
      <div className="page-head"><div><div className="crumbs"><a href="#/practice">Practice</a> / SQL playground</div><h1>SQL playground</h1><p>A private SQLite database with realistic e-commerce data. Create tables freely — reset any time.</p></div>
        <div className="row"><select className="select" style={{ width: 240 }} value="" onChange={(e) => e.target.value && setCode(SQL_SAMPLES[e.target.value])}><option value="">Load an example…</option>{Object.keys(SQL_SAMPLES).map((k) => <option key={k}>{k}</option>)}</select><button className="btn" onClick={async () => { await resetPlayground(); loadSchema(); toast('Database reset') }}><Icon name="repeat" size={15} />Reset DB</button></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(260px, 320px) minmax(0,1fr)', alignItems: 'start' }}>
        <div style={{ position: 'sticky', top: 70 }}>
          <SchemaPanel tables={tables} playground onInsert={(t) => { if (editorApi.current) editorApi.current.insert(t); else setCode(code + ' ' + t) }} />
        </div>
        <div className="col" style={{ minWidth: 0 }}>
          <div className="editor-shell"><div className="editor-bar"><span className="muted">SQLite</span><span className="spacer" /><span className="muted tiny"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span><button className="btn sm primary" onClick={run} disabled={busy}>{busy ? <span className="spin" /> : <Icon name="play" size={13} />}Run</button></div>
            <Suspense fallback={<div style={{ minHeight: 240 }} />}><CodeEditor value={code} onChange={setCode} lang="sql" onRun={run} schema={schemaMap} minHeight={240} apiRef={editorApi} /></Suspense></div>
          {err && <div className="output"><div className="output-head"><Icon name="alert" size={14} />Error</div><pre className="console err-text">{err}</pre>{explainSqlError(err) && <div className="small" style={{ padding: '8px 12px' }}>{explainSqlError(err)}</div>}</div>}
          {res && <div className="output"><div className="output-head">{res.total} row(s) · {res.ms.toFixed(1)} ms{res.changes ? ` · ${res.changes} changed` : ''}</div><ResultTable columns={res.columns} rows={res.rows} total={res.total} max={500} /></div>}
          {res?.plan?.length ? <div className="card tight"><div className="step-kind mb-s">Query plan</div><pre className="console small" style={{ margin: 0 }}>{res.plan.map((p) => p.detail).join('\n')}</pre></div> : null}
          {review.length > 0 && <div className="card tight"><div className="step-kind mb-s">Engineering review</div>{review.map((r, i) => <div key={i} className="small">• {r.msg}</div>)}</div>}
        </div>
      </div>
    </div>
  )
}

function PyPlayground() {
  const [code, setCode] = useLocalState('pg:py', PY_SAMPLES['Read a CSV'])
  const [res, setRes] = useState<PyResult | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [files, setFiles] = useState<{ path: string; size: number }[]>([])
  const [peek, setPeek] = useState<{ path: string; text: string } | null>(null)
  useEffect(() => pyWorker.onStatus(setStatus), [])
  const run = async () => { setBusy(true); setErr(''); try { setRes(await runPython(code, [], '', 30000)); setFiles(await pyFiles()) } catch (e: any) { setErr(e.message); setRes(null) } setBusy(false) }
  const help = res && !res.ok ? explainPyError(res.etype, res.error || '') : err ? explainPyError(null, err) : null
  return (
    <div className="page wide">
      <div className="page-head"><div><div className="crumbs"><a href="#/practice">Practice</a> / Python playground</div><h1>Python playground</h1><p>Python 3 in your browser with pandas, plus PySpark and Airflow practice emulators. Sample data is in <code>/data</code>.</p></div>
        <div className="row"><select className="select" style={{ width: 240 }} value="" onChange={(e) => e.target.value && setCode(PY_SAMPLES[e.target.value])}><option value="">Load an example…</option>{Object.keys(PY_SAMPLES).map((k) => <option key={k}>{k}</option>)}</select>
          <button className="btn" onClick={async () => setFiles(await pyFiles())}><Icon name="note" size={15} />Files</button></div></div>
      <div className="workspace">
        <div className="col" style={{ minWidth: 0 }}>
          <div className="editor-shell"><div className="editor-bar"><span className="muted">Python 3.12 · Pyodide</span><span className="spacer" /><span className="muted tiny"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span><button className="btn sm primary" onClick={run} disabled={busy}>{busy ? <span className="spin" /> : <Icon name="play" size={13} />}Run</button></div>
            <Suspense fallback={<div style={{ minHeight: 380 }} />}><CodeEditor value={code} onChange={setCode} lang="python" onRun={run} errorLine={res?.line ?? null} minHeight={380} maxHeight={700} /></Suspense></div>
          {status && <div className="muted small row"><span className="spin" />{status}</div>}
          {files.length > 0 && <div className="card tight"><div className="step-kind mb-s">Files</div>{files.map((f) => <div key={f.path} className="row small" style={{ cursor: 'pointer' }} onClick={async () => setPeek({ path: f.path, text: await pyRead(f.path) })}><code>{f.path}</code><span className="muted tiny">{(f.size / 1024).toFixed(1)} KB</span></div>)}</div>}
        </div>
        <div className="col" style={{ minWidth: 0 }}>
          <div className="output"><div className="output-head">Output{res ? ` · ${res.ms.toFixed(0)} ms` : ''}</div><pre className="console" style={{ minHeight: 120 }}>{res?.stdout || (busy ? 'Running…' : 'Run your code to see output here.')}</pre></div>
          {(err || (res && !res.ok)) && <div className="output"><div className="output-head"><Icon name="alert" size={14} />Traceback{res?.line ? ` — line ${res.line}` : ''}</div><pre className="console err-text">{err || res?.error}</pre>{help && <div className="small" style={{ padding: '8px 12px' }}><b>{help.title}.</b> {help.meaning} <span className="dim">Tip: {help.debug}</span></div>}</div>}
          {res?.dags?.length ? res.dags.map((d: any) => <DagView key={d.dag_id} dag={d} />) : null}
          {res?.review?.length ? <div className="card tight"><div className="step-kind mb-s">Engineering review</div>{res.review.map((r, i) => <div key={i} className="small">• Line {r.line}: {r.msg}</div>)}</div> : null}
          {peek && <div className="card tight"><div className="row mb-s"><code>{peek.path}</code><span className="spacer" /><button className="btn sm ghost" onClick={() => setPeek(null)}><Icon name="x" size={13} /></button></div><pre className="console small" style={{ maxHeight: 300, overflow: 'auto', margin: 0 }}>{peek.text.slice(0, 5000)}</pre></div>}
        </div>
      </div>
    </div>
  )
}
