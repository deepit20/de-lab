/* SQLite (sql.js WASM) execution sandbox. Runs entirely in this worker: no server, no network, no access to the app's data.
   The main thread terminates & recreates the worker if a query runs too long. */
importScripts('../vendor/sql-wasm.js', './seed.js')

let SQL = null
let pristine = null // Uint8Array of the seeded database
let playground = null // persistent scratch DB for the playground

async function init() {
  if (SQL) return
  SQL = await initSqlJs({ locateFile: (f) => '../vendor/' + f })
  const db = new SQL.Database()
  db.exec(DESeed.seedSQL())
  pristine = db.export()
  db.close()
  playground = new SQL.Database(pristine)
}

function fresh() { return new SQL.Database(pristine) }

function runAll(db, sql) {
  const t0 = performance.now()
  const res = db.exec(sql)
  const ms = performance.now() - t0
  const last = res.length ? res[res.length - 1] : null
  return { columns: last ? last.columns : [], rows: last ? last.values : [], sets: res.length, ms, changes: db.getRowsModified() }
}

const norm = (v) => (v === null || v === undefined ? null : typeof v === 'number' ? Math.round(v * 100) / 100 : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Math.round(parseFloat(v) * 100) / 100 : v)
function compare(a, b, ordered) {
  const fb = []
  if (a.columns.length !== b.columns.length) {
    fb.push(`Your result has ${a.columns.length} column(s); the expected result has ${b.columns.length} (${b.columns.join(', ')}).`)
    return { ok: false, feedback: fb }
  }
  const ka = a.rows.map((r) => JSON.stringify(r.map(norm)))
  const kb = b.rows.map((r) => JSON.stringify(r.map(norm)))
  if (ka.length !== kb.length) fb.push(`You returned ${ka.length} row(s); expected ${kb.length}.` + (ka.length > kb.length ? ' Too many rows often means a join fan-out, a missing filter or missing DISTINCT/GROUP BY.' : ' Too few rows often means an INNER join where a LEFT join was needed, an over-strict filter, or a NULL comparison.'))
  let ok
  if (ordered) {
    ok = ka.length === kb.length && ka.every((k, i) => k === kb[i])
    if (!ok && ka.length === kb.length) {
      const sa = [...ka].sort().join('|'), sb = [...kb].sort().join('|')
      if (sa === sb) fb.push('The rows are correct but the ORDER is different — check your ORDER BY (direction and tie-breakers).')
      else { const i = ka.findIndex((k, j) => k !== kb[j]); fb.push(`First difference at row ${i + 1}.`) }
    }
  } else {
    const count = (arr) => arr.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map())
    const ca = count(ka), cb = count(kb)
    const missing = [], extra = []
    for (const [k, n] of cb) if ((ca.get(k) || 0) < n) missing.push(k)
    for (const [k, n] of ca) if ((cb.get(k) || 0) < n) extra.push(k)
    ok = missing.length === 0 && extra.length === 0
    if (!ok) {
      if (missing.length) fb.push(`${missing.length} expected row(s) are missing, e.g. ${missing.slice(0, 2).join('  ')}`)
      if (extra.length) fb.push(`${extra.length} row(s) should not be there, e.g. ${extra.slice(0, 2).join('  ')}`)
    }
  }
  const nameMismatch = a.columns.some((c, i) => b.columns[i] && c.toLowerCase() !== b.columns[i].toLowerCase())
  if (ok && nameMismatch) fb.push(`Tip: expected column names are ${b.columns.join(', ')} — use aliases so downstream users understand the output.`)
  return { ok, feedback: fb }
}

function planOf(db, sql) {
  const stmts = sql.split(';').map((s) => s.trim()).filter(Boolean)
  const last = stmts[stmts.length - 1]
  if (!last || !/^\s*(select|with)/i.test(last)) return []
  try { const r = db.exec('EXPLAIN QUERY PLAN ' + last); return r.length ? r[0].values.map((v) => ({ id: v[0], parent: v[1], detail: v[3] })) : [] } catch { return [] }
}

self.onmessage = async (e) => {
  const { id, type } = e.data
  try {
    await init()
    if (type === 'init') return self.postMessage({ id, ok: true })
    if (type === 'schema') {
      const db = e.data.playground ? playground : fresh()
      if (!e.data.playground && e.data.setup) db.exec(e.data.setup)
      const tables = db.exec("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name")[0]?.values || []
      const out = tables.map(([name]) => {
        const cols = db.exec(`PRAGMA table_info(${name})`)[0]?.values.map((v) => ({ name: v[1], type: v[2], pk: !!v[5] })) || []
        const count = db.exec(`SELECT COUNT(*) FROM ${name}`)[0].values[0][0]
        return { name, cols, count, description: DESeed.DESCRIPTIONS[name] || '' }
      })
      return self.postMessage({ id, ok: true, tables: out })
    }
    if (type === 'reset') { playground = new SQL.Database(pristine); return self.postMessage({ id, ok: true }) }
    if (type === 'run') {
      const db = e.data.playground ? playground : fresh()
      if (e.data.setup) db.exec(e.data.setup)
      const r = runAll(db, e.data.sql)
      const plan = e.data.explain ? planOf(db, e.data.sql) : undefined
      const total = r.rows.length
      if (!e.data.playground) db.close()
      return self.postMessage({ id, ok: true, result: { ...r, rows: r.rows.slice(0, e.data.limit || 500), total, plan } })
    }
    if (type === 'grade') {
      const { sql, solution, setup, check, ordered, repeat = 1 } = e.data
      const run = (code) => { const db = fresh(); try { if (setup) db.exec(setup); let r; for (let i = 0; i < repeat; i++) r = runAll(db, code); return check ? runAll(db, check) : r } finally { db.close() } }
      let mine
      try { mine = run(sql) } catch (err) { return self.postMessage({ id, ok: true, grade: { ok: false, error: String(err.message || err), feedback: [] } }) }
      const expected = run(solution)
      const cmp = compare(mine, expected, ordered)
      const db = fresh(); if (setup) db.exec(setup)
      const plan = planOf(db, sql); db.close()
      return self.postMessage({ id, ok: true, grade: { ...cmp, mine: { ...mine, rows: mine.rows.slice(0, 200), total: mine.rows.length }, expected: { columns: expected.columns, rows: expected.rows.slice(0, 200), total: expected.rows.length }, plan } })
    }
    throw new Error('Unknown request ' + type)
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) })
  }
}
