import { useEffect, useRef, useState } from 'react'
import { db, updateSettings, BACKGROUNDS } from '../db'
import { useProfile } from '../lib/hooks'
import { chooseBackupFolder, downloadBackup, restoreBackup, storageEstimate, writeFolderBackup } from '../lib/backup'
import { DEFAULT_MODEL, ask } from '../lib/ai'
import { REPO_URL, ISSUES_URL, repoConfigured } from '../config'
import { ago } from '../lib/util'
import { Icon, Loading, Seg, toast } from '../components/ui'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Settings() {
  const p = useProfile()
  const [key, setKey] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [est, setEst] = useState<StorageEstimate | undefined>()
  const [testing, setTesting] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { storageEstimate().then(setEst) }, [])
  useEffect(() => { if (p) { setKey(p.settings.aiKey || ''); setModel(p.settings.aiModel || DEFAULT_MODEL) } }, [p?.settings.aiKey])
  if (!p) return <Loading />
  const s = p.settings
  const saveProfile = async (patch: any) => db.profile.put({ ...p, ...patch })
  const testAI = async () => { setTesting(true); try { await updateSettings({ aiKey: key.trim(), aiModel: model }); const r = await ask({ system: 'Reply with exactly: ready', messages: [{ role: 'user', content: 'ping' }], effort: 'low', maxTokens: 200 }); toast(`AI coach connected (${r.slice(0, 20)})`) } catch (e: any) { toast('Connection failed: ' + e.message) } setTesting(false) }
  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="page-head"><div><h1>Settings & backup</h1><p>Your profile, study availability, optional AI coach and — most importantly — backups of your learning history.</p></div></div>
      <div className="col" style={{ gap: 16 }}>
        <div className="card">
          <h3><Icon name="download" />Backup & restore</h3>
          <p className="dim small">All progress, notes, attempts and interview history are stored in this browser (IndexedDB) on this laptop. Clearing browser data or switching browsers loses them — keep backups.</p>
          <div className="row">
            <button className="btn primary" onClick={async () => { await downloadBackup(); toast('Backup downloaded') }}><Icon name="download" size={15} />Download backup</button>
            <button className="btn" onClick={async () => { try { await chooseBackupFolder(); toast('Daily automatic backups enabled') } catch (e: any) { if (e.name !== 'AbortError') toast(e.message) } }}><Icon name="note" size={15} />{s.autoBackup ? 'Change backup folder' : 'Enable daily backups to a folder'}</button>
            {s.autoBackup && <button className="btn ghost" onClick={async () => { const r = await writeFolderBackup(true); toast(r === 'ok' ? 'Backed up' : 'Permission needed — click again') }}>Back up now</button>}
            <button className="btn" onClick={() => file.current?.click()}><Icon name="upload" size={15} />Restore from file</button>
            <input ref={file} type="file" accept=".json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (!confirm('Restoring REPLACES the current data in this browser with the backup. Continue?')) return; try { await restoreBackup(f); toast('Restored'); setTimeout(() => location.reload(), 600) } catch (err: any) { toast(err.message) } }} />
          </div>
          <div className="muted small mt-s">Last backup: {s.lastBackupAt ? `${new Date(s.lastBackupAt).toLocaleString()} (${ago(s.lastBackupAt)})` : 'never'}{s.autoBackup ? ' · automatic daily folder backup is on (a OneDrive/Google Drive folder gives you an off-laptop copy)' : ''}{est ? ` · using ${(est.usage! / 1048576).toFixed(1)} MB` : ''}</div>
        </div>

        <div className="card">
          <h3><Icon name="gear" />Profile & study time</h3>
          <div className="grid g2">
            <label className="field">Name<input className="input" defaultValue={p.name} onBlur={(e) => saveProfile({ name: e.target.value })} /></label>
            <label className="field">Goal<input className="input" defaultValue={p.goal} onBlur={(e) => saveProfile({ goal: e.target.value })} /></label>
            <label className="field">Background<select className="select" value={p.background || ''} onChange={(e) => saveProfile({ background: e.target.value || undefined })}><option value="">Not set</option>{BACKGROUNDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
            <label className="field">About your experience (used only by the optional AI coach)<input className="input" defaultValue={p.about || ''} onBlur={(e) => saveProfile({ about: e.target.value || undefined })} placeholder="e.g. 2 years of SQL, learning Python" /></label>
          </div>
          <div className="field mt">Typical minutes per day
            <div className="grid" style={{ gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 8 }}>{DAYS.map((d, i) => (
              <label key={d} className="field" style={{ alignItems: 'center' }}>{d}<select className="select" value={s.weekMinutes[i]} onChange={(e) => { const w = [...s.weekMinutes]; w[i] = Number(e.target.value); updateSettings({ weekMinutes: w }) }}>{[0, 15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m ? `${m}m` : 'off'}</option>)}</select></label>
            ))}</div>
          </div>
          <div className="grid g2 mt">
            <label className="field">Target retention (revision strictness)<Seg value={String(s.retention)} onChange={(v) => updateSettings({ retention: Number(v) })} options={[{ id: '0.85', label: '85% — fewer reviews' }, { id: '0.9', label: '90% — balanced' }, { id: '0.95', label: '95% — more reviews' }]} /></label>
            <label className="field">Max share of a session for reviews<Seg value={String(s.reviewShare)} onChange={(v) => updateSettings({ reviewShare: Number(v) })} options={[{ id: '0.25', label: '25%' }, { id: '0.35', label: '35%' }, { id: '0.5', label: '50%' }]} /></label>
          </div>
          <div className="row mt"><label className="field">Theme<Seg value={s.theme} onChange={(v) => updateSettings({ theme: v as any })} options={[{ id: 'system', label: 'System' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]} /></label><span className="spacer" /><a className="btn" href="#/onboarding">Update what I already know</a></div>
        </div>

        <div className="card">
          <h3><Icon name="sparkles" />AI coach (optional)</h3>
          <p className="dim small">Everything works without this. With an Anthropic API key, DE Lab adds adaptive mock-interview follow-ups, rubric feedback on written answers, deeper JD analysis, communication coaching and Socratic tutor hints. The key is stored only in this browser and is never included in backups; requests go directly from this browser to Anthropic and are billed to that key.</p>
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
            <label className="field">API key<input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" /></label>
            <label className="field">Model<select className="select" value={model} onChange={(e) => setModel(e.target.value)}><option value="claude-opus-5-5">Claude Opus 5.5 (best)</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5 (cheaper)</option><option value="claude-haiku-5-5">Claude Haiku 5.5 (cheapest)</option></select></label>
          </div>
          <div className="row mt-s"><button className="btn primary" disabled={!key.trim() || testing} onClick={testAI}>{testing ? <span className="spin" /> : <Icon name="check" size={15} />}Save & test</button>{s.aiKey && <button className="btn ghost danger" onClick={() => { updateSettings({ aiKey: undefined }); setKey(''); toast('Key removed') }}>Remove key</button>}</div>
        </div>

        <div className="card">
          <h3><Icon name="alert" />Danger zone</h3>
          <div className="row"><button className="btn danger" onClick={async () => { if (prompt('This deletes ALL learning data in this browser. Download a backup first. Type DELETE to confirm.') === 'DELETE') { await db.delete(); location.reload() } }}><Icon name="trash" size={15} />Erase all data</button><span className="muted small">Cannot be undone.</span></div>
        </div>
        <div className="card">
          <h3><Icon name="star" />About DE Lab</h3>
          <p className="dim small">DE Lab is free and open source (MIT). It's local-first: no account, no tracking — code runs in sandboxed WebAssembly (SQLite, Pyodide) inside your browser.</p>
          {repoConfigured ? <div className="row">
            <a className="btn primary" href={REPO_URL} target="_blank" rel="noopener noreferrer"><Icon name="star" size={15} />Star on GitHub</a>
            <a className="btn" href={ISSUES_URL} target="_blank" rel="noopener noreferrer"><Icon name="flag" size={15} />Report a bug / suggest content</a>
          </div> : <div className="muted tiny">Project links appear here once the repository is published.</div>}
        </div>
      </div>
    </div>
  )
}
