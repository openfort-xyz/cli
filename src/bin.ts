import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CREDENTIALS_PATH } from './config.js'

function loadEnvIntoProcess(filePath: string) {
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, 'utf-8')
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

// Load local .env first (highest priority after shell env vars)
loadEnvIntoProcess(join(process.cwd(), '.env'))

// Then load global credentials (fills in anything not already set)
loadEnvIntoProcess(CREDENTIALS_PATH)

const { default: cli } = await import('./cli.js')

cli.serve()
