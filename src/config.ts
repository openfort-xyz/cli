import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

function getConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, 'openfort')
  }
  if (process.platform === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'openfort')
  }
  return join(homedir(), '.config', 'openfort')
}

export const CONFIG_DIR = getConfigDir()
export const CREDENTIALS_PATH = join(CONFIG_DIR, 'credentials')

export function ensureConfigDir(): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
}
