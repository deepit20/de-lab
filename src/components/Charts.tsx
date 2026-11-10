// Small dependency-free SVG charts. Single-series charts are named by their card title (no legend);
// every mark has a native hover tooltip, and values are labelled selectively.
import { useState } from 'react'

export function BarChart({ data, height = 140, color = 'var(--accent)', format = (v: number) => String(Math.round(v)), max }: { data: { label: string; value: number; title?: string }[]; height?: number; color?: string; format?: (v: number) => string; max?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const m = max ?? Math.max(1, ...data.map((d) => d.value))
  const W = 100 / Math.max(1, data.length)
  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" height={height + 22} viewBox={`0 0 100 ${height + 22}`} preserveAspectRatio="none" role="img">
        <line x1="0" x2="100" y1={height} y2={height} stroke="var(--line2)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const h = (d.value / m) * (height - 6)
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * W} y={0} width={W} height={height} fill="transparent" />
              <rect x={i * W + W * 0.18} y={height - h} width={W * 0.64} height={Math.max(0, h)} rx={0.8} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />
            </g>
          )
        })}
      </svg>
      <div className="row nowrap" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, gap: 0 }}>
        {data.map((d, i) => <span key={i} className="tiny muted" style={{ width: `${W}%`, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>{data.length <= 16 || i % Math.ceil(data.length / 12) === 0 ? d.label : ''}</span>)}
      </div>
      {hover !== null && <div className="card tight small" style={{ position: 'absolute', top: 0, left: `min(${(hover + 0.5) * W}%, calc(100% - 160px))`, pointerEvents: 'none', padding: '4px 8px', whiteSpace: 'nowrap' }}><b>{format(data[hover].value)}</b> <span className="muted">{data[hover].title || data[hover].label}</span></div>}
    </div>
  )
}

export function LineChart({ data, height = 140, color = 'var(--accent)', max = 100, format = (v: number) => String(Math.round(v)) }: { data: { label: string; value: number }[]; height?: number; color?: string; max?: number; format?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (!data.length) return null
  const W = 600, H = height
  const x = (i: number) => (data.length === 1 ? W / 2 : 12 + (i * (W - 24)) / (data.length - 1))
  const y = (v: number) => H - 8 - (v / max) * (H - 20)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.value)}`).join(' ')
  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={y(max * g)} y2={y(max * g)} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r={hover === i ? 5 : 3.5} fill={color} stroke="var(--panel)" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
        {data.map((_, i) => <rect key={i} x={x(i) - W / data.length / 2} y={0} width={W / data.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--text3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover !== null && <div className="card tight small" style={{ position: 'absolute', top: 0, left: `min(${(x(hover) / W) * 100}%, calc(100% - 170px))`, pointerEvents: 'none', padding: '4px 8px', whiteSpace: 'nowrap' }}><b>{format(data[hover].value)}</b> <span className="muted">{data[hover].label}</span></div>}
    </div>
  )
}

/** Calendar heatmap of daily study minutes (single hue, light → dark). */
export function Heatmap({ days }: { days: { day: string; minutes: number }[] }) {
  const max = Math.max(30, ...days.map((d) => d.minutes))
  const level = (m: number) => (m <= 0 ? 0 : m < max * 0.25 ? 1 : m < max * 0.5 ? 2 : m < max * 0.75 ? 3 : 4)
  const shades = ['var(--bg2)', 'color-mix(in srgb, var(--accent) 25%, var(--panel))', 'color-mix(in srgb, var(--accent) 45%, var(--panel))', 'color-mix(in srgb, var(--accent) 70%, var(--panel))', 'var(--accent)']
  return (
    <div>
      <div className="heat">{days.map((d) => <i key={d.day} title={`${d.day}: ${Math.round(d.minutes)} min`} style={{ background: shades[level(d.minutes)] }} />)}</div>
      <div className="row tiny muted mt-s" style={{ gap: 4 }}>Less {shades.map((s, i) => <i key={i} style={{ width: 11, height: 11, borderRadius: 3, background: s, display: 'inline-block' }} />)} More</div>
    </div>
  )
}
