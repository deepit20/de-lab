// Renders Airflow DAGs produced by the emulator as a layered graph, with validation problems and last-run states.
export interface DagExport { dag_id: string; schedule: string; start_date: string; catchup: boolean; tasks: { id: string; op: string; retries: number; rule: string; up: string[]; down: string[] }[]; problems: string[]; cycle: string | null; last_run: Record<string, string> | null }
const STATE_COLOR: Record<string, string> = { success: 'var(--good)', failed: 'var(--bad)', upstream_failed: 'var(--warn)', skipped: 'var(--text3)' }

export default function DagView({ dag }: { dag: DagExport }) {
  const tasks = dag.tasks
  const layer: Record<string, number> = {}
  const visit = (id: string, seen = new Set<string>()): number => {
    if (layer[id] !== undefined) return layer[id]
    if (seen.has(id)) return 0
    seen.add(id)
    const t = tasks.find((x) => x.id === id)
    const l = t && t.up.length ? Math.max(...t.up.map((u) => visit(u, seen))) + 1 : 0
    return (layer[id] = l)
  }
  tasks.forEach((t) => visit(t.id))
  const cols: string[][] = []
  for (const t of tasks) (cols[layer[t.id]] ||= []).push(t.id)
  const W = 168, H = 46, GX = 56, GY = 18
  const pos: Record<string, { x: number; y: number }> = {}
  const maxRows = Math.max(1, ...cols.map((c) => c?.length || 0))
  cols.forEach((c, ci) => c?.forEach((id, ri) => { pos[id] = { x: 16 + ci * (W + GX), y: 16 + ri * (H + GY) + ((maxRows - c.length) * (H + GY)) / 2 } }))
  const width = 32 + cols.length * (W + GX) - GX
  const height = 32 + maxRows * (H + GY) - GY
  return (
    <div className="card flat tight">
      <div className="row mb-s">
        <b style={{ fontFamily: 'var(--mono)' }}>{dag.dag_id}</b>
        <span className="badge">schedule: {dag.schedule}</span>
        <span className="badge">start: {dag.start_date?.slice(0, 10)}</span>
        <span className="badge">catchup: {String(dag.catchup)}</span>
        <span className="badge">{tasks.length} tasks</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={Math.max(width, 200)} height={height} role="img" aria-label={`DAG ${dag.dag_id}`}>
          <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--text3)" /></marker></defs>
          {tasks.flatMap((t) => t.down.map((d) => {
            const a = pos[t.id], b = pos[d]
            if (!a || !b) return null
            const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2
            return <path key={t.id + d} className="dag-edge" d={`M${x1} ${y1} C${x1 + GX / 2} ${y1}, ${x2 - GX / 2} ${y2}, ${x2 - 2} ${y2}`} markerEnd="url(#arr)" strokeWidth={1.4} />
          }))}
          {tasks.map((t) => {
            const p = pos[t.id]; if (!p) return null
            const st = dag.last_run?.[t.id]
            return (
              <g key={t.id} className="dag-node" transform={`translate(${p.x},${p.y})`}>
                <rect width={W} height={H} rx={9} strokeWidth={st ? 2 : 1} style={st ? { stroke: STATE_COLOR[st] } : undefined} />
                <text x={10} y={19} fontWeight={600}>{t.id.length > 20 ? t.id.slice(0, 19) + '…' : t.id}</text>
                <text x={10} y={35} style={{ fill: 'var(--text3)', fontSize: 10.5, fontFamily: 'var(--font)' }}>{t.op}{t.retries ? ` · retries ${t.retries}` : ''}{t.rule !== 'all_success' ? ` · ${t.rule}` : ''}</text>
                {st && <circle cx={W - 12} cy={12} r={5} fill={STATE_COLOR[st]} />}
              </g>
            )
          })}
        </svg>
      </div>
      {dag.problems.length > 0 && <div className="col mt-s">{dag.problems.map((p, i) => <div key={i} className={`small ${dag.cycle && i === 0 ? 'err-text' : 'dim'}`}>⚠ {p}</div>)}</div>}
    </div>
  )
}
