import { randomBytes, subtle } from 'node:crypto'
import { join } from 'node:path'
import { Cli, z, Errors } from 'incur'
import { varsSchema } from '../vars.js'
import { API_BASE_URL } from '../constants.js'
import { writeEnvKey } from '../env.js'

// --- Crypto helpers ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64')
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64url')
}

function stringToArrayBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer as ArrayBuffer
}

function formatPEMBody(base64: string): string {
  return base64.match(/.{1,64}/g)?.join('\n') || base64
}

function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sortObjectKeys)
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
  }
  return sorted
}

async function generateKeyPair() {
  const keyPair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )

  const spki = await subtle.exportKey('spki', keyPair.publicKey)
  const pkcs8 = await subtle.exportKey('pkcs8', keyPair.privateKey)

  return {
    publicKey: formatPEMBody(arrayBufferToBase64(spki)),
    privateKey: formatPEMBody(arrayBufferToBase64(pkcs8)),
    privateKeyCrypto: keyPair.privateKey,
  }
}

async function signWalletAuthJwt(
  privateKey: CryptoKey,
  method: string,
  path: string,
  body: Record<string, unknown>
): Promise<string> {
  const sortedJson = JSON.stringify(sortObjectKeys(body))
  const hashBuffer = await subtle.digest('SHA-256', stringToArrayBuffer(sortedJson))
  const reqHash = Buffer.from(hashBuffer).toString('hex')

  const now = Math.floor(Date.now() / 1000)
  const jti = randomBytes(16).toString('hex')

  const header = { alg: 'ES256', typ: 'JWT' }
  const payload = {
    uris: [`${method.toUpperCase()} ${path}`],
    reqHash,
    iat: now,
    nbf: now,
    jti,
  }

  const headerB64 = arrayBufferToBase64Url(stringToArrayBuffer(JSON.stringify(header)))
  const payloadB64 = arrayBufferToBase64Url(stringToArrayBuffer(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

  const signature = await subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    stringToArrayBuffer(signingInput)
  )

  return `${signingInput}.${arrayBufferToBase64Url(signature)}`
}

// --- CLI command ---

export const walletKeys = Cli.create('wallet-keys', {
  description: 'Manage backend wallet keys.',
  vars: varsSchema,
})

walletKeys.command('create', {
  description: 'Create backend wallet keys (ECDSA P-256).',
  output: z.object({
    message: z.string(),
    envPath: z.string(),
  }),
  examples: [
    {
      description: 'Create backend wallet keys and save to .env',
    },
  ],
  async run(c) {
    const apiKey = process.env.OPENFORT_API_KEY!

    // Step 1: Generate ECDSA P-256 key pair
    const { publicKey, privateKey, privateKeyCrypto } = await generateKeyPair()
    const publicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`

    // Step 2: Register the public key with the backend
    const path = '/v2/accounts/backend/register-secret'
    const bodyWithoutToken = { publicKey: publicKeyPEM }

    const jwt = await signWalletAuthJwt(privateKeyCrypto as unknown as CryptoKey, 'POST', path, bodyWithoutToken)

    const registerRes = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...bodyWithoutToken,
        walletAuthToken: jwt,
      }),
    })

    if (!registerRes.ok) {
      const text = await registerRes.text()
      throw new Errors.IncurError({
        code: 'REGISTER_SECRET_FAILED',
        message: `Failed to register wallet secret: ${text}`,
      })
    }

    // Step 3: Store the key reference in project API keys
    const storeRes = await fetch(`${API_BASE_URL}/v1/project/apikey`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ type: 'pk_wallet', uuid: publicKey }),
    })

    if (!storeRes.ok) {
      const text = await storeRes.text()
      throw new Errors.IncurError({
        code: 'STORE_KEY_FAILED',
        message: `Failed to store wallet key reference: ${text}`,
      })
    }

    // Step 4: Save keys to .env file
    // Store raw base64 (no PEM headers) — the SDK wraps it in PEM internally
    const envPath = join(process.cwd(), '.env')
    writeEnvKey(envPath, 'OPENFORT_WALLET_PUBLIC_KEY', publicKey)
    writeEnvKey(envPath, 'OPENFORT_WALLET_SECRET', privateKey)

    return c.ok({ message: 'Backend wallet keys were created and saved in .env file.', envPath })
  },
})
