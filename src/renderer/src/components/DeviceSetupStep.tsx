import { useEffect, useState } from 'react'
import { Gamepad2, Plus, X, Check, ArrowLeft } from 'lucide-react'

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

interface CustomDevice {
  id: string
  name: string
  platformIds: number[]
}

export interface DeviceStepData {
  devices: string[]
  customDevices: CustomDevice[]
}

export default function DeviceSetupStep({
  initial,
  onBack,
  onFinish
}: {
  initial?: DeviceStepData
  onBack: () => void
  onFinish: (data: DeviceStepData) => void
}): React.JSX.Element {
  const [profiles, setProfiles] = useState<DeviceProfile[]>([])
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initial?.devices ?? []))
  const [customDevices, setCustomDevices] = useState<CustomDevice[]>(initial?.customDevices ?? [])
  const [showCustomModal, setShowCustomModal] = useState(false)

  useEffect(() => {
    Promise.all([window.api.devices.getProfiles(), window.api.devices.getPlatforms()]).then(
      ([p, pl]) => {
        setProfiles(p)
        setPlatforms(pl)
      }
    )
  }, [])

  const toggleDevice = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const removeCustomDevice = (id: string): void => {
    setCustomDevices((prev) => prev.filter((d) => d.id !== id))
  }

  const canFinish = selectedIds.size > 0 || customDevices.length > 0

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
      {/* Icon + heading */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rs-accent to-indigo-400 shadow-lg shadow-rs-accent/30">
          <Gamepad2 size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-rs-text">My Devices</h2>
        <p className="mt-2 text-sm text-rs-text-secondary">
          Select the retro gaming device(s) you own so we can show you the right games.
        </p>
      </div>

      {/* Device grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
        {profiles.map((device) => {
          const isSelected = selectedIds.has(device.id)
          return (
            <button
              key={device.id}
              type="button"
              onClick={() => toggleDevice(device.id)}
              className={`relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all duration-150 ${
                isSelected
                  ? 'border-rs-accent bg-rs-accent/10 ring-1 ring-rs-accent/40'
                  : 'border-rs-border bg-rs-panel hover:border-rs-text-secondary/30 hover:bg-rs-panel-light'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-rs-accent">
                  <Check size={12} className="text-white" strokeWidth={3} />
                </div>
              )}
              <span className="text-sm font-semibold text-rs-text">{device.name}</span>
              <span className="text-[11px] text-rs-text-secondary">{device.manufacturer}</span>
            </button>
          )
        })}

        {/* Custom devices */}
        {customDevices.map((device) => (
          <div
            key={device.id}
            className="relative flex flex-col items-start gap-1 rounded-xl border border-rs-accent bg-rs-accent/10 ring-1 ring-rs-accent/40 p-4"
          >
            <button
              type="button"
              onClick={() => removeCustomDevice(device.id)}
              className="absolute top-2.5 right-2.5 rounded-full bg-rs-panel-light p-0.5 text-rs-text-secondary hover:bg-rs-danger/20 hover:text-rs-danger transition-colors"
              aria-label="Remove custom device"
            >
              <X size={14} />
            </button>
            <span className="text-sm font-semibold text-rs-text">{device.name}</span>
            <span className="text-[11px] text-rs-text-secondary">
              {device.platformIds.length} platforms
            </span>
          </div>
        ))}
      </div>

      {/* Add custom device */}
      <button
        type="button"
        onClick={() => setShowCustomModal(true)}
        className="flex items-center gap-2 rounded-lg border border-dashed border-rs-border px-4 py-2.5 text-sm text-rs-text-secondary transition-colors hover:border-rs-accent hover:text-rs-accent"
      >
        <Plus size={16} />
        Create Custom Device
      </button>

      {/* Back / Finish */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-rs-border px-6 py-3 text-sm font-medium text-rs-text-secondary transition-colors hover:bg-rs-panel-light hover:text-rs-text"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <button
          type="button"
          disabled={!canFinish}
          onClick={() => onFinish({ devices: [...selectedIds], customDevices })}
          className="rounded-xl bg-rs-accent px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-rs-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Finish Setup
        </button>
      </div>

      {/* Custom device modal */}
      {showCustomModal && (
        <CustomDeviceModal
          platforms={platforms}
          onSave={(device) => {
            setCustomDevices((prev) => [...prev, device])
            setShowCustomModal(false)
          }}
          onClose={() => setShowCustomModal(false)}
        />
      )}
    </div>
  )
}

// ── Custom Device Modal ──

function CustomDeviceModal({
  platforms,
  onSave,
  onClose
}: {
  platforms: PlatformInfo[]
  onSave: (device: CustomDevice) => void
  onClose: () => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<number>>(new Set())

  const togglePlatform = (id: number): void => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canSave = name.trim().length > 0 && selectedPlatforms.size > 0

  const handleSave = (): void => {
    onSave({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      platformIds: [...selectedPlatforms]
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-rs-border bg-rs-panel shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rs-border px-6 py-4">
          <h2 className="text-lg font-bold text-rs-text">Create Custom Device</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-rs-text-secondary hover:bg-rs-panel-light hover:text-rs-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Name input */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-rs-text-secondary">
              Device Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Custom Handheld"
              className="w-full rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2 text-sm text-rs-text outline-none transition-colors placeholder:text-rs-text-secondary/50 focus:border-rs-accent"
            />
          </div>

          {/* Platform checkboxes */}
          <div>
            <label className="mb-2 block text-xs font-medium text-rs-text-secondary">
              Platforms ({selectedPlatforms.size} selected)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {platforms.map((p) => {
                const isChecked = selectedPlatforms.has(p.igdbId)
                return (
                  <button
                    key={p.igdbId}
                    type="button"
                    onClick={() => togglePlatform(p.igdbId)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                      isChecked
                        ? 'border-rs-accent bg-rs-accent/10 text-rs-text'
                        : 'border-rs-border bg-rs-panel-light text-rs-text-secondary hover:border-rs-text-secondary/30'
                    }`}
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isChecked ? 'border-rs-accent bg-rs-accent' : 'border-rs-text-secondary/40'
                      }`}
                    >
                      {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="truncate">
                      {p.shortName} - {p.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-rs-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-rs-border px-4 py-2 text-sm text-rs-text-secondary hover:bg-rs-panel-light hover:text-rs-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="rounded-lg bg-rs-accent px-4 py-2 text-sm font-semibold text-white hover:bg-rs-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save Device
          </button>
        </div>
      </div>
    </div>
  )
}
