import { useState, useEffect } from 'react'
import {
  ChevronDown,
  Globe,
  CheckCircle2,
  XCircle,
  Gamepad2,
  Check,
  Plus,
  X,
  Trash2,
  AlertTriangle,
  FolderOpen
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface DeviceProfile {
  id: string
  name: string
  manufacturer: string
  platformIds: number[]
}

interface PlatformInfo {
  igdbId: number
  name: string
  shortName: string
}

interface CustomDeviceData {
  id: string
  name: string
  platformIds: number[]
}

export default function SettingsPage(): React.JSX.Element {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [igdbStatus, setIgdbStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle')

  // Devices state
  const [profiles, setProfiles] = useState<DeviceProfile[]>([])
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [customDevices, setCustomDevices] = useState<CustomDeviceData[]>([])
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [devicesDirty, setDevicesDirty] = useState(false)
  const [devicesSaving, setDevicesSaving] = useState(false)
  const [libraryPath, setLibraryPath] = useState('')
  const [importPath, setImportPath] = useState('')
  const [importCrossDevice, setImportCrossDevice] = useState(false)
  const [maxConcurrentImports, setMaxConcurrentImports] = useState(3)
  const loadDashboard = useAppStore((s) => s.loadDashboard)
  const checkIgdbConfig = useAppStore((s) => s.checkIgdbConfig)
  const refreshDeviceProfiles = useAppStore((s) => s.refreshDeviceProfiles)
  const importsBadgeStyle = useAppStore((s) => s.importsBadgeStyle)
  const setImportsBadgeStyle = useAppStore((s) => s.setImportsBadgeStyle)

  useEffect(() => {
    // Load config + device data in parallel
    Promise.all([
      window.api.config.get(),
      window.api.devices.getProfiles(),
      window.api.devices.getPlatforms()
    ]).then(([config, deviceProfiles, platformList]) => {
      setClientId(config.igdb.clientId)
      setClientSecret(config.igdb.clientSecret)
      if (config.igdb.clientId && config.igdb.clientSecret) {
        setIgdbStatus('connected')
      }
      setProfiles(deviceProfiles)
      setPlatforms(platformList)
      setSelectedDevices(new Set(config.devices ?? []))
      setCustomDevices(config.customDevices ?? [])
      setLibraryPath(config.libraryPath ?? '')
      setImportPath(config.importPath ?? '')
      setMaxConcurrentImports(config.maxConcurrentImports ?? 3)

      // Check cross-device status for import path
      if (config.importPath) {
        window.api.imports
          .checkSameFs(config.libraryPath, config.importPath)
          .then((same) => setImportCrossDevice(!same))
      }
    })
  }, [])

  const handleSaveAndTest = async (): Promise<void> => {
    setIgdbStatus('testing')
    try {
      await window.api.config.set({ igdb: { clientId, clientSecret } })
      const result = await window.api.config.testIgdb()
      setIgdbStatus(result ? 'connected' : 'error')
    } catch {
      setIgdbStatus('error')
    }
  }

  const toggleDevice = (id: string): void => {
    setSelectedDevices((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setDevicesDirty(true)
  }

  const removeCustomDevice = (id: string): void => {
    setCustomDevices((prev) => prev.filter((d) => d.id !== id))
    setDevicesDirty(true)
  }

  const handleSaveDevices = async (): Promise<void> => {
    setDevicesSaving(true)
    await window.api.config.set({
      devices: [...selectedDevices],
      customDevices
    })
    setDevicesDirty(false)
    setDevicesSaving(false)
    // Reload dashboard with new platform filter
    await checkIgdbConfig()
    loadDashboard()
    refreshDeviceProfiles()
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      {/* ── Page title ──────────────────────────────── */}
      <h1 className="text-2xl font-bold text-rs-text">Settings</h1>

      <div className="flex flex-col gap-6 max-w-2xl">
        {/* ── My Devices ──────────────────────────────── */}
        <section className="rounded-xl border border-rs-border bg-rs-panel p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <Gamepad2 size={18} className="text-rs-accent" />
            <div>
              <h2 className="text-sm font-semibold text-rs-text">My Devices</h2>
              <p className="text-xs text-rs-text-secondary">
                Games are filtered to platforms your device(s) can emulate
              </p>
            </div>
          </div>

          {/* Curated devices */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {profiles.map((device) => {
              const isSelected = selectedDevices.has(device.id)
              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => toggleDevice(device.id)}
                  className={`relative flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? 'border-rs-accent bg-rs-accent/10'
                      : 'border-rs-border bg-rs-panel-light hover:border-rs-text-secondary/30'
                  }`}
                >
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      isSelected ? 'border-rs-accent bg-rs-accent' : 'border-rs-text-secondary/40'
                    }`}
                  >
                    {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-rs-text truncate">{device.name}</p>
                    <p className="text-[10px] text-rs-text-secondary">{device.manufacturer}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Custom devices */}
          {customDevices.length > 0 && (
            <div className="mb-4 flex flex-col gap-2">
              <p className="text-xs font-medium text-rs-text-secondary">Custom Devices</p>
              {customDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border border-rs-accent/40 bg-rs-accent/5 px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium text-rs-text">{device.name}</p>
                    <p className="text-[10px] text-rs-text-secondary">
                      {device.platformIds.length} platforms
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustomDevice(device.id)}
                    className="rounded p-1 text-rs-text-secondary hover:bg-rs-danger/10 hover:text-rs-danger transition-colors"
                    aria-label="Remove device"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-rs-border px-3 py-2 text-xs text-rs-text-secondary hover:border-rs-accent hover:text-rs-accent transition-colors"
            >
              <Plus size={14} />
              Custom Device
            </button>

            {devicesDirty && (
              <button
                type="button"
                disabled={devicesSaving}
                onClick={handleSaveDevices}
                className="rounded-lg bg-rs-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rs-accent-hover disabled:opacity-60"
              >
                {devicesSaving ? 'Saving...' : 'Save & Reload'}
              </button>
            )}
          </div>
        </section>

        {/* ── IGDB API ──────────────────────────────────── */}
        <section className="rounded-xl border border-rs-border bg-rs-panel p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <Globe size={18} className="text-rs-accent" />
            <div>
              <h2 className="text-sm font-semibold text-rs-text">IGDB API</h2>
              <p className="text-xs text-rs-text-secondary">
                Configure your Twitch/IGDB credentials for game metadata and images
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-rs-text-secondary">Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter your Twitch Client ID"
                className="w-full rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 text-sm text-rs-text outline-none transition-colors placeholder:text-rs-text-secondary focus:border-rs-accent"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-rs-text-secondary">Client Secret</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Enter your Twitch Client Secret"
                className="w-full rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 text-sm text-rs-text outline-none transition-colors placeholder:text-rs-text-secondary focus:border-rs-accent"
              />
            </div>

            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                disabled={igdbStatus === 'testing'}
                onClick={handleSaveAndTest}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
              >
                {igdbStatus === 'testing' ? 'Testing\u2026' : 'Save & Test Connection'}
              </button>

              {/* Status indicator */}
              {igdbStatus === 'idle' && !clientId && !clientSecret && (
                <span className="text-xs text-rs-text-secondary">Not configured</span>
              )}
              {igdbStatus === 'testing' && (
                <span className="flex items-center gap-1.5 text-xs text-rs-text-secondary">
                  <svg
                    className="h-4 w-4 animate-spin text-indigo-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Testing connection&hellip;
                </span>
              )}
              {igdbStatus === 'connected' && (
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle2 size={14} />
                  Connected
                </span>
              )}
              {igdbStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <XCircle size={14} />
                  Invalid credentials
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Storage ─────────────────────────────── */}
        <section className="rounded-xl border border-rs-border bg-rs-panel p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <FolderOpen size={18} className="text-rs-accent" />
            <h2 className="text-sm font-semibold text-rs-text">Storage</h2>
          </div>

          {/* Library path */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-rs-text-secondary">Library path</p>
              <p className="mt-1 truncate rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 font-mono text-sm text-rs-text">
                {libraryPath || '~/RetroSync'}
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                const selected = await window.api.imports.selectLibraryPath()
                if (selected) {
                  setLibraryPath(selected)
                  await window.api.config.set({ libraryPath: selected })
                  // Re-check cross-device status if import path is custom
                  if (importPath) {
                    const same = await window.api.imports.checkSameFs(selected, importPath)
                    setImportCrossDevice(!same)
                  }
                }
              }}
              className="shrink-0 rounded-lg border border-rs-border px-4 py-2 text-sm font-medium text-rs-text-secondary transition-colors hover:bg-rs-panel-light hover:text-rs-text"
            >
              Change
            </button>
          </div>

          {/* Import directory */}
          <div className="mb-4">
            <p className="text-xs text-rs-text-secondary">Import directory</p>
            <div className="mt-1 flex items-center justify-between gap-4">
              <p className="min-w-0 flex-1 truncate rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 font-mono text-sm text-rs-text">
                {importPath || 'Default (app data)'}
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const selected = await window.api.imports.selectImportPath()
                    if (selected) {
                      setImportPath(selected)
                      const same = await window.api.imports.checkSameFs(libraryPath, selected)
                      setImportCrossDevice(!same)
                    }
                  }}
                  className="rounded-lg border border-rs-border px-4 py-2 text-sm font-medium text-rs-text-secondary transition-colors hover:bg-rs-panel-light hover:text-rs-text"
                >
                  Change
                </button>
                {importPath && (
                  <button
                    type="button"
                    onClick={async () => {
                      setImportPath('')
                      setImportCrossDevice(false)
                      await window.api.config.set({ importPath: '' })
                    }}
                    className="rounded-lg border border-rs-border px-4 py-2 text-sm font-medium text-rs-text-secondary transition-colors hover:bg-rs-panel-light hover:text-rs-text"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-[10px] text-rs-text-secondary">
              Where incoming data lands before being organized into the library
            </p>
            {importCrossDevice && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                <p className="text-xs text-amber-300">
                  The import directory is on a different drive than your library path. Completed
                  imports will need to be copied instead of instantly moved, which may be slower for
                  large files.
                </p>
              </div>
            )}
          </div>

          {/* Max concurrent imports */}
          <div className="mb-4">
            <label className="mb-1 block text-xs text-rs-text-secondary">
              Max concurrent imports
            </label>
            <div className="relative w-32">
              <select
                value={maxConcurrentImports}
                onChange={async (e) => {
                  const val = Number(e.target.value)
                  setMaxConcurrentImports(val)
                  await window.api.config.set({ maxConcurrentImports: val })
                }}
                className="w-full appearance-none rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 pr-9 text-sm text-rs-text outline-none transition-colors focus:border-rs-accent"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rs-text-secondary"
              />
            </div>
          </div>

          {/* Sidebar badge style */}
          <div>
            <label className="mb-1 block text-xs text-rs-text-secondary">Sidebar badge style</label>
            <div className="relative w-40">
              <select
                value={importsBadgeStyle}
                onChange={(e) => setImportsBadgeStyle(e.target.value as 'count' | 'dot' | 'none')}
                className="w-full appearance-none rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 pr-9 text-sm text-rs-text outline-none transition-colors focus:border-rs-accent"
              >
                <option value="count">Count</option>
                <option value="dot">Dot</option>
                <option value="none">None</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rs-text-secondary"
              />
            </div>
            <p className="mt-1 text-[10px] text-rs-text-secondary">
              How active imports are indicated on the sidebar
            </p>
          </div>
        </section>
      </div>

      {/* ── Custom Device Modal ─────────────────────── */}
      {showCustomModal && (
        <CustomDeviceModal
          platforms={platforms}
          onClose={() => setShowCustomModal(false)}
          onAdd={(device) => {
            setCustomDevices((prev) => [...prev, device])
            setDevicesDirty(true)
            setShowCustomModal(false)
          }}
        />
      )}
    </div>
  )
}

/* ── Custom Device Modal ─────────────────────────────── */

function CustomDeviceModal({
  platforms,
  onClose,
  onAdd
}: {
  platforms: PlatformInfo[]
  onClose: () => void
  onAdd: (device: CustomDeviceData) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = (id: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = (): void => {
    if (!name.trim() || selected.size === 0) return
    onAdd({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      platformIds: [...selected]
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-rs-panel p-6 shadow-2xl border border-rs-border">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-rs-text-secondary hover:text-rs-text transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <h3 className="mb-4 text-sm font-semibold text-rs-text">Add Custom Device</h3>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Device name"
          className="mb-4 w-full rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 text-sm text-rs-text placeholder:text-rs-text-secondary/50 outline-none focus:border-rs-accent"
        />

        <p className="mb-2 text-xs font-medium text-rs-text-secondary">Select Platforms</p>
        <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1 mb-4">
          {platforms.map((p) => {
            const on = selected.has(p.igdbId)
            return (
              <button
                key={p.igdbId}
                type="button"
                onClick={() => toggle(p.igdbId)}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-all ${
                  on
                    ? 'border-rs-accent bg-rs-accent/10 text-rs-text'
                    : 'border-rs-border text-rs-text-secondary hover:border-rs-text-secondary/30'
                }`}
              >
                <div
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                    on ? 'border-rs-accent bg-rs-accent' : 'border-rs-text-secondary/40'
                  }`}
                >
                  {on && <Check size={8} className="text-white" strokeWidth={3} />}
                </div>
                {p.shortName}
              </button>
            )
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-rs-border px-4 py-2 text-xs font-medium text-rs-text-secondary hover:text-rs-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || selected.size === 0}
            onClick={handleSubmit}
            className="rounded-lg bg-rs-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rs-accent-hover disabled:opacity-40"
          >
            Add Device
          </button>
        </div>
      </div>
    </div>
  )
}
