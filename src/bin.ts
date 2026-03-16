import { CREDENTIALS_PATH } from './config.js'
import { loadEnvFile } from './env.js'

// Load global credentials into process.env (user-specific keys like OPENFORT_API_KEY)
for (const [key, value] of loadEnvFile(CREDENTIALS_PATH)) {
  if (!process.env[key]) {
    process.env[key] = value
  }
}

const { default: cli } = await import('./cli.js')

cli.serve()
