import { access } from 'fs/promises'

/** Async alternative to existsSync. */
export async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  )
}
