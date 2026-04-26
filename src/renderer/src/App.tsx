import { useState } from 'react'
import { useAppStore } from './store/useAppStore'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import GameDetailPanel from './components/GameDetailPanel'
import SplashScreen from './components/SplashScreen'
import SetupWizard from './components/SetupWizard'
import DashboardPage from './pages/DashboardPage'
import LibraryPage from './pages/LibraryPage'
import ImportsPage from './pages/ImportsPage'
import PlatformSetupPage from './pages/PlatformSetupPage'
import AddonsPage from './pages/AddonsPage'
import SettingsPage from './pages/SettingsPage'
import AboutPage from './pages/AboutPage'

function App(): React.JSX.Element {
  const currentPage = useAppStore((s) => s.currentPage)
  const selectedGame = useAppStore((s) => s.selectedGame)
  const setSelectedGame = useAppStore((s) => s.setSelectedGame)
  const initializeApp = useAppStore((s) => s.initializeApp)
  const [showSplash, setShowSplash] = useState(true)
  const [showSetupWizard, setShowSetupWizard] = useState(false)

  const renderPage = (): React.JSX.Element => {
    switch (currentPage) {
      case 'library':
        return <LibraryPage />
      case 'imports':
        return <ImportsPage />
      case 'platform-setup':
        return <PlatformSetupPage />
      case 'addons':
        return <AddonsPage />
      case 'settings':
        return <SettingsPage />
      case 'about':
        return <AboutPage />
      case 'home':
      default:
        return <DashboardPage />
    }
  }

  // 1. Splash screen runs first (calls initializeApp)
  if (showSplash) {
    return (
      <SplashScreen
        onFinished={() => {
          setShowSplash(false)
          // If setup is needed after init, show the wizard
          if (useAppStore.getState().needsSetup) {
            setShowSetupWizard(true)
          }
        }}
      />
    )
  }

  // 2. Setup wizard (first-run: IGDB + Devices)
  if (showSetupWizard) {
    return (
      <SetupWizard
        onFinished={() => {
          setShowSetupWizard(false)
          // Re-initialize now that setup is complete
          useAppStore.setState({ appInitialized: false, needsSetup: false })
          setShowSplash(true)
          setTimeout(() => initializeApp(), 50)
        }}
      />
    )
  }

  // 3. Main app
  return (
    <>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">{renderPage()}</main>
      </div>

      <GameDetailPanel game={selectedGame} onClose={() => setSelectedGame(null)} />
    </>
  )
}

export default App
