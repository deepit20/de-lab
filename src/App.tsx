import { lazy, Suspense, useEffect } from 'react'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import { useProfile, useRoute } from './lib/hooks'
import { writeFolderBackup } from './lib/backup'

const Today = lazy(() => import('./pages/Today'))
const Roadmap = lazy(() => import('./pages/Roadmap'))
const Topic = lazy(() => import('./pages/Topic'))
const Practice = lazy(() => import('./pages/Practice'))
const Playground = lazy(() => import('./pages/Playground'))
const Revise = lazy(() => import('./pages/Revise'))
const Notes = lazy(() => import('./pages/Notes'))
const Projects = lazy(() => import('./pages/Projects'))
const Interview = lazy(() => import('./pages/Interview'))
const Communicate = lazy(() => import('./pages/Communicate'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const Onboarding = lazy(() => import('./pages/Onboarding'))

export default function App() {
  const { parts } = useRoute()
  const profile = useProfile()
  useEffect(() => { document.getElementById('main')?.scrollTo({ top: 0 }) }, [parts.join('/')])
  useEffect(() => {
    // daily automatic backup into the chosen folder (silently skipped if permission must be re-granted)
    if (profile?.settings.autoBackup && Date.now() - (profile.settings.lastBackupAt || 0) > 86400000) writeFolderBackup(false).catch(() => {})
  }, [profile?.settings.autoBackup])
  if (!profile) return null
  if (!profile.onboarded && parts[0] !== 'settings') return <Suspense fallback={<Loading />}><Onboarding /></Suspense>
  const [a, b, c] = parts
  let page
  switch (a) {
    case undefined: page = <Today />; break
    case 'learn': page = <Roadmap trackId={b} />; break
    case 'topic': page = <Topic key={b} id={b} tab={c} />; break
    case 'practice': page = <Practice exId={b} />; break
    case 'playground': page = <Playground lang={b === 'python' ? 'python' : 'sql'} />; break
    case 'revise': page = <Revise view={b} />; break
    case 'notes': page = <Notes view={b} sub={c} />; break
    case 'projects': page = <Projects id={b} />; break
    case 'interview': page = <Interview view={b} id={c} />; break
    case 'communicate': page = <Communicate />; break
    case 'analytics': page = <Analytics />; break
    case 'settings': page = <Settings />; break
    case 'onboarding': page = <Onboarding />; break
    default: page = <Today />
  }
  return <Layout><Suspense fallback={<Loading />}>{page}</Suspense></Layout>
}
