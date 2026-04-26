import GameCard from '../components/GameCard'
import GameTypeFilterDropdown from '../components/GameTypeFilterDropdown'
import { useAppStore } from '../store/useAppStore'
import { Library } from 'lucide-react'
import type { Game } from '../types'

export default function LibraryPage(): React.JSX.Element {
  const allGames = useAppStore((s) => s.allGames)
  const excludedGameTypes = useAppStore((s) => s.excludedGameTypes)
  const setSelectedGame = useAppStore((s) => s.setSelectedGame)

  const excludedSet = new Set(excludedGameTypes)
  const libraryGames: Game[] = allGames.filter(
    (g) => g.inCollection && !excludedSet.has(g.igdbGameType ?? 0)
  )
  const totalInCollection = allGames.filter((g) => g.inCollection).length

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      {/* ---- Page header ---- */}
      <div>
        <h1 className="text-2xl font-bold text-rs-text">My Library</h1>
        <p className="mt-1 text-sm text-rs-text-secondary">
          {libraryGames.length} game{libraryGames.length !== 1 && 's'} shown
          {libraryGames.length !== totalInCollection &&
            ` (${totalInCollection} total in collection)`}
        </p>
      </div>

      <GameTypeFilterDropdown mode="library" />

      {/* ---- Game grid / empty state ---- */}
      {libraryGames.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Library size={48} strokeWidth={1} className="text-rs-text-secondary/30" />
          <p className="text-sm font-medium text-rs-text-secondary">
            {totalInCollection === 0
              ? 'Your library is empty'
              : 'No games match the current filter'}
          </p>
          <p className="max-w-xs text-center text-xs text-rs-text-secondary/60">
            {totalInCollection === 0
              ? 'Browse the dashboard and add games to your collection.'
              : 'Try adjusting the category filters above.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,150px)] gap-4">
          {libraryGames.map((game) => (
            <GameCard key={game.id} game={game} onClick={(g) => setSelectedGame(g)} />
          ))}
        </div>
      )}
    </div>
  )
}
