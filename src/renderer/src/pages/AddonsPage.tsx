import { useState, useEffect, useCallback } from 'react'
import {
  Puzzle,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  RefreshCw,
  Trash,
  ChevronDown,
  Database,
  Shield,
  Plus,
  Trash2,
  AlertTriangle,
  Settings2,
  FolderOpen
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface AddonConfigField {
  key: string
  label: string
  type: 'boolean' | 'select' | 'multi-select' | 'number' | 'path'
  options?: { label: string; value: string }[]
  default: unknown
}

interface AddonManifest {
  id: string
  name: string
  version: string
  author: string
  description: string
  capabilities: string[]
  configSchema?: AddonConfigField[]
}

interface AddonStatus {
  indexedItems: number
  lastUpdated: string | null
  details?: Record<string, unknown>
}

interface AddonInfo {
  manifest: AddonManifest
  enabled: boolean
  builtIn: boolean
  status: AddonStatus | null
}

export default function AddonsPage(): React.JSX.Element {
  const [addons, setAddons] = useState<AddonInfo[]>([])
  const [loading, setLoading] = useState(true)
  const sourcesDisplayMode = useAppStore((s) => s.sourcesDisplayMode)
  const setSourcesDisplayMode = useAppStore((s) => s.setSourcesDisplayMode)
  const [expandedAddon, setExpandedAddon] = useState<string | null>(null)
  const [addonConfigs, setAddonConfigs] = useState<Record<string, Record<string, unknown>>>({})
  const [buildingIndex, setBuildingIndex] = useState<string | null>(null)
  const [clearingData, setClearingData] = useState<string | null>(null)
  const [installPreview, setInstallPreview] = useState<{
    manifest: AddonManifest
    sourcePath: string
  } | null>(null)
  const [installing, setInstalling] = useState(false)
  const [uninstalling, setUninstalling] = useState<string | null>(null)

  const loadAddons = useCallback(async () => {
    const list = await window.api.addons.list()
    setAddons(list)
    // Load configs for each addon
    const configs: Record<string, Record<string, unknown>> = {}
    for (const addon of list) {
      configs[addon.manifest.id] = await window.api.addons.getConfig(addon.manifest.id)
    }
    setAddonConfigs(configs)
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => loadAddons())
  }, [loadAddons])

  const handleToggle = async (addonId: string, currentEnabled: boolean): Promise<void> => {
    await window.api.addons.setEnabled(addonId, !currentEnabled)
    await loadAddons()
  }

  const handleBuildIndex = async (addonId: string): Promise<void> => {
    setBuildingIndex(addonId)
    await window.api.addons.buildIndex(addonId)
    await loadAddons()
    setBuildingIndex(null)
  }

  const handleClearData = async (addonId: string): Promise<void> => {
    setClearingData(addonId)
    await window.api.addons.clearData(addonId)
    await loadAddons()
    setClearingData(null)
  }

  const handleConfigChange = async (
    addonId: string,
    key: string,
    value: unknown
  ): Promise<void> => {
    const current = addonConfigs[addonId] ?? {}
    const updated = { ...current, [key]: value }
    await window.api.addons.setConfig(addonId, updated)
    setAddonConfigs((prev) => ({ ...prev, [addonId]: updated }))
  }

  const handleInstall = async (): Promise<void> => {
    const result = await window.api.addons.install()
    if (result.ok && result.data) {
      setInstallPreview(result.data)
    }
  }

  const handleInstallConfirm = async (): Promise<void> => {
    if (!installPreview) return
    setInstalling(true)
    try {
      await window.api.addons.installConfirm(installPreview.sourcePath)
      setInstallPreview(null)
      await loadAddons()
    } catch {
      // Error handled by IPC
    } finally {
      setInstalling(false)
    }
  }

  const handleUninstall = async (addonId: string): Promise<void> => {
    setUninstalling(addonId)
    try {
      await window.api.addons.uninstall(addonId)
      await loadAddons()
    } finally {
      setUninstalling(null)
    }
  }

  const capabilityIcon = (cap: string): React.JSX.Element => {
    switch (cap) {
      case 'sources:games':
        return <Database size={10} />
      case 'sources:bios':
        return <Shield size={10} />
      default:
        return <Puzzle size={10} />
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw size={20} className="animate-spin text-rs-text-secondary" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      {/* ── Header ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rs-text">Add-ons</h1>
          <p className="mt-1 text-sm text-rs-text-secondary">
            Manage your content sources and extensions
          </p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="flex items-center gap-2 rounded-lg bg-rs-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rs-accent-hover"
        >
          <Plus size={16} />
          Install Add-on
        </button>
      </div>

      <div className="flex flex-col gap-4 max-w-2xl">
        {addons.length > 0 ? (
          addons.map((addon) => {
            const isExpanded = expandedAddon === addon.manifest.id
            const config = addonConfigs[addon.manifest.id] ?? {}
            const isBuilding = buildingIndex === addon.manifest.id
            const isClearing = clearingData === addon.manifest.id

            return (
              <div
                key={addon.manifest.id}
                className="rounded-xl border border-rs-border bg-rs-panel transition-colors"
              >
                {/* ── Addon header ── */}
                <div className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-semibold text-rs-text">{addon.manifest.name}</h3>
                      <span className="rounded-full bg-rs-panel-light px-2 py-0.5 text-[10px] font-medium text-rs-text-secondary">
                        v{addon.manifest.version}
                      </span>
                      {addon.builtIn && (
                        <span className="rounded-full bg-rs-accent/10 px-2 py-0.5 text-[10px] font-medium text-rs-accent">
                          Built-in
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-rs-text-secondary">
                      {addon.manifest.description}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-xs text-rs-text-secondary">
                        <ExternalLink size={12} />
                        {addon.manifest.author}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {addon.manifest.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="flex items-center gap-1 rounded-full bg-rs-panel-light px-2 py-0.5 text-[10px] font-medium text-rs-text-secondary"
                          >
                            {capabilityIcon(cap)}
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={addon.enabled}
                      onClick={() => handleToggle(addon.manifest.id, addon.enabled)}
                      title={addon.enabled ? 'Disable add-on' : 'Enable add-on'}
                      className="text-rs-text-secondary transition-colors hover:text-rs-text"
                    >
                      {addon.enabled ? (
                        <ToggleRight size={28} className="text-rs-accent" />
                      ) : (
                        <ToggleLeft size={28} />
                      )}
                    </button>

                    {!addon.builtIn && (
                      <button
                        type="button"
                        disabled={uninstalling === addon.manifest.id}
                        onClick={() => handleUninstall(addon.manifest.id)}
                        title="Uninstall add-on"
                        className="rounded-lg p-1.5 text-rs-text-secondary transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedAddon(isExpanded ? null : addon.manifest.id)}
                      className="rounded-lg p-1.5 text-rs-text-secondary transition-colors hover:bg-rs-panel-light hover:text-rs-text"
                      title="Settings"
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {/* ── Expanded settings ── */}
                {isExpanded && (
                  <div className="border-t border-rs-border px-5 py-4">
                    {/* Status */}
                    {addon.status && (
                      <div className="mb-4 rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-rs-text-secondary">Indexed items</span>
                          <span className="font-medium text-rs-text">
                            {addon.status.indexedItems.toLocaleString()}
                          </span>
                        </div>
                        {addon.status.lastUpdated && (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-rs-text-secondary">Last updated</span>
                            <span className="font-medium text-rs-text">
                              {new Date(addon.status.lastUpdated).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Config fields */}
                    {addon.manifest.configSchema && addon.manifest.configSchema.length > 0 && (
                      <div className="mb-4 flex flex-col gap-3">
                        {addon.manifest.configSchema.map((field) => (
                          <div key={field.key}>
                            {field.type === 'select' && (
                              <div>
                                <label className="mb-1 block text-xs text-rs-text-secondary">
                                  {field.label}
                                </label>
                                <div className="relative w-56">
                                  <select
                                    value={
                                      (config[field.key] as string) ?? (field.default as string)
                                    }
                                    onChange={(e) =>
                                      handleConfigChange(
                                        addon.manifest.id,
                                        field.key,
                                        e.target.value
                                      )
                                    }
                                    className="w-full appearance-none rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 pr-9 text-sm text-rs-text outline-none transition-colors focus:border-rs-accent"
                                  >
                                    {field.options?.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown
                                    size={14}
                                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rs-text-secondary"
                                  />
                                </div>
                              </div>
                            )}
                            {field.type === 'number' && (
                              <div>
                                <label className="mb-1 block text-xs text-rs-text-secondary">
                                  {field.label}
                                </label>
                                <input
                                  type="number"
                                  value={(config[field.key] as number) ?? (field.default as number)}
                                  onChange={(e) =>
                                    handleConfigChange(
                                      addon.manifest.id,
                                      field.key,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-24 rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 text-sm text-rs-text outline-none transition-colors focus:border-rs-accent"
                                />
                              </div>
                            )}
                            {field.type === 'boolean' && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-rs-text-secondary">
                                  {field.label}
                                </span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={
                                    (config[field.key] as boolean) ?? (field.default as boolean)
                                  }
                                  onClick={() =>
                                    handleConfigChange(
                                      addon.manifest.id,
                                      field.key,
                                      !(
                                        (config[field.key] as boolean) ?? (field.default as boolean)
                                      )
                                    )
                                  }
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                                    ((config[field.key] as boolean) ?? (field.default as boolean))
                                      ? 'bg-rs-accent'
                                      : 'bg-rs-panel-light'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                                      ((config[field.key] as boolean) ?? (field.default as boolean))
                                        ? 'translate-x-4'
                                        : 'translate-x-0.5'
                                    }`}
                                  />
                                </button>
                              </div>
                            )}
                            {field.type === 'multi-select' && field.options && (
                              <div>
                                <label className="mb-2 block text-xs text-rs-text-secondary">
                                  {field.label}
                                </label>
                                <div className="flex flex-col gap-1.5">
                                  {field.options.map((opt) => {
                                    const selected: string[] =
                                      (config[field.key] as string[]) ??
                                      (field.default as string[]) ??
                                      []
                                    const checked = selected.includes(opt.value)
                                    return (
                                      <label
                                        key={opt.value}
                                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-rs-panel-light"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => {
                                            const next = checked
                                              ? selected.filter((v) => v !== opt.value)
                                              : [...selected, opt.value]
                                            handleConfigChange(addon.manifest.id, field.key, next)
                                          }}
                                          className="h-3.5 w-3.5 rounded border-rs-border accent-rs-accent"
                                        />
                                        <span className="text-xs text-rs-text">{opt.label}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            {field.type === 'path' && (
                              <div>
                                <label className="mb-1 block text-xs text-rs-text-secondary">
                                  {field.label}
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    readOnly
                                    value={
                                      (config[field.key] as string) ??
                                      (field.default as string) ??
                                      ''
                                    }
                                    placeholder="No folder selected"
                                    className="flex-1 rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 text-sm text-rs-text outline-none transition-colors focus:border-rs-accent"
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const selected = await window.api.addons.selectFolder()
                                      if (selected) {
                                        handleConfigChange(addon.manifest.id, field.key, selected)
                                      }
                                    }}
                                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-rs-border px-3 py-2 text-xs font-medium text-rs-text-secondary transition-colors hover:border-rs-accent hover:text-rs-accent"
                                  >
                                    <FolderOpen size={14} />
                                    Browse
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    {addon.manifest.capabilities.some((c) => c.startsWith('sources:')) && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={isBuilding}
                          onClick={() => handleBuildIndex(addon.manifest.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-rs-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rs-accent-hover disabled:opacity-60"
                        >
                          <RefreshCw size={12} className={isBuilding ? 'animate-spin' : ''} />
                          {isBuilding ? 'Building...' : 'Build Index'}
                        </button>

                        <button
                          type="button"
                          disabled={isClearing || !addon.status?.indexedItems}
                          onClick={() => handleClearData(addon.manifest.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-rs-border px-4 py-2 text-xs font-medium text-rs-text-secondary transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-40"
                        >
                          <Trash size={12} />
                          {isClearing ? 'Clearing...' : 'Clear Index'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          /* ── Empty state ─────────────────────────────── */
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Puzzle size={48} strokeWidth={1} className="text-rs-text-secondary/30" />
            <p className="text-sm font-medium text-rs-text-secondary">No add-ons installed</p>
            <p className="max-w-xs text-center text-xs text-rs-text-secondary/60">
              Add-ons extend the app with additional features and integrations. Install a
              third-party add-on to get started.
            </p>
            <button
              type="button"
              onClick={handleInstall}
              className="mt-4 flex items-center gap-2 rounded-lg bg-rs-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rs-accent-hover"
            >
              <Plus size={16} />
              Install Add-on
            </button>
          </div>
        )}
      </div>

      {/* ── Display Preferences ──────────────────── */}
      <div className="mt-8 max-w-2xl">
        <div className="rounded-xl border border-rs-border bg-rs-panel p-5">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 size={16} className="text-rs-accent" />
            <h2 className="text-sm font-semibold text-rs-text">Display Preferences</h2>
          </div>
          <div>
            <label className="mb-1 block text-xs text-rs-text-secondary">
              Sources Display Mode
            </label>
            <div className="relative w-56">
              <select
                value={sourcesDisplayMode}
                onChange={(e) => setSourcesDisplayMode(e.target.value as 'expandable' | 'compact')}
                className="w-full appearance-none rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 pr-9 text-sm text-rs-text outline-none transition-colors focus:border-rs-accent"
              >
                <option value="compact">Compact</option>
                <option value="expandable">Expandable</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rs-text-secondary"
              />
            </div>
            <p className="mt-1 text-[10px] text-rs-text-secondary">
              How ROM sources appear in the game detail panel
            </p>
          </div>
        </div>
      </div>

      {/* ── Install confirmation dialog ── */}
      {installPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-rs-border bg-rs-panel p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-rs-text">Install Add-on</h2>

            <div className="mt-4 rounded-lg border border-rs-border bg-rs-panel-light p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-rs-text">
                  {installPreview.manifest.name}
                </h3>
                <span className="rounded-full bg-rs-panel px-2 py-0.5 text-[10px] font-medium text-rs-text-secondary">
                  v{installPreview.manifest.version}
                </span>
              </div>
              <p className="mt-1 text-xs text-rs-text-secondary">
                by {installPreview.manifest.author}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-rs-text-secondary">
                {installPreview.manifest.description}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                {installPreview.manifest.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="flex items-center gap-1 rounded-full bg-rs-panel px-2 py-0.5 text-[10px] font-medium text-rs-text-secondary"
                  >
                    {capabilityIcon(cap)}
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
              <p className="text-xs leading-relaxed text-amber-300/80">
                Third-party add-ons are installed at your own risk. The developers of this app are
                not responsible for content provided by third-party add-ons.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setInstallPreview(null)}
                className="rounded-lg border border-rs-border px-4 py-2 text-sm font-medium text-rs-text-secondary transition-colors hover:bg-rs-panel-light"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={installing}
                onClick={handleInstallConfirm}
                className="flex items-center gap-2 rounded-lg bg-rs-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rs-accent-hover disabled:opacity-60"
              >
                {installing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Installing...
                  </>
                ) : (
                  'Install'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
