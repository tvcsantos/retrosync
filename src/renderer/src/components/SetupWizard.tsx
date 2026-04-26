import { useState } from 'react'
import { Check } from 'lucide-react'
import IgdbSetupStep, { type IgdbStepData } from './IgdbSetupStep'
import DeviceSetupStep, { type DeviceStepData } from './DeviceSetupStep'

const STEPS = [
  { label: 'API Setup', key: 'igdb' },
  { label: 'My Devices', key: 'devices' }
] as const

export default function SetupWizard({ onFinished }: { onFinished: () => void }): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [igdbData, setIgdbData] = useState<IgdbStepData | undefined>()
  const [saving, setSaving] = useState(false)

  const handleIgdbNext = (data: IgdbStepData): void => {
    setIgdbData(data)
    setStep(1)
  }

  const handleFinish = async (deviceData: DeviceStepData): Promise<void> => {
    setSaving(true)

    // Build a single config write
    const patch: Record<string, unknown> = {
      devices: deviceData.devices,
      customDevices: deviceData.customDevices
    }

    if (igdbData && !igdbData.skipped) {
      patch.igdb = { clientId: igdbData.clientId, clientSecret: igdbData.clientSecret }
      patch.igdbSetupSkipped = false
    } else {
      patch.igdbSetupSkipped = true
    }

    await window.api.config.set(patch)
    onFinished()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-rs-bg overflow-y-auto py-10">
      {/* Glow backdrop */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-rs-accent/8 blur-[120px] pointer-events-none" />

      {/* Stepper */}
      <div className="relative mb-10 flex items-center gap-0">
        {STEPS.map((s, i) => {
          const isDone = i < step
          const isActive = i === step
          return (
            <div key={s.key} className="flex items-center">
              {i > 0 && (
                <div
                  className={`h-px w-16 sm:w-24 transition-colors ${isDone ? 'bg-rs-accent' : 'bg-rs-border'}`}
                />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                    isDone
                      ? 'border-rs-accent bg-rs-accent text-white'
                      : isActive
                        ? 'border-rs-accent bg-transparent text-rs-accent'
                        : 'border-rs-border bg-transparent text-rs-text-secondary'
                  }`}
                >
                  {isDone ? <Check size={14} strokeWidth={3} /> : i + 1}
                </div>
                <span
                  className={`text-[11px] font-medium transition-colors ${
                    isDone || isActive ? 'text-rs-text' : 'text-rs-text-secondary'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="relative flex w-full flex-1 items-start justify-center px-6">
        {saving ? (
          <div className="flex flex-col items-center gap-4 pt-20">
            <svg className="h-8 w-8 animate-spin text-rs-accent" viewBox="0 0 24 24" fill="none">
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
            <p className="text-sm text-rs-text-secondary">Saving configuration...</p>
          </div>
        ) : step === 0 ? (
          <IgdbSetupStep initial={igdbData} onNext={handleIgdbNext} />
        ) : (
          <DeviceSetupStep onBack={() => setStep(0)} onFinish={handleFinish} />
        )}
      </div>
    </div>
  )
}
