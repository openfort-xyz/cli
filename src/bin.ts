import { CREDENTIALS_PATH } from './config.js'
import { loadEnvFile } from './env.js'
import { mcpTelemetryEnabled, serveMcp } from './telemetry.js'

// Load global credentials into process.env (user-specific keys like OPENFORT_API_KEY)
for (const [key, value] of loadEnvFile(CREDENTIALS_PATH)) {
  if (!process.env[key]) {
    process.env[key] = value
  }
}

const { default: cli } = await import('./cli.js')

if (mcpTelemetryEnabled()) {
  const posthog = await serveMcp(cli)
  const shutdown = async () => {
    await posthog.shutdown(2000)
    process.exit(0)
  }
  process.stdin.once('end', shutdown)
  process.once('SIGTERM', shutdown)
} else {
  cli.serve()
}
