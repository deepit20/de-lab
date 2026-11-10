// Backup & restore: all learning history lives in this browser's IndexedDB, so regular exports matter.
import { db, updateSettings } from '../db'
import { download } from './util'

const TABLES = ['profile', 'progress', 'evidence', 'attempts', 'cards', 'reviews', 'notes', 'highlights', 'bookmarks', 'mistakes', 'plans', 'activity', 'projects', 'interviews', 'jds', 'comm', 'kv'] as const

export async function exportAll(includeKey = false) {
  const data: Record<string, any[]> = {}
  for (const t of TABLES) data[t] = await (db as any)[t].toArray()
  if (!includeKey) data.profile = data.profile.map((p) => ({ ...p, settings: { ...p.settings, aiKey: undefined } }))
  return { app: 'de-lab', version: 1, exportedAt: new Date().toISOString(), data }
}
export async function downloadBackup() {
  const b = await exportAll()
  download(`de-lab-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b))
  await updateSettings({ lastBackupAt: Date.now() })
}
export async function restoreBackup(file: File, mode: 'replace' | 'merge' = 'replace') {
  const b = JSON.parse(await file.text())
  if (b.app !== 'de-lab' || !b.data) throw new Error('This is not a DE Lab backup file.')
  const keep = await db.profile.get('me')
  await db.transaction('rw', TABLES.map((t) => (db as any)[t]), async () => {
    for (const t of TABLES) {
      const tbl = (db as any)[t]
      if (mode === 'replace') await tbl.clear()
      if (b.data[t]?.length) await tbl.bulkPut(b.data[t])
    }
  })
  if (keep?.settings.aiKey) await updateSettings({ aiKey: keep.settings.aiKey })
}

// Optional automatic backups into a folder the learner picks (Chrome/Edge File System Access API)
export async function chooseBackupFolder() {
  const picker = (window as any).showDirectoryPicker
  if (!picker) throw new Error('Your browser does not support folder backups — use "Download backup" instead.')
  const handle = await picker({ mode: 'readwrite', id: 'de-lab-backups' })
  await db.kv.put({ key: 'backupDir', value: handle })
  await writeFolderBackup(true)
  await updateSettings({ autoBackup: true })
}
export async function writeFolderBackup(interactive = false): Promise<'ok' | 'needs-permission' | 'none'> {
  const rec = await db.kv.get('backupDir')
  const handle = rec?.value
  if (!handle) return 'none'
  let perm = await handle.queryPermission?.({ mode: 'readwrite' })
  if (perm !== 'granted' && interactive) perm = await handle.requestPermission?.({ mode: 'readwrite' })
  if (perm !== 'granted') return 'needs-permission'
  const file = await handle.getFileHandle(`de-lab-backup-${new Date().toISOString().slice(0, 10)}.json`, { create: true })
  const w = await file.createWritable()
  await w.write(JSON.stringify(await exportAll()))
  await w.close()
  await updateSettings({ lastBackupAt: Date.now() })
  return 'ok'
}
export async function requestPersistence() {
  try { return await navigator.storage?.persist?.() } catch { return false }
}
export async function storageEstimate() { try { return await navigator.storage?.estimate?.() } catch { return undefined } }
