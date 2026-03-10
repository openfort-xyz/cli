import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Load .env before any other imports so constants pick up the values
const envPath = join(process.cwd(), '.env')
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const { default: cli } = await import('./cli.js')

cli.serve()
