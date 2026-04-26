import { useState, useRef, useEffect } from 'react'
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { Filter, ChevronDown, Check, RotateCcw } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface GameTypeFilterDropdownProps {
  /** 'dashboard' applies backend re-fetch; 'library' is client-side only */
  mode: 'dashboard' | 'library'
}

const DEFAULT_EXCLUDED = new Set([5])

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

export default function GameTypeFilterDropdown({
  mode
}: GameTypeFilterDropdownProps): React.JSX.Element {
  const excludedGameTypes = useAppStore((s) => s.excludedGameTypes)
  const gameTypeDefinitions = useAppStore((s) => s.gameTypeDefinitions)
  const setExcludedGameTypes = useAppStore((s) => s.setExcludedGameTypes)
  const isDashboardLoading = useAppStore((s) => s.isDashboardLoading)

  const [localExcluded, setLocalExcluded] = useState<Set<number>>(new Set(excludedGameTypes))
  const prevOpenRef = useRef(false)

  // Sync local state when store changes externally (only while closed).
  // Uses queueMicrotask to avoid synchronous setState inside the effect.
  useEffect(() => {
    if (!prevOpenRef.current) {
      queueMicrotask(() => setLocalExcluded(new Set(excludedGameTypes)))
    }
  }, [excludedGameTypes])

  // Commit on close: detect open → false transition
  const handleOpenChange = (open: boolean): void => {
    if (prevOpenRef.current && !open) {
      // Popover just closed - commit if changed
      const storeSet = new Set(excludedGameTypes)
      if (!setsEqual(localExcluded, storeSet)) {
        setExcludedGameTypes(Array.from(localExcluded))
      }
    }
    if (!prevOpenRef.current && open) {
      // Popover just opened - snapshot store into local
      setLocalExcluded(new Set(excludedGameTypes))
    }
    prevOpenRef.current = open
  }

  const toggle = (id: number): void => {
    setLocalExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = (): void => {
    setLocalExcluded(new Set<number>())
  }

  const deselectAll = (): void => {
    setLocalExcluded(new Set(gameTypeDefinitions.map((d) => d.id)))
  }

  const resetDefaults = (): void => {
    setLocalExcluded(new Set(DEFAULT_EXCLUDED))
  }

  if (gameTypeDefinitions.length === 0) return <></>

  const hasCustomFilter = !setsEqual(localExcluded, DEFAULT_EXCLUDED)
  const disableInteraction = isDashboardLoading && mode === 'dashboard'

  return (
    <Popover className="relative">
      {({ open }) => {
        handleOpenChange(open)
        return (
          <>
            <PopoverButton
              className={`flex items-center gap-1.5 rounded-lg border border-rs-border px-3 py-1.5 text-xs font-medium text-rs-text-secondary transition-colors hover:border-rs-text-secondary/40 hover:text-rs-text focus:outline-none ${disableInteraction ? 'opacity-50' : ''}`}
            >
              <Filter size={12} />
              Game Type
              {hasCustomFilter && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-rs-accent" />}
              <ChevronDown
                size={12}
                className={`ml-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </PopoverButton>

            <Transition
              enter="transition ease-out duration-150"
              enterFrom="opacity-0 -translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 -translate-y-1"
            >
              <PopoverPanel
                anchor="bottom start"
                className="z-50 mt-1.5 w-56 rounded-xl border border-rs-border bg-rs-panel shadow-xl [--anchor-gap:6px]"
              >
                {/* Bulk actions */}
                <div className="flex items-center gap-3 border-b border-rs-border px-3 py-2">
                  <button
                    type="button"
                    disabled={disableInteraction}
                    onClick={selectAll}
                    className="text-[11px] font-medium text-rs-accent transition-colors hover:underline disabled:opacity-50"
                  >
                    Select All
                  </button>
                  <span className="text-rs-border">·</span>
                  <button
                    type="button"
                    disabled={disableInteraction}
                    onClick={deselectAll}
                    className="text-[11px] font-medium text-rs-accent transition-colors hover:underline disabled:opacity-50"
                  >
                    Deselect All
                  </button>
                </div>

                {/* Checkbox list */}
                <div className="max-h-64 overflow-y-auto py-1">
                  {gameTypeDefinitions.map((gt) => {
                    const checked = !localExcluded.has(gt.id)
                    return (
                      <button
                        key={gt.id}
                        type="button"
                        disabled={disableInteraction}
                        onClick={() => toggle(gt.id)}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors hover:bg-rs-panel-light disabled:opacity-50"
                      >
                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            checked
                              ? 'border-rs-accent bg-rs-accent'
                              : 'border-rs-text-secondary/40'
                          }`}
                        >
                          {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className={checked ? 'text-rs-text' : 'text-rs-text-secondary'}>
                          {gt.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Reset to defaults */}
                <div className="border-t border-rs-border px-3 py-2">
                  <button
                    type="button"
                    disabled={disableInteraction || !hasCustomFilter}
                    onClick={resetDefaults}
                    className="flex items-center gap-1.5 text-[11px] text-rs-text-secondary transition-colors hover:text-rs-text disabled:opacity-40"
                  >
                    <RotateCcw size={10} />
                    Reset to Defaults
                  </button>
                </div>
              </PopoverPanel>
            </Transition>
          </>
        )
      }}
    </Popover>
  )
}
