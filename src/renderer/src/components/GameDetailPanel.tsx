import { useEffect, useCallback, useRef, useState } from 'react'
import {
  ArrowLeft,
  X,
  Star,
  AlertTriangle,
  Download,
  Disc,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Gamepad2
} from 'lucide-react'
import type { Game } from '../types'
import { useAppStore } from '../store/useAppStore'
import AddonSourcesSection from './AddonSourcesSection'
import log from 'electron-log/renderer'

const imgLog = log.scope('img')

/** IGDB platform IDs known to require BIOS files. */
const BIOS_PLATFORM_IDS = new Set([7, 8, 21, 11])

interface GameDetailPanelProps {
  game: Game | null
  onClose: () => void
}

export default function GameDetailPanel({
  game,
  onClose
}: GameDetailPanelProps): React.JSX.Element | null {
  const toggleCollection = useAppStore((s) => s.toggleCollection)
  const fetchGameDetails = useAppStore((s) => s.fetchGameDetails)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const gameTypeDefinitions = useAppStore((s) => s.gameTypeDefinitions)
  const sourcesDisplayMode = useAppStore((s) => s.sourcesDisplayMode)
  const selectedDeviceProfiles = useAppStore((s) => s.selectedDeviceProfiles)
  const [visible, setVisible] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const wheelCooldownRef = useRef(false)

  const WHEEL_COOLDOWN = 500

  // Reset visibility + lightbox during render when game changes (avoids
  // synchronous setState inside useEffect, which React 19 warns about).
  const [prevGame, setPrevGame] = useState(game)
  if (game !== prevGame) {
    setPrevGame(game)
    if (!game) setVisible(false)
    setLightboxIndex(null)
  }

  const onLightboxWheel = useCallback(
    (e: React.WheelEvent): void => {
      if (lightboxIndex === null || !game || game.screenshots.length <= 1) return
      if (wheelCooldownRef.current) return
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(delta) < 5) return
      e.preventDefault()
      wheelCooldownRef.current = true
      if (delta > 0 && lightboxIndex < game.screenshots.length - 1) {
        setLightboxIndex(lightboxIndex + 1)
      } else if (delta < 0 && lightboxIndex > 0) {
        setLightboxIndex(lightboxIndex - 1)
      }
      setTimeout(() => {
        wheelCooldownRef.current = false
      }, WHEEL_COOLDOWN)
    },
    [lightboxIndex, game]
  )

  /* Trigger slide-in animation after mount */
  useEffect(() => {
    if (!game) return
    // Tiny delay so the browser paints the off-screen state first
    const raf = requestAnimationFrame(() => setVisible(true))
    return (): void => {
      cancelAnimationFrame(raf)
    }
  }, [game])

  /* Fetch full IGDB details when opening an IGDB game */
  useEffect(() => {
    if (game?.igdbId && !game.igdbDetailsFetched) {
      const id = game.igdbId
      queueMicrotask(() => fetchGameDetails(id))
    }
  }, [game?.igdbId, game?.igdbDetailsFetched, fetchGameDetails])

  /* Keyboard: Escape to close, Left/Right arrows to navigate lightbox */
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (lightboxIndex !== null) {
          setLightboxIndex(null)
        } else {
          onClose()
        }
      }
      if (lightboxIndex !== null && game) {
        if (e.key === 'ArrowLeft' && lightboxIndex > 0) {
          setLightboxIndex(lightboxIndex - 1)
        }
        if (e.key === 'ArrowRight' && lightboxIndex < game.screenshots.length - 1) {
          setLightboxIndex(lightboxIndex + 1)
        }
      }
    }
    if (game) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [game, onClose, lightboxIndex])

  if (!game) return null

  // Check if any of this game's platforms are known to require BIOS files
  const needsBios = game.igdbPlatformIds.some((pid) => BIOS_PLATFORM_IDS.has(pid))
  const gameTypeLabel =
    game.igdbGameType != null
      ? gameTypeDefinitions.find((d) => d.id === game.igdbGameType)?.label
      : undefined
  const renderStars = (rating: number): React.JSX.Element[] => {
    const stars: React.JSX.Element[] = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={16}
          className={
            i <= Math.round(rating)
              ? 'fill-rs-warning text-rs-warning'
              : 'text-rs-text-secondary/40'
          }
        />
      )
    }
    return stars
  }

  return (
    /* Root portal-like layer */
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`relative z-10 flex h-full w-full max-w-[600px] flex-col overflow-y-auto border-l border-rs-border bg-rs-panel/95 backdrop-blur-md transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* ───── Header ───── */}
        <div className="sticky top-0 z-20 flex items-center justify-between bg-rs-panel/90 px-6 py-4 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg p-1.5 text-rs-text-secondary transition-colors hover:bg-rs-panel-light hover:text-rs-text"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-rs-text-secondary transition-colors hover:bg-rs-panel-light hover:text-rs-text"
            aria-label="Close panel"
          >
            <X size={20} />
          </button>
        </div>

        {/* ───── Content ───── */}
        <div className="flex flex-col gap-6 px-6 pb-8">
          {/* ── Box art + metadata row ── */}
          <div className="flex gap-5">
            {/* Box art */}
            <img
              src={game.boxArtUrl}
              alt={game.title}
              className="h-auto w-[200px] shrink-0 rounded-xl object-cover shadow-lg"
              draggable={false}
              onError={(e) =>
                imgLog.error(
                  'DetailPanel box art failed:',
                  game.title,
                  'src:',
                  (e.target as HTMLImageElement).src.substring(0, 100)
                )
              }
            />

            {/* Metadata */}
            <div className="flex min-w-0 flex-col gap-2 pt-1">
              <h2 className="text-2xl font-bold leading-tight text-rs-text">
                {game.title}
                {game.igdbUrl && (
                  <a
                    href={game.igdbUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 inline-flex translate-y-[-2px] items-center gap-1 rounded-full border border-rs-border px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-rs-text-secondary transition-colors hover:border-rs-accent hover:text-rs-accent"
                  >
                    IGDB
                    <ExternalLink size={10} />
                  </a>
                )}
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {game.platforms.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-rs-panel-light px-2.5 py-0.5 text-xs font-medium text-rs-text-secondary"
                  >
                    {p}
                  </span>
                ))}
              </div>

              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {gameTypeLabel && (
                  <>
                    <dt className="text-rs-text-secondary">Type</dt>
                    <dd className="text-rs-text">{gameTypeLabel}</dd>
                  </>
                )}

                <dt className="text-rs-text-secondary">Developer</dt>
                <dd className="text-rs-text">{game.developer}</dd>

                <dt className="text-rs-text-secondary">Year</dt>
                <dd className="text-rs-text">{game.year}</dd>

                <dt className="text-rs-text-secondary">Genre</dt>
                <dd className="text-rs-text">{game.genre}</dd>

                <dt className="text-rs-text-secondary">Size</dt>
                <dd className="text-rs-text">{game.fileSize}</dd>
              </dl>
            </div>
          </div>

          {/* ── Screenshots ── */}
          {game.screenshots.length > 0 && (
            <section>
              <h3 className="mb-2.5 text-sm font-semibold text-rs-text">Screenshots</h3>
              <div className="grid grid-cols-4 gap-3">
                {game.screenshots.map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className="cursor-zoom-in overflow-hidden rounded-lg border border-rs-border transition-transform duration-150 hover:scale-105 hover:border-rs-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rs-accent"
                  >
                    <img
                      src={src}
                      alt={`${game.title} screenshot ${idx + 1}`}
                      className="w-full rounded-lg object-cover"
                      draggable={false}
                      onError={(e) =>
                        imgLog.error(
                          'DetailPanel screenshot failed:',
                          game.title,
                          `[${idx}]`,
                          'src:',
                          (e.target as HTMLImageElement).src.substring(0, 100)
                        )
                      }
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Plot ── */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-rs-text">Plot</h3>
            <p className="text-sm leading-relaxed text-rs-text-secondary">{game.description}</p>
          </section>

          {/* ── User Ratings ── */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-rs-text">User Rating</h3>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">{renderStars(game.rating)}</div>
              <span className="text-sm font-medium text-rs-text">{game.rating.toFixed(1)}</span>
              <span className="text-xs text-rs-text-secondary">/ 5</span>
            </div>
          </section>

          {/* ── Compatible Devices ── */}
          {selectedDeviceProfiles.length >= 2 &&
            game.igdbPlatformIds.length > 0 &&
            (() => {
              const gamePlatforms = new Set(game.igdbPlatformIds)
              const compatible = selectedDeviceProfiles.filter((d) =>
                d.platformIds.some((pid) => gamePlatforms.has(pid))
              )
              const incompatible = selectedDeviceProfiles.filter(
                (d) => !d.platformIds.some((pid) => gamePlatforms.has(pid))
              )
              return (
                <section>
                  <div className="mb-2.5 flex items-center gap-2">
                    <Gamepad2 size={16} className="text-rs-accent" />
                    <h3 className="text-sm font-semibold text-rs-text">Compatible Devices</h3>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {compatible.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2 rounded-lg bg-rs-panel-light px-3 py-1.5"
                      >
                        <CheckCircle2 size={14} className="shrink-0 text-rs-success" />
                        <span className="text-xs text-rs-text">{d.name}</span>
                      </div>
                    ))}
                    {incompatible.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2 rounded-lg bg-rs-panel-light px-3 py-1.5 opacity-50"
                      >
                        <XCircle size={14} className="shrink-0 text-rs-text-secondary" />
                        <span className="text-xs text-rs-text-secondary">{d.name}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })()}

          {/* ── Addon Sources ── */}
          {game.igdbPlatformIds.length > 0 && (
            <AddonSourcesSection
              gameName={game.title}
              platformIds={game.igdbPlatformIds}
              displayMode={sourcesDisplayMode}
            />
          )}

          {/* ── Multi-disc support ── */}
          {game.isMultiDisc && game.discs.length > 0 && (
            <section>
              <h3 className="mb-2.5 text-sm font-semibold text-rs-text">Multi-disc Support</h3>
              <div className="flex flex-col gap-2">
                {game.discs.map((disc, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-rs-border bg-rs-panel-light p-3"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <Disc size={14} className="text-rs-accent" />
                      <span className="text-sm font-semibold text-rs-text">{disc.label}</span>
                    </div>
                    <ul className="flex flex-col gap-0.5">
                      {disc.files.map((file, fIdx) => (
                        <li
                          key={fIdx}
                          className="truncate text-xs font-mono text-rs-text-secondary"
                        >
                          {file}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── BIOS notice ── */}
          {needsBios && (
            <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="shrink-0 text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-rs-text">
                  BIOS Required
                </h3>
              </div>
              <p className="mt-1 text-xs text-rs-text-secondary">
                This platform requires BIOS files to run games. Check Platform Setup to configure
                the required firmware.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  setCurrentPage('platform-setup')
                }}
                className="mt-2 text-xs font-semibold text-rs-accent transition-colors hover:text-rs-accent-hover"
              >
                Go to Platform Setup &rarr;
              </button>
            </section>
          )}

          {/* ── Action buttons ── */}
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleCollection(game.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rs-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rs-accent-hover"
            >
              <Download size={16} />
              {game.inCollection ? 'REMOVE FROM COLLECTION' : 'ADD TO COLLECTION'}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Screenshot lightbox ── */}
      {lightboxIndex !== null && game.screenshots[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setLightboxIndex(null)}
          onWheel={onLightboxWheel}
          aria-hidden="true"
        >
          {/* Previous arrow */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setLightboxIndex(lightboxIndex - 1)
              }}
              className="absolute left-4 z-10 rounded-full bg-black/50 p-2 text-white/70 transition-colors hover:bg-black/70 hover:text-white"
              aria-label="Previous screenshot"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Image */}
          <img
            key={lightboxIndex}
            src={game.screenshots[lightboxIndex]}
            alt={`Screenshot ${lightboxIndex + 1} of ${game.screenshots.length}`}
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl object-contain animate-lightbox-in"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next arrow */}
          {lightboxIndex < game.screenshots.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setLightboxIndex(lightboxIndex + 1)
              }}
              className="absolute right-4 z-10 rounded-full bg-black/50 p-2 text-white/70 transition-colors hover:bg-black/70 hover:text-white"
              aria-label="Next screenshot"
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Counter */}
          {game.screenshots.length > 1 && (
            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/80">
              {lightboxIndex + 1} / {game.screenshots.length}
            </span>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 rounded-lg bg-black/50 p-2 text-white/70 transition-colors hover:bg-black/70 hover:text-white"
            aria-label="Close preview"
          >
            <X size={20} />
          </button>

          {/* Preload adjacent images */}
          {lightboxIndex > 0 && (
            <link rel="preload" as="image" href={game.screenshots[lightboxIndex - 1]} />
          )}
          {lightboxIndex < game.screenshots.length - 1 && (
            <link rel="preload" as="image" href={game.screenshots[lightboxIndex + 1]} />
          )}

          <style>{`
            @keyframes lightbox-in {
              from { opacity: 0; transform: scale(0.92); }
              to   { opacity: 1; transform: scale(1); }
            }
            .animate-lightbox-in {
              animation: lightbox-in 0.2s ease-out both;
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
