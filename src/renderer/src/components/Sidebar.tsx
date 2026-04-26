import { useEffect, useState } from 'react'
import { Home, Library, Import, Settings2, Puzzle, Settings, Info } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { Page } from '../types'
import appIcon from '../assets/icon.png'

const NAV_ITEMS: { page: Page; label: string; icon: React.ElementType }[] = [
  { page: 'home', label: 'Home', icon: Home },
  { page: 'library', label: 'My Library', icon: Library },
  { page: 'imports', label: 'Imports', icon: Import },
  { page: 'platform-setup', label: 'Platform Setup', icon: Settings2 }
]

export default function Sidebar(): React.JSX.Element {
  const currentPage = useAppStore((s) => s.currentPage)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const badgeStyle = useAppStore((s) => s.importsBadgeStyle)

  // Track active import count for badge
  const [activeCount, setActiveCount] = useState(0)

  useEffect(() => {
    const recount = (): void => {
      window.api.imports.list().then((list) => {
        setActiveCount(list.filter((d) => d.status === 'importing' || d.status === 'queued').length)
      })
    }

    // Initial count
    recount()

    // Subscribe to progress for live updates
    const unsubProgress = window.api.imports.onProgress((data) => {
      if (data.status === 'importing' || data.status === 'queued') {
        // Ensure count is at least 1 while something is active
        setActiveCount((prev) => Math.max(prev, 1))
      }
      recount()
    })

    // Subscribe to list mutations (cancel, remove, clear)
    const unsubListChanged = window.api.imports.onListChanged(() => {
      recount()
    })

    return () => {
      unsubProgress()
      unsubListChanged()
    }
  }, [])

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-rs-sidebar border-r border-rs-border">
      {/* ── Brand ─────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-8">
        <img src={appIcon} alt="RetroSync" className="h-8 w-8 rounded-lg" />
        <span className="text-sm font-semibold tracking-wide text-rs-text">RetroSync</span>
      </div>

      {/* ── Main nav ──────────────────────────────────── */}
      <nav className="flex flex-1 flex-col justify-between px-3">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ page, label, icon: Icon }) => {
            const isActive = currentPage === page
            const showBadge = page === 'imports' && activeCount > 0 && badgeStyle !== 'none'
            return (
              <li key={page}>
                <button
                  onClick={() => setCurrentPage(page)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-rs-accent/15 text-rs-accent-hover'
                      : 'text-rs-text-secondary hover:bg-rs-panel-light hover:text-rs-text'
                  }`}
                >
                  <span className="relative">
                    <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                    {showBadge && badgeStyle === 'count' && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[8px] font-bold leading-none text-white">
                        {activeCount > 9 ? '9+' : activeCount}
                      </span>
                    )}
                    {showBadge && badgeStyle === 'dot' && (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </span>
                  {label}
                </button>
              </li>
            )
          })}
        </ul>

        {/* ── Bottom nav (Add-ons, Settings & About) ──── */}
        <div className="flex flex-col gap-1 pb-5">
          <button
            onClick={() => setCurrentPage('addons')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === 'addons'
                ? 'bg-rs-accent/15 text-rs-accent-hover'
                : 'text-rs-text-secondary hover:bg-rs-panel-light hover:text-rs-text'
            }`}
          >
            <Puzzle size={18} strokeWidth={currentPage === 'addons' ? 2.2 : 1.8} />
            Add-ons
          </button>
          <button
            onClick={() => setCurrentPage('settings')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === 'settings'
                ? 'bg-rs-accent/15 text-rs-accent-hover'
                : 'text-rs-text-secondary hover:bg-rs-panel-light hover:text-rs-text'
            }`}
          >
            <Settings size={18} strokeWidth={currentPage === 'settings' ? 2.2 : 1.8} />
            Settings
          </button>
          <button
            onClick={() => setCurrentPage('about')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentPage === 'about'
                ? 'bg-rs-accent/15 text-rs-accent-hover'
                : 'text-rs-text-secondary hover:bg-rs-panel-light hover:text-rs-text'
            }`}
          >
            <Info size={18} strokeWidth={currentPage === 'about' ? 2.2 : 1.8} />
            About
          </button>
        </div>
      </nav>
    </aside>
  )
}
