// ---------- Import manager types ----------

export type ImportStatus = 'queued' | 'importing' | 'paused' | 'completed' | 'error'

export interface ImportRecord {
  id: string
  addonId: string
  /** Opaque source reference — interpreted only by the addon. */
  sourceRef: string | null
  romFilename: string
  gameName: string | null
  platformId: number
  collection: string
  status: ImportStatus
  progress: number // 0.0–1.0
  totalSize: number
  importedSize: number
  savePath: string | null
  error: string | null
  createdAt: string
  completedAt: string | null
}

export interface StartImportParams {
  addonId: string
  /** Opaque source reference — passed back to addon's createTransfer(). */
  sourceRef: string
  romFilename: string
  gameName: string
  platformId: number
  collection: string
  /** Optional: override the default platform-based subdirectory (e.g. "BIOS/PS1"). */
  saveSubdir?: string
}

export interface ImportProgressEvent {
  id: string
  status: ImportStatus
  progress: number
  importedSize: number
  totalSize: number
  speed: number
  eta: number // seconds, -1 if unknown
}
