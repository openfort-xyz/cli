import { readFileSync, writeFileSync, existsSync } from 'node:fs'

export function loadEnvFile(envPath: string): Map<string, string> {
  const entries = new Map<string, string>()
  if (!existsSync(envPath)) return entries

  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    entries.set(key, value)
  }
  return entries
}

export function writeEnvKey(envPath: string, key: string, value: string) {
  const entries = loadEnvFile(envPath)
  entries.set(key, value)

  const lines: string[] = []
  for (const [k, v] of entries) {
    lines.push(`${k}=${v}`)
  }
  writeFileSync(envPath, `${lines.join('\n')}\n`)
}
