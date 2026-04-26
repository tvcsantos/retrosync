import type { Game } from '../types'
import log from 'electron-log/renderer'

const imgLog = log.scope('img')

interface GameCardProps {
  game: Game
  onClick: (game: Game) => void
}

export default function GameCard({ game, onClick }: GameCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onClick(game)}
      className="group w-[150px] shrink-0 cursor-pointer rounded-lg bg-rs-panel text-left transition-transform duration-200 ease-out hover:scale-105 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rs-accent"
    >
      {/* Box art wrapper — 3:4 portrait ratio to match game cover art */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg">
        <img
          src={game.boxArtUrl}
          alt={game.title}
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
          onError={(e) =>
            imgLog.error(
              'GameCard load failed:',
              game.title,
              'src:',
              (e.target as HTMLImageElement).src.substring(0, 100)
            )
          }
        />

        {/* Platform badges – bottom-left, overlapping the art */}
        <div className="absolute bottom-1.5 left-1.5 flex flex-wrap gap-1">
          {game.platformsShort.map((p) => (
            <span
              key={p}
              className="rounded-full bg-rs-bg/80 px-2 py-0.5 text-[10px] font-semibold leading-tight text-rs-text-secondary backdrop-blur-sm"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Title beneath the art */}
      <p className="truncate px-1 pt-1.5 pb-2 text-xs font-medium text-rs-text">{game.title}</p>
    </button>
  )
}
