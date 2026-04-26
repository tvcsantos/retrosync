import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Game } from '../types'
import log from 'electron-log/renderer'

const imgLog = log.scope('img')

interface HeroBannerProps {
  games: Game[]
  onClick: (game: Game) => void
}

const AUTO_INTERVAL = 5000
const WHEEL_COOLDOWN = 600
const TRANSITION_MS = 500

export default function HeroBanner({ games, onClick }: HeroBannerProps): React.JSX.Element | null {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wheelCooldownRef = useRef(false)

  const count = games.length

  // Reset index during render when games change (avoids synchronous
  // setState inside useEffect, which React 19 warns about).
  const [prevGames, setPrevGames] = useState(games)
  if (games !== prevGames) {
    setPrevGames(games)
    setActiveIndex(0)
  }

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning) return
      setIsTransitioning(true)
      setActiveIndex(((index % count) + count) % count)
      setTimeout(() => setIsTransitioning(false), TRANSITION_MS)
    },
    [count, isTransitioning]
  )

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo])
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo])

  // Auto-rotate
  useEffect(() => {
    if (count <= 1 || isHovered) {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      return
    }
    timerRef.current = setInterval(next, AUTO_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [count, isHovered, next])

  // Reset timer on manual navigation
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (count > 1 && !isHovered) {
      timerRef.current = setInterval(next, AUTO_INTERVAL)
    }
  }, [count, isHovered, next])

  const handlePrev = (): void => {
    prev()
    resetTimer()
  }

  const handleNext = (): void => {
    next()
    resetTimer()
  }

  // Wheel / trackpad scroll to change slides
  const onWheel = useCallback(
    (e: React.WheelEvent): void => {
      if (count <= 1 || wheelCooldownRef.current) return
      // Use deltaX for horizontal scroll, fall back to deltaY for vertical scroll wheel
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(delta) < 5) return
      e.preventDefault()
      wheelCooldownRef.current = true
      if (delta > 0) next()
      else prev()
      resetTimer()
      setTimeout(() => {
        wheelCooldownRef.current = false
      }, WHEEL_COOLDOWN)
    },
    [count, next, prev, resetTimer]
  )

  if (count === 0) return null

  return (
    <section className="flex flex-col gap-3">
      {/* Banner container */}
      <div
        className="group relative h-[300px] w-full overflow-hidden rounded-xl select-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onWheel={onWheel}
      >
        {/* Slides */}
        {games.map((game, index) => {
          const isActive = index === activeIndex
          const backgroundImage = game.heroImageUrl || game.boxArtUrl

          return (
            <button
              key={game.id}
              type="button"
              onClick={() => onClick(game)}
              className={`absolute inset-0 h-full w-full cursor-pointer text-left transition-opacity ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rs-accent ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
              style={{ transitionDuration: `${TRANSITION_MS}ms` }}
              tabIndex={isActive ? 0 : -1}
            >
              {/* Background image */}
              <img
                src={backgroundImage}
                alt={game.title}
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
                onError={(e) =>
                  imgLog.error(
                    'HeroBanner load failed:',
                    game.title,
                    'src:',
                    (e.target as HTMLImageElement).src.substring(0, 100)
                  )
                }
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 via-40% to-transparent" />

              {/* Content overlay */}
              <div className="relative flex h-full flex-col justify-end gap-3 px-14 py-8">
                <span className="w-fit rounded-full bg-rs-accent px-3 py-1 text-xs font-semibold tracking-wide text-white">
                  Featured Title
                </span>

                <h2 className="max-w-lg text-3xl font-bold leading-tight text-white drop-shadow-lg">
                  {game.title}
                </h2>

                <p className="line-clamp-3 max-w-md text-sm leading-relaxed text-rs-text-secondary">
                  {game.description}
                </p>

                <div className="flex items-center gap-3 text-xs text-rs-text-secondary">
                  <div className="flex items-center gap-1.5">
                    {game.platforms.map((p) => (
                      <span key={p} className="rounded bg-rs-panel/60 px-2 py-0.5 backdrop-blur-sm">
                        {p}
                      </span>
                    ))}
                  </div>
                  <span>{game.year}</span>
                  <span className="text-rs-text-secondary/60">&middot;</span>
                  <span>{game.genre}</span>
                </div>
              </div>
            </button>
          )
        })}
        {/* Arrow navigation */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white/70 opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-black/60 hover:text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next slide"
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white/70 opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-black/60 hover:text-white"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {/* Pagination dots (indicator only) */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {games.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-rs-text-secondary/40'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
