import { useAppStore } from '../store/useAppStore'
import HeroBanner from '../components/HeroBanner'
import GameCard from '../components/GameCard'
import GameTypeFilterDropdown from '../components/GameTypeFilterDropdown'
import { ChevronRight, Loader2 } from 'lucide-react'
import type { Game } from '../types'

export default function DashboardPage(): React.JSX.Element {
  const categories = useAppStore((s) => s.categories)
  const featuredGames = useAppStore((s) => s.featuredGames)
  const setSelectedGame = useAppStore((s) => s.setSelectedGame)
  const allGames = useAppStore((s) => s.allGames)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const igdbSearchResults = useAppStore((s) => s.igdbSearchResults)
  const isSearchingIGDB = useAppStore((s) => s.isSearchingIGDB)
  const igdbConfigured = useAppStore((s) => s.igdbConfigured)

  const handleGameClick = (game: Game): void => {
    setSelectedGame(game)
  }

  // Hybrid search view
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    const localResults = allGames.filter(
      (g) =>
        g.inCollection &&
        (g.title.toLowerCase().includes(query) ||
          g.platforms.some((p) => p.toLowerCase().includes(query)) ||
          g.genre.toLowerCase().includes(query) ||
          g.developer.toLowerCase().includes(query))
    )

    return (
      <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
        <h1 className="text-2xl font-bold text-rs-text">
          Search Results for &ldquo;{searchQuery}&rdquo;
        </h1>

        {/* In Your Collection */}
        <section>
          <h2 className="text-lg font-semibold text-rs-text mb-3">In Your Collection</h2>
          {localResults.length === 0 ? (
            <p className="text-rs-text-secondary">No games found in your collection.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {localResults.map((game) => (
                <GameCard key={game.id} game={game} onClick={handleGameClick} />
              ))}
            </div>
          )}
        </section>

        {/* Results from IGDB */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-rs-text">Results from IGDB</h2>
            {isSearchingIGDB && (
              <Loader2 size={16} className="text-rs-text-secondary animate-spin" />
            )}
          </div>
          {!igdbConfigured ? (
            <p className="text-rs-text-secondary text-sm">
              Configure IGDB in Settings for online search results
            </p>
          ) : isSearchingIGDB ? null : igdbSearchResults.length === 0 ? (
            <p className="text-rs-text-secondary">No results from IGDB</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {igdbSearchResults.map((game) => (
                <GameCard key={game.id} game={game} onClick={handleGameClick} />
              ))}
            </div>
          )}
        </section>
      </div>
    )
  }

  // Normal dashboard view
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <div>
        <h1 className="text-2xl font-bold text-rs-text">Dashboard</h1>
        <div className="mt-1">
          <GameTypeFilterDropdown mode="dashboard" />
        </div>
      </div>
      <div>
        {featuredGames.length > 0 && <HeroBanner games={featuredGames} onClick={handleGameClick} />}
      </div>

      {categories.map((category) => (
        <section key={category.id}>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-rs-text">{category.title}</h2>
            <ChevronRight size={18} className="text-rs-text-secondary" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {category.games.map((game) => (
              <GameCard key={game.id} game={game} onClick={handleGameClick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
