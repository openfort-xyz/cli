import { randomBytes, subtle } from 'node:crypto'
import { Cli, z, Errors } from 'incur'
import { varsSchema } from '../vars.js'
import { API_BASE_URL } from '../constants.js'
import { CREDENTIALS_PATH, ensureConfigDir } from '../config.js'
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

async function importPrivateKey(base64: string): Promise<CryptoKey> {
  const binaryDer = Buffer.from(base64, 'base64')
  return subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
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

export const backendWallet = Cli.create('backend-wallet', {
  description: 'Configure backend wallet signing keys.',
  vars: varsSchema,
})

backendWallet.command('setup', {
  description: 'Generate and register backend wallet signing keys (ECDSA P-256).',
  output: z.object({
    message: z.string(),
    credentialsPath: z.string(),
  }),
  examples: [
    {
      description: 'Set up backend wallet signing keys and save to credentials',
    },
  ],
  hint: 'Requires OPENFORT_API_KEY. Run "openfort login" first.',
  async run(c) {
    const apiKey = process.env.OPENFORT_API_KEY!

    // Step 1: Generate ECDSA P-256 key pair
    const { publicKey, privateKey, privateKeyCrypto } = await generateKeyPair()
    const publicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`

    // Step 2: Register the public key with the backend
    const path = '/v2/accounts/backend/register-secret'
    const keyId = `ws_${Date.now()}`
    const bodyWithoutToken = { publicKey: publicKeyPEM, keyId }

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
        retryable: true,
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
        retryable: true,
      })
    }

    // Step 4: Save keys to global credentials file
    // Store raw base64 (no PEM headers) — the SDK wraps it in PEM internally
    ensureConfigDir()
    writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_WALLET_PUBLIC_KEY', publicKey.replaceAll('\n', ''))
    writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_WALLET_SECRET', privateKey.replaceAll('\n', ''))
    writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_WALLET_KEY_ID', keyId)

    return c.ok(
      { message: `Backend wallet keys were created and saved to ${CREDENTIALS_PATH}`, credentialsPath: CREDENTIALS_PATH },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `embedded-wallet setup`, description: 'Set up embedded wallet keys' },
          ],
        },
      },
    )
  },
})

backendWallet.command('revoke', {
  description: 'Revoke the current backend wallet signing secret.',
  output: z.object({
    keyId: z.string(),
    revoked: z.boolean(),
    revokedAt: z.number(),
  }),
  examples: [
    {
      description: 'Revoke the current wallet secret',
    },
  ],
  hint: 'Requires OPENFORT_WALLET_KEY_ID and OPENFORT_WALLET_SECRET. Run "openfort backend-wallet setup" first.',
  async run(c) {
    const apiKey = process.env.OPENFORT_API_KEY!
    const keyId = process.env.OPENFORT_WALLET_KEY_ID
    const privateKeyBase64 = process.env.OPENFORT_WALLET_SECRET

    if (!keyId || !privateKeyBase64) {
      throw new Errors.IncurError({
        code: 'MISSING_WALLET_KEY',
        message: 'OPENFORT_WALLET_KEY_ID and OPENFORT_WALLET_SECRET must be set. Run `backend-wallet setup` first.',
        hint: 'Run: openfort backend-wallet setup',
      })
    }

    const privateKeyCrypto = await importPrivateKey(privateKeyBase64)

    const path = '/v2/accounts/backend/revoke-secret'
    const body = { keyId }

    const jwt = await signWalletAuthJwt(privateKeyCrypto, 'POST', path, body)

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'x-wallet-auth': jwt,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Errors.IncurError({
        code: 'REVOKE_SECRET_FAILED',
        message: `Failed to revoke wallet secret: ${text}`,
        retryable: true,
      })
    }

    const data = await res.json() as { keyId: string; revoked: boolean; revokedAt: number }
    return c.ok(data)
  },
})

backendWallet.command('rotate', {
  description: 'Rotate backend wallet signing secret (generates new ECDSA P-256 key pair).',
  output: z.object({
    message: z.string(),
    credentialsPath: z.string(),
  }),
  examples: [
    {
      description: 'Rotate wallet secret and save new keys to credentials',
    },
  ],
  hint: 'Requires OPENFORT_API_KEY. Run "openfort login" first.',
  async run(c) {
    const apiKey = process.env.OPENFORT_API_KEY!

    // Step 1: Generate new ECDSA P-256 key pair
    const { publicKey, privateKey, privateKeyCrypto } = await generateKeyPair()
    const newPublicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`

    // Step 2: Call rotate endpoint with JWT proof of the new key
    const path = '/v2/accounts/backend/rotate-secrets'
    const newKeyId = `ws_${Date.now()}`
    const bodyWithoutToken = { newPublicKey: newPublicKeyPEM, newKeyId }

    const jwt = await signWalletAuthJwt(privateKeyCrypto as unknown as CryptoKey, 'POST', path, bodyWithoutToken)

    const rotateRes = await fetch(`${API_BASE_URL}${path}`, {
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

    if (!rotateRes.ok) {
      const text = await rotateRes.text()
      throw new Errors.IncurError({
        code: 'ROTATE_SECRET_FAILED',
        message: `Failed to rotate wallet secret: ${text}`,
        retryable: true,
      })
    }

    // Step 3: Update the key reference in project API keys
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
        message: `Failed to store rotated wallet key reference: ${text}`,
        retryable: true,
      })
    }

    // Step 4: Save new keys to global credentials file
    ensureConfigDir()
    writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_WALLET_PUBLIC_KEY', publicKey.replaceAll('\n', ''))
    writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_WALLET_SECRET', privateKey.replaceAll('\n', ''))
    writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_WALLET_KEY_ID', newKeyId)

    return c.ok({ message: `Wallet secret rotated and new keys saved to ${CREDENTIALS_PATH}`, credentialsPath: CREDENTIALS_PATH })
  },
})
