// ---------- Local folder transfer ----------
// Implements the transfer contract for local file copies.

import {
  existsSync,
  statSync,
  copyFileSync,
  unlinkSync,
  createReadStream,
  createWriteStream
} from 'fs'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import type { TransferCallbacks, TransferHandle } from '../types'

/** Size threshold above which we use streaming copy with progress (50 MB). */
const STREAM_THRESHOLD = 50 * 1024 * 1024

/**
 * Create a transfer that copies a local file to the staging path.
 * sourceRef is the absolute path to the source file.
 */
export function createLocalTransfer(
  sourceRef: string,
  stagingPath: string,
  callbacks: TransferCallbacks
): TransferHandle {
  let cancelled = false

  // Ensure staging directory exists
  const stagingDir = dirname(stagingPath)
  if (!existsSync(stagingDir)) {
    mkdirSync(stagingDir, { recursive: true })
  }

  // Delete stale staging file if present (fresh start)
  if (existsSync(stagingPath)) {
    try {
      unlinkSync(stagingPath)
    } catch {
      /* ignore */
    }
  }

  // Kick off the copy asynchronously
  doCopy(sourceRef, stagingPath, callbacks, () => cancelled)

  return {
    supportsPause: false,
    pause() {
      /* no-op — file copy cannot pause */
    },
    resume() {
      /* no-op */
    },
    cancel() {
      cancelled = true
      // Clean up partial staging file
      if (existsSync(stagingPath)) {
        try {
          unlinkSync(stagingPath)
        } catch {
          /* ignore */
        }
      }
    }
  }
}

async function doCopy(
  srcPath: string,
  destPath: string,
  callbacks: TransferCallbacks,
  isCancelled: () => boolean
): Promise<void> {
  try {
    if (!existsSync(srcPath)) {
      throw new Error(`Source file not found: ${srcPath}`)
    }

    const srcStat = statSync(srcPath)
    const totalSize = srcStat.size

    if (isCancelled()) return

    if (totalSize < STREAM_THRESHOLD) {
      // Small file — synchronous copy
      copyFileSync(srcPath, destPath)
      if (isCancelled()) return
      callbacks.onProgress({ importedSize: totalSize, totalSize, speed: 0 })
      callbacks.onComplete()
    } else {
      // Large file — streaming copy with progress
      await streamCopy(srcPath, destPath, totalSize, callbacks, isCancelled)
    }
  } catch (err) {
    if (!isCancelled()) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }
}

function streamCopy(
  srcPath: string,
  destPath: string,
  totalSize: number,
  callbacks: TransferCallbacks,
  isCancelled: () => boolean
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const readStream = createReadStream(srcPath)
    const writeStream = createWriteStream(destPath)
    let copied = 0
    const startTime = Date.now()

    const progressInterval = setInterval(() => {
      if (isCancelled()) {
        clearInterval(progressInterval)
        readStream.destroy()
        writeStream.destroy()
        resolve()
        return
      }
      const elapsed = (Date.now() - startTime) / 1000
      const speed = elapsed > 0 ? copied / elapsed : 0
      callbacks.onProgress({ importedSize: copied, totalSize, speed })
    }, 500)

    readStream.on('data', (chunk: string | Buffer) => {
      copied += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
    })

    writeStream.on('finish', () => {
      clearInterval(progressInterval)
      if (isCancelled()) {
        resolve()
        return
      }
      callbacks.onProgress({ importedSize: totalSize, totalSize, speed: 0 })
      callbacks.onComplete()
      resolve()
    })

    readStream.on('error', (err) => {
      clearInterval(progressInterval)
      if (!isCancelled()) {
        callbacks.onError(err)
      }
      reject(err)
    })

    writeStream.on('error', (err) => {
      clearInterval(progressInterval)
      if (!isCancelled()) {
        callbacks.onError(err)
      }
      reject(err)
    })

    readStream.pipe(writeStream)
  })
}
