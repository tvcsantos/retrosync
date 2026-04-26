import { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

const IGDB_SEARCH_DEBOUNCE_MS = 400

export default function TopBar(): React.JSX.Element {
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const searchIGDB = useAppStore((s) => s.searchIGDB)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (searchQuery.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchIGDB(searchQuery.trim())
      }, IGDB_SEARCH_DEBOUNCE_MS)
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, searchIGDB])

  return (
    <header className="flex items-center gap-4 px-6 py-3 bg-rs-bg border-b border-rs-border">
      {/* Search */}
      <div className="relative w-[45%]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-rs-text-secondary pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search"
          className="w-full rounded-full bg-rs-panel pl-10 pr-4 py-2 text-sm text-rs-text placeholder:text-rs-text-secondary border border-rs-border focus:border-rs-accent focus:outline-none transition-colors"
        />
      </div>
    </header>
  )
}
