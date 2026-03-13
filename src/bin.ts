import { existsSync, readFileSync } from 'node:fs'
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

// Load global credentials (user-specific keys like OPENFORT_API_KEY)
loadEnvIntoProcess(CREDENTIALS_PATH)

const { default: cli } = await import('./cli.js')

cli.serve()
