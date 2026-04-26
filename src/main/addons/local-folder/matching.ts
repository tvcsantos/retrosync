// ---------- Local folder matching ----------
// Matches indexed files against a game name query.

import type { SourceResult, SourceSearchResult } from '../types'
import type { IndexedFile } from './scanner'

/**
 * Normalize a filename for matching: strip extension, region tags,
 * parenthetical info, brackets, and collapse whitespace.
 */
function normalize(name: string): string {
  return name
    .replace(/\.[^.]+$/, '') // strip extension
    .replace(/\(.*?\)/g, '') // strip (USA), (Rev 1), etc.
    .replace(/\[.*?\]/g, '') // strip [!], [b1], etc.
    .replace(/[^a-zA-Z0-9]/g, ' ') // non-alphanumeric → space
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()
    .toLowerCase()
}

/**
 * Extract region from filename parenthetical tags.
 */
function extractRegion(filename: string): string | null {
  const match = filename.match(
    /\((USA|Europe|Japan|World|En|Fr|De|Es|It|Pt|Ko|Zh|Tw|Asia|Brazil|Australia|Canada|China|France|Germany|Italy|Korea|Netherlands|Russia|Spain|Sweden|UK)[^)]*\)/i
  )
  return match ? match[1] : null
}

function fileToSource(file: IndexedFile): SourceResult {
  return {
    id: file.absolutePath,
    romFilename: file.filename,
    fileSize: file.size,
    region: extractRegion(file.filename),
    collection: 'Local',
    platformId: 0, // unknown — determined by game detail panel context
    sourceRef: file.absolutePath
  }
}

/**
 * Match indexed files against a game name.
 * Returns exact matches first, then fuzzy substring matches.
 */
export function matchFiles(files: IndexedFile[], gameName: string): SourceSearchResult {
  const normalizedQuery = normalize(gameName)
  if (!normalizedQuery) return { sources: [], matchType: 'none' }

  const queryWords = normalizedQuery.split(' ').filter(Boolean)

  const exact: SourceResult[] = []
  const fuzzy: SourceResult[] = []

  for (const file of files) {
    const normalizedFile = normalize(file.filename)

    if (normalizedFile === normalizedQuery) {
      // Exact match (after normalization)
      exact.push(fileToSource(file))
    } else if (
      normalizedFile.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedFile)
    ) {
      // Full substring match
      fuzzy.push(fileToSource(file))
    } else if (queryWords.length >= 2 && queryWords.every((w) => normalizedFile.includes(w))) {
      // All query words appear in filename
      fuzzy.push(fileToSource(file))
    }
  }

  if (exact.length > 0) {
    return { sources: exact, matchType: 'exact' }
  }
  if (fuzzy.length > 0) {
    // Cap fuzzy results to avoid flooding the UI
    return { sources: fuzzy.slice(0, 25), matchType: 'fuzzy' }
  }
  return { sources: [], matchType: 'none' }
}
