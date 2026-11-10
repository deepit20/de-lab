import { useEffect, useState } from 'react'
import { runSql, sqlSchema, type SqlResult } from '../lib/engines'
import { Icon, ResultTable } from './ui'

export type SchemaTable = Awaited<ReturnType<typeof sqlSchema>>[number]

/**
 * Shows every table the query can use: columns with types and keys, row counts, a one-line description and a
 * 5-row preview. Clicking a table or column name inserts it into the editor at the cursor.
 */
export default function SchemaPanel({ tables, onInsert, setup, playground, highlight = [], compact }: {
  tables: SchemaTable[]; onInsert: (text: string) => void; setup?: string; playground?: boolean; highlight?: string[]; compact?: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [preview, setPreview] = useState<Record<string, SqlResult | string>>({})
  const [q, setQ] = useState('')
  useEffect(() => { setPreview({}) }, [tables])
  const sorted = [...tables].sort((a, b) => Number(highlight.includes(b.name)) - Number(highlight.includes(a.name)) || a.name.localeCompare(b.name))
  const shown = sorted.filter((t) => !q || t.name.includes(q.toLowerCase()) || t.cols.some((c) => c.name.includes(q.toLowerCase())))
  const loadPreview = async (name: string) => {
    if (preview[name]) return
    try { setPreview((p) => ({ ...p, [name]: 'loading' })); const r = await runSql(`SELECT * FROM ${name} LIMIT 5`, { setup, playground }); setPreview((p) => ({ ...p, [name]: r })) }
    catch (e: any) { setPreview((p) => ({ ...p, [name]: String(e.message) })) }
  }
  return (
    <div className="schema-panel">
      <div className="row nowrap mb-s" style={{ gap: 6 }}>
        <Icon name="database" size={15} /><b className="small">Tables</b><span className="muted tiny">{tables.length}</span>
        <span className="spacer" />
        {!compact && <input className="input" style={{ maxWidth: 170, padding: '3px 8px', fontSize: 12 }} placeholder="Find table / column" value={q} onChange={(e) => setQ(e.target.value)} />}
      </div>
      <div className="muted tiny mb-s">Click a name to insert it into your query · ▸ to see columns and sample rows</div>
      {shown.map((t) => {
        const isOpen = open === t.name
        const pv = preview[t.name]
        return (
          <div key={t.name} className={`schema-item ${isOpen ? 'open' : ''}`}>
            <div className="schema-head">
              <button className="schema-toggle" onClick={() => { setOpen(isOpen ? null : t.name); if (!isOpen) loadPreview(t.name) }} aria-label={`Show columns of ${t.name}`}>{isOpen ? '▾' : '▸'}</button>
              <button className="schema-name" onClick={() => onInsert(t.name)} title={`Insert "${t.name}"`}>{t.name}</button>
              {highlight.includes(t.name) && <span className="badge accent" title="Likely needed for this exercise">relevant</span>}
              <span className="spacer" />
              <span className="muted tiny">{t.count.toLocaleString()} rows</span>
            </div>
            {!isOpen && <div className="schema-cols-inline">{t.cols.map((c) => <button key={c.name} className="col-chip" onClick={() => onInsert(c.name)} title={`${c.type || 'any'}${c.pk ? ' · primary key' : ''}`}>{c.pk && '🔑'}{c.name}</button>)}</div>}
            {isOpen && (
              <div className="schema-detail">
                {t.description && <div className="small dim mb-s">{t.description}</div>}
                <table className="schema-cols">
                  <tbody>{t.cols.map((c) => (
                    <tr key={c.name}>
                      <td><button className="col-chip" onClick={() => onInsert(c.name)}>{c.pk && '🔑'}{c.name}</button></td>
                      <td className="muted">{c.type || 'any'}</td>
                      <td className="muted tiny">{c.pk ? 'primary key' : /_id$/.test(c.name) && c.name !== `${t.name.replace(/s$/, '')}_id` ? 'joins to another table' : ''}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <div className="row mt-s" style={{ gap: 4 }}>
                  <button className="btn sm" onClick={() => onInsert(`SELECT *\nFROM ${t.name}\nLIMIT 10;`)}>Insert SELECT</button>
                  <button className="btn sm ghost" onClick={() => onInsert(t.cols.map((c) => c.name).join(', '))}>Insert all columns</button>
                </div>
                <div className="tiny muted mt-s mb-s">Sample rows</div>
                {pv === 'loading' || !pv ? <div className="muted tiny">Loading…</div> : typeof pv === 'string' ? <div className="err-text tiny">{pv}</div> : <div className="output"><ResultTable columns={pv.columns} rows={pv.rows} total={pv.total} /></div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
