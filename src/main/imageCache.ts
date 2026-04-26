import { app } from 'electron'
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import axios from 'axios'
import log from 'electron-log/main'

const cacheLog = log.scope('image-cache')

const IGDB_IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload'
const CACHE_DIR_NAME = 'image-cache'

function getCacheDir(): string {
  return join(app.getPath('userData'), CACHE_DIR_NAME)
}

function getCacheFileName(imageId: string, size: string): string {
  return `${size}_${imageId}.jpg`
}

export function buildImageUrl(imageId: string, size: string): string {
  return `${IGDB_IMAGE_BASE_URL}/${size}/${imageId}.jpg`
}

export function getCachedImagePath(imageId: string, size: string): string | null {
  const filePath = join(getCacheDir(), getCacheFileName(imageId, size))
  return existsSync(filePath) ? filePath : null
}

export async function cacheImage(imageId: string, size: string): Promise<string> {
  const cached = getCachedImagePath(imageId, size)
  if (cached) {
    cacheLog.info('cache hit:', imageId, size, '→', cached)
    return cached
  }

  const cacheDir = getCacheDir()
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true })
  }

  const url = buildImageUrl(imageId, size)
  const filePath = join(cacheDir, getCacheFileName(imageId, size))
  cacheLog.info('downloading:', url)

  try {
    const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' })
    writeFileSync(filePath, Buffer.from(response.data))
    cacheLog.info('saved:', filePath, `(${response.data.byteLength} bytes)`)
    return filePath
  } catch (error) {
    cacheLog.error('download failed:', imageId, size, error)
    return url
  }
}

export async function clearImageCache(): Promise<void> {
  const cacheDir = getCacheDir()
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true })
  }
  mkdirSync(cacheDir, { recursive: true })
}

export async function getImageCacheSize(): Promise<{ files: number; bytes: number }> {
  const cacheDir = getCacheDir()
  if (!existsSync(cacheDir)) {
    return { files: 0, bytes: 0 }
  }

  const entries = readdirSync(cacheDir)
  let bytes = 0
  let files = 0

  for (const entry of entries) {
    const entryPath = join(cacheDir, entry)
    const stat = statSync(entryPath)
    if (stat.isFile()) {
      files++
      bytes += stat.size
    }
  }

  return { files, bytes }
}
