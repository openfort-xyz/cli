import Openfort from '@openfort/openfort-node'
import { CREDENTIALS_PATH } from './config.js'
import { loadEnvFile } from './env.js'
import { API_BASE_URL } from './constants.js'

let cached: Openfort | undefined

export function getOpenfort(): Openfort {
  if (cached) return cached

  let apiKey = process.env.OPENFORT_API_KEY
  if (!apiKey) {
    const creds = loadEnvFile(CREDENTIALS_PATH)
    apiKey = creds.get('OPENFORT_API_KEY')
    if (apiKey) {
      process.env.OPENFORT_API_KEY = apiKey
      const pk = creds.get('OPENFORT_PUBLISHABLE_KEY')
      if (pk && !process.env.OPENFORT_PUBLISHABLE_KEY) process.env.OPENFORT_PUBLISHABLE_KEY = pk
      const ws = creds.get('OPENFORT_WALLET_SECRET')
      if (ws && !process.env.OPENFORT_WALLET_SECRET) process.env.OPENFORT_WALLET_SECRET = ws
    }
  }
  if (!apiKey) {
    throw new Error('OPENFORT_API_KEY is required. Run: openfort login')
  }

  cached = new Openfort(apiKey, {
    walletSecret: process.env.OPENFORT_WALLET_SECRET,
    publishableKey: process.env.OPENFORT_PUBLISHABLE_KEY,
    basePath: API_BASE_URL,
  })
  return cached
}
