import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

import type { CustomDevice } from './platforms'
import type { SourceDisplayMode } from './addons/types'

const CONFIG_FILE_NAME = 'retrosync-config.json'

function getDefaultLibraryPath(): string {
  return join(app.getPath('home'), 'RetroSync')
}

export interface AddonsConfig {
  enabled: string[]
  sourcesDisplayMode: SourceDisplayMode
  config: Record<string, unknown>
}

export interface AppConfig {
  igdb: {
    clientId: string
    clientSecret: string
  }
  igdbSetupSkipped: boolean
  igdbExcludedGameTypes: number[]
  devices: string[]
  customDevices: CustomDevice[]
  addons: AddonsConfig
  libraryPath: string
  importPath: string
  maxConcurrentImports: number
  importsBadgeStyle: 'count' | 'dot' | 'none'
}

function getDefaultConfig(): AppConfig {
  return {
    igdb: {
      clientId: '',
      clientSecret: ''
    },
    igdbSetupSkipped: false,
    igdbExcludedGameTypes: [5],
    devices: [],
    customDevices: [],
    addons: {
      enabled: [],
      sourcesDisplayMode: 'compact',
      config: {}
    },
    libraryPath: getDefaultLibraryPath(),
    importPath: '',
    maxConcurrentImports: 3,
    importsBadgeStyle: 'count'
  }
}

export function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE_NAME)
}

export function getConfig(): AppConfig {
  try {
    const configPath = getConfigPath()
    if (!existsSync(configPath)) {
      return structuredClone(getDefaultConfig())
    }
    const raw = readFileSync(configPath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as AnyRecord

      return deepMerge(
        structuredClone(getDefaultConfig()) as unknown as AnyRecord,
        obj
      ) as unknown as AppConfig
    }
    return structuredClone(getDefaultConfig())
  } catch {
    return structuredClone(getDefaultConfig())
  }
}

export function setConfig(partial: Partial<AppConfig>): AppConfig {
  const current = getConfig()
  const merged = deepMerge(
    current as unknown as AnyRecord,
    partial as unknown as AnyRecord
  ) as unknown as AppConfig
  const configPath = getConfigPath()
  const dir = join(configPath, '..')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}

type AnyRecord = Record<string, unknown>

function deepMerge(target: AnyRecord, source: AnyRecord): AnyRecord {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const sourceVal = source[key]
    const targetVal = (result as Record<string, unknown>)[key]
    if (
      typeof sourceVal === 'object' &&
      sourceVal !== null &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      ;(result as Record<string, unknown>)[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      )
    } else {
      ;(result as Record<string, unknown>)[key] = sourceVal
    }
  }
  return result
}
