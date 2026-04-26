// ---------- Platform registry ----------

export interface PlatformInfo {
  igdbId: number
  name: string
  shortName: string
}

/** Every retro platform we support, keyed by IGDB platform ID. */
export const PLATFORMS: readonly PlatformInfo[] = [
  // Nintendo
  { igdbId: 18, name: 'Nintendo Entertainment System', shortName: 'NES' },
  { igdbId: 19, name: 'Super Nintendo', shortName: 'SNES' },
  { igdbId: 58, name: 'Super Famicom', shortName: 'SFC' },
  { igdbId: 33, name: 'Game Boy', shortName: 'GB' },
  { igdbId: 22, name: 'Game Boy Color', shortName: 'GBC' },
  { igdbId: 24, name: 'Game Boy Advance', shortName: 'GBA' },
  { igdbId: 4, name: 'Nintendo 64', shortName: 'N64' },
  { igdbId: 20, name: 'Nintendo DS', shortName: 'NDS' },
  { igdbId: 21, name: 'Nintendo GameCube', shortName: 'GCN' },
  { igdbId: 5, name: 'Wii', shortName: 'Wii' },
  { igdbId: 37, name: 'Nintendo 3DS', shortName: '3DS' },

  // Sony
  { igdbId: 7, name: 'PlayStation', shortName: 'PS1' },
  { igdbId: 8, name: 'PlayStation 2', shortName: 'PS2' },
  { igdbId: 38, name: 'PlayStation Portable', shortName: 'PSP' },

  // Sega
  { igdbId: 64, name: 'Sega Master System', shortName: 'SMS' },
  { igdbId: 29, name: 'Sega Mega Drive / Genesis', shortName: 'MD' },
  { igdbId: 35, name: 'Sega Game Gear', shortName: 'GG' },
  { igdbId: 30, name: 'Sega 32X', shortName: '32X' },
  { igdbId: 78, name: 'Sega CD', shortName: 'SCD' },
  { igdbId: 23, name: 'Dreamcast', shortName: 'DC' },
  { igdbId: 32, name: 'Sega Saturn', shortName: 'SAT' },

  // NEC
  { igdbId: 86, name: 'TurboGrafx-16 / PC Engine', shortName: 'PCE' },

  // SNK
  { igdbId: 80, name: 'Neo Geo AES', shortName: 'AES' },
  { igdbId: 137, name: 'Neo Geo MVS', shortName: 'MVS' },
  { igdbId: 136, name: 'Neo Geo CD', shortName: 'NGCD' },
  { igdbId: 119, name: 'Neo Geo Pocket', shortName: 'NGP' },
  { igdbId: 120, name: 'Neo Geo Pocket Color', shortName: 'NGPC' },

  // Bandai
  { igdbId: 57, name: 'WonderSwan', shortName: 'WS' },

  // Atari
  { igdbId: 59, name: 'Atari 2600', shortName: '2600' },
  { igdbId: 60, name: 'Atari 7800', shortName: '7800' },
  { igdbId: 61, name: 'Atari Lynx', shortName: 'Lynx' },
  { igdbId: 65, name: 'Atari Jaguar', shortName: 'Jag' }
] as const

export const PLATFORM_BY_ID = new Map(PLATFORMS.map((p) => [p.igdbId, p]))

// ---------- Device profiles ----------

export interface DeviceProfile {
  id: string
  name: string
  manufacturer: string
  platformIds: number[]
}

/** Common low-tier platforms: GB, GBC, NES, SMS, GG, Lynx, 2600, 7800, NGP, NGPC, WS */
const TIER1 = [33, 22, 18, 64, 35, 61, 59, 60, 119, 120, 57]

/** Mid-tier: SNES, SFC, Genesis, GBA, 32X, SCD, PCE, AES, MVS, NGCD */
const TIER2 = [19, 58, 29, 24, 30, 78, 86, 80, 137, 136]

/** Demanding: PS1, N64, NDS, PSP */
const TIER3 = [7, 4, 20, 38]

/** Very demanding: Dreamcast, Saturn, GameCube, PS2, Wii, 3DS, Jaguar */
const TIER4 = [23, 32, 21, 8, 5, 37, 65]

const tiers = (...levels: number[][]): number[] => levels.flat()

export const DEVICE_PROFILES: readonly DeviceProfile[] = [
  {
    id: 'miyoo-mini-plus',
    name: 'Miyoo Mini Plus',
    manufacturer: 'Miyoo',
    platformIds: tiers(TIER1, TIER2, [7]) // PS1 only from tier 3
  },
  {
    id: 'anbernic-rg35xx-plus',
    name: 'Anbernic RG35XX Plus',
    manufacturer: 'Anbernic',
    platformIds: tiers(TIER1, TIER2, [7])
  },
  {
    id: 'trimui-smart-pro',
    name: 'Trimui Smart Pro',
    manufacturer: 'Trimui',
    platformIds: tiers(TIER1, TIER2, [7])
  },
  {
    id: 'anbernic-rg28xx',
    name: 'Anbernic RG28XX',
    manufacturer: 'Anbernic',
    platformIds: tiers(TIER1, TIER2)
  },
  {
    id: 'retroid-pocket-2s',
    name: 'Retroid Pocket 2S',
    manufacturer: 'Retroid',
    platformIds: tiers(TIER1, TIER2, TIER3)
  },
  {
    id: 'anbernic-rg405m',
    name: 'Anbernic RG405M',
    manufacturer: 'Anbernic',
    platformIds: tiers(TIER1, TIER2, TIER3, [23, 32])
  },
  {
    id: 'anbernic-rg505',
    name: 'Anbernic RG505',
    manufacturer: 'Anbernic',
    platformIds: tiers(TIER1, TIER2, TIER3, [23, 32])
  },
  {
    id: 'anbernic-rg556',
    name: 'Anbernic RG556',
    manufacturer: 'Anbernic',
    platformIds: tiers(TIER1, TIER2, TIER3, TIER4)
  },
  {
    id: 'retroid-pocket-4-pro',
    name: 'Retroid Pocket 4 Pro',
    manufacturer: 'Retroid',
    platformIds: tiers(TIER1, TIER2, TIER3, TIER4)
  },
  {
    id: 'retroid-pocket-mini',
    name: 'Retroid Pocket Mini',
    manufacturer: 'Retroid',
    platformIds: tiers(TIER1, TIER2, TIER3, TIER4)
  },
  {
    id: 'steam-deck',
    name: 'Steam Deck',
    manufacturer: 'Valve',
    platformIds: tiers(TIER1, TIER2, TIER3, TIER4)
  }
] as const

export const DEVICE_BY_ID = new Map(DEVICE_PROFILES.map((d) => [d.id, d]))

// ---------- Custom device type ----------

export interface CustomDevice {
  id: string
  name: string
  platformIds: number[]
}

// ---------- Active platform IDs ----------

export interface DevicesConfig {
  devices: string[]
  customDevices: CustomDevice[]
}

/**
 * Compute the union of all platform IDs from selected curated + custom devices.
 */
export function getActivePlatformIds(config: DevicesConfig): number[] {
  const ids = new Set<number>()

  for (const deviceId of config.devices) {
    const profile = DEVICE_BY_ID.get(deviceId)
    if (profile) {
      for (const id of profile.platformIds) ids.add(id)
    }
  }

  for (const custom of config.customDevices) {
    for (const id of custom.platformIds) ids.add(id)
  }

  return [...ids].sort((a, b) => a - b)
}
