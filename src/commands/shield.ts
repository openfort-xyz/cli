import { Cli, z, Errors } from 'incur'
import { varsSchema } from '../vars.js'
import { API_BASE_URL, OPENFORT_SHIELD_URL } from '../constants.js'
import { CREDENTIALS_PATH, ensureConfigDir } from '../config.js'
import { writeEnvKey } from '../env.js'

const SHIELD_API_URL = OPENFORT_SHIELD_URL

export const shield = Cli.create('shield', {
  description: 'Manage Shield (embedded wallet) API keys.',
  vars: varsSchema,
})

shield.command('create', {
  description: 'Create Shield API keys for embedded wallets.',
  options: z.object({
    project: z.string().optional().describe('Project ID (pro_...). Defaults to OPENFORT_PROJECT_ID env var.'),
  }),
  alias: { project: 'p' },
  output: z.object({
    message: z.string(),
    credentialsPath: z.string(),
  }),
  examples: [
    {
      options: { project: 'pro_abc123' },
      description: 'Create Shield keys for a project',
    },
  ],
  async run(c) {
    const publishableKey = process.env.OPENFORT_PUBLISHABLE_KEY
    if (!publishableKey) {
      throw new Errors.IncurError({
        code: 'MISSING_PUBLISHABLE_KEY',
        message: 'OPENFORT_PUBLISHABLE_KEY environment variable is required to create Shield keys.',
        hint: 'Run: openfort login',
      })
    }

    const apiKey = process.env.OPENFORT_API_KEY!
    const environment = apiKey.startsWith('sk_live_') ? 'live' : 'test'
    const projectId = c.options.project || process.env.OPENFORT_PROJECT_ID
    if (!projectId) {
      throw new Errors.IncurError({
        code: 'MISSING_PROJECT_ID',
        message: 'Project ID is required. Pass --project or set OPENFORT_PROJECT_ID.',
        hint: 'Run: openfort login',
      })
    }

    // Step 1: Register with Shield service
    const registerRes = await fetch(`${SHIELD_API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': publishableKey,
      },
      body: JSON.stringify({
        name: `${projectId}-${environment}`,
        generate_encryption_key: true,
        enable_2fa: false,
      }),
    })

    if (!registerRes.ok) {
      const text = await registerRes.text()
      throw new Errors.IncurError({
        code: 'SHIELD_REGISTER_FAILED',
        message: `Shield registration failed: ${text}`,
      })
    }

    const shieldData = (await registerRes.json()) as {
      error?: string
      api_key: string
      api_secret: string
      encryption_part: string
    }

    if (shieldData.error) {
      throw new Errors.IncurError({
        code: 'SHIELD_REGISTER_ERROR',
        message: `Shield registration error: ${shieldData.error}`,
      })
    }

    // Step 2: Persist Shield keys to Openfort backend
    const persistKey = async (type: string, uuid: string) => {
      const res = await fetch(`${API_BASE_URL}/v1/project/apikey`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ type, uuid }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Errors.IncurError({
          code: 'PERSIST_KEY_FAILED',
          message: `Failed to persist ${type} key: ${text}`,
        })
      }
    }

    await Promise.all([
      persistKey('pk_shield', shieldData.api_key),
      persistKey('sk_shield', shieldData.api_secret),
    ])

    // Step 3: Link Openfort provider to Shield project
    const linkRes = await fetch(`${SHIELD_API_URL}/project/providers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': shieldData.api_key,
        'x-api-secret': shieldData.api_secret,
      },
      body: JSON.stringify({
        providers: {
          openfort: {
            publishable_key: `pk_${environment}_${publishableKey}`,
          },
        },
      }),
    })

    if (!linkRes.ok) {
      const text = await linkRes.text()
      throw new Errors.IncurError({
        code: 'SHIELD_LINK_FAILED',
        message: `Failed to link Openfort provider to Shield: ${text}`,
      })
    }

    // Step 4: Save keys to global credentials file
    ensureConfigDir()
    writeEnvKey(CREDENTIALS_PATH, 'SHIELD_PUBLISHABLE_KEY', shieldData.api_key)
    writeEnvKey(CREDENTIALS_PATH, 'SHIELD_SECRET_KEY', shieldData.api_secret)
    writeEnvKey(CREDENTIALS_PATH, 'SHIELD_ENCRYPTION_SHARE', shieldData.encryption_part)

    return c.ok({ message: `Shield keys were created and saved to ${CREDENTIALS_PATH}`, credentialsPath: CREDENTIALS_PATH })
  },
})
