import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import appIcon from '../assets/icon.png'

export default function SplashScreen({
  onFinished
}: {
  onFinished: () => void
}): React.JSX.Element {
  const initStatus = useAppStore((s) => s.initStatus)
  const appInitialized = useAppStore((s) => s.appInitialized)
  const initializeApp = useAppStore((s) => s.initializeApp)
  const [fadeOut, setFadeOut] = useState(false)

  // Trigger fade-out during render when initialisation finishes (avoids
  // synchronous setState inside useEffect, which React 19 warns about).
  const [prevInitialized, setPrevInitialized] = useState(appInitialized)
  if (appInitialized && !prevInitialized) {
    setPrevInitialized(true)
    setFadeOut(true)
  }

  useEffect(() => {
    // Defer to microtask so the synchronous set() inside initializeApp
    // doesn't run within the effect's synchronous body.
    queueMicrotask(() => initializeApp())
  }, [initializeApp])

  useEffect(() => {
    if (!appInitialized) return
    const timer = setTimeout(onFinished, 600)
    return () => clearTimeout(timer)
  }, [appInitialized, onFinished])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-rs-bg transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Scanline overlay */}
      <div className="pointer-events-none absolute inset-0 splash-scanlines" />

      {/* Glow backdrop */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-rs-accent/10 blur-[120px]" />

      {/* Logo */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Animated logo mark */}
        <div className="relative splash-logo-enter">
          <div className="absolute -inset-6 rounded-3xl bg-rs-accent/15 blur-2xl splash-pulse" />
          <img src={appIcon} alt="RetroSync" className="relative h-32 w-32 drop-shadow-2xl" />
        </div>

        {/* App name */}
        <div className="splash-text-enter">
          <h1 className="text-3xl font-bold tracking-wider text-rs-text">
            Retro<span className="text-rs-accent">Sync</span>
          </h1>
          <p className="mt-1 text-center text-xs tracking-widest uppercase text-rs-text-secondary">
            Your retro gaming companion
          </p>
        </div>

        {/* Loading bar */}
        <div className="mt-6 w-48 splash-bar-enter">
          <div className="h-1 w-full rounded-full bg-rs-panel overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-rs-accent to-indigo-400 splash-bar-fill" />
          </div>
          <p className="mt-3 text-center text-xs text-rs-text-secondary splash-status-fade">
            {initStatus}
          </p>
        </div>
      </div>

      <style>{`
        /* Retro scanlines */
        .splash-scanlines {
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.08) 2px,
            rgba(0, 0, 0, 0.08) 4px
          );
        }

        /* Logo entrance */
        .splash-logo-enter {
          animation: logoEnter 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes logoEnter {
          from { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        /* Text entrance */
        .splash-text-enter {
          animation: textEnter 0.7s ease-out 0.3s both;
        }
        @keyframes textEnter {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Loading bar container entrance */
        .splash-bar-enter {
          animation: textEnter 0.6s ease-out 0.6s both;
        }

        /* Indeterminate loading bar */
        .splash-bar-fill {
          width: 40%;
          animation: barSlide 1.4s ease-in-out infinite;
        }
        @keyframes barSlide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }

        /* Glow pulse */
        .splash-pulse {
          animation: pulse 2.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 0.8; transform: scale(1.15); }
        }

        /* Status text fade */
        .splash-status-fade {
          animation: statusFade 0.3s ease-out both;
        }
        @keyframes statusFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
