import { Heart, ExternalLink, Scale } from 'lucide-react'
import appIcon from '../assets/icon.png'

export default function AboutPage(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {/* ── Hero ──────────────────────────────────── */}
        <div className="flex flex-col items-center text-center">
          <img src={appIcon} alt="RetroSync" className="h-24 w-24 drop-shadow-lg" />

          <h1 className="mt-5 text-2xl font-bold text-rs-text">
            Retro<span className="text-rs-accent">Sync</span>
          </h1>
          <p className="mt-1 text-sm text-rs-text-secondary">Version 1.0.0</p>

          <p className="mt-6 max-w-md text-sm leading-relaxed text-rs-text-secondary">
            RetroSync is your retro gaming companion. Browse, organize, and manage your game library
            across platforms — all from a single, clean interface. Extend functionality with
            community add-ons tailored to your needs.
          </p>
        </div>

        {/* ── Features ─────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              title: 'Library',
              desc: 'Search, browse, and curate your retro game collection with rich metadata from IGDB.'
            },
            {
              title: 'Add-ons',
              desc: 'Extend the app with community-maintained add-ons for additional features and integrations.'
            },
            {
              title: 'Organization',
              desc: 'Keep your collection tidy with per-platform views, device profiles, and smart filtering.'
            }
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-rs-border bg-rs-panel p-4">
              <h3 className="text-xs font-semibold text-rs-text">{f.title}</h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-rs-text-secondary">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Legal ────────────────────────────────── */}
        <div className="rounded-xl border border-rs-border bg-rs-panel p-6">
          <div className="mb-3 flex items-center gap-2">
            <Scale size={16} className="text-rs-accent" />
            <h2 className="text-sm font-semibold text-rs-text">Legal Notice</h2>
          </div>
          <p className="text-xs leading-relaxed text-rs-text-secondary">
            This application is a library manager and does not include or distribute copyrighted
            content. Third-party add-ons are community-maintained, installed at the user&apos;s own
            risk, and are the sole responsibility of their respective authors and users.
          </p>
        </div>

        {/* ── Links / credits ──────────────────────── */}
        <div className="flex flex-col items-center gap-4 pb-8">
          <a
            href="https://github.com/tvcsantos/retrosync"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-rs-accent hover:underline"
          >
            <ExternalLink size={12} />
            GitHub Repository
          </a>

          <p className="flex items-center gap-1 text-[11px] text-rs-text-secondary">
            Made with <Heart size={12} className="text-red-400" /> for the retro gaming community
          </p>
        </div>
      </div>
    </div>
  )
}
