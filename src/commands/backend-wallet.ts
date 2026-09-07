import { randomBytes, subtle, type webcrypto } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { Cli, z, Errors } from 'incur'
import { API_BASE_URL } from '../constants.js'
import { CREDENTIALS_PATH, ensureConfigDir } from '../config.js'
import { requireApiKey, writeEnvKey } from '../env.js'

// --- Crypto helpers ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64')
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64url')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function stringToArrayBuffer(str: string): ArrayBuffer {
  return toArrayBuffer(new TextEncoder().encode(str))
}

function formatPEMBody(base64: string): string {
  return base64.match(/.{1,64}/g)?.join('\n') || base64
}

function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sortObjectKeys)
  const record = obj as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortObjectKeys(record[key])
  }
  return sorted
}

async function importPrivateKey(base64: string): Promise<webcrypto.CryptoKey> {
  const binaryDer = toArrayBuffer(Buffer.from(base64, 'base64'))
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
  privateKey: webcrypto.CryptoKey,
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

// --- API helpers ---

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>

const ROTATE_SCOPE_HINT =
  'Your API key does not have the "api_key:rotate" scope. Run "openfort login" again and make sure the API rotate scope is enabled.'

function toPEM(publicKey: string): string {
  return `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`
}

async function postWithWalletAuth(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
  privateKey: webcrypto.CryptoKey
): Promise<Response> {
  const jwt = await signWalletAuthJwt(privateKey, 'POST', path, body)
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, walletAuthToken: jwt }),
  })
}

// incur only prints code + message on a TTY, so the scope note has to live in the message.
export function rotateError(status: number, text: string): Errors.IncurError {
  const missingScope = status === 403
  const message = `Failed to rotate wallet secret: ${text}`
  return new Errors.IncurError({
    code: 'ROTATE_SECRET_FAILED',
    message: missingScope ? `${message}\n\n${ROTATE_SCOPE_HINT}` : message,
    retryable: !missingScope,
  })
}

async function rotateSecret(apiKey: string, keys: KeyPair, keyId: string): Promise<void> {
  const res = await postWithWalletAuth(
    apiKey,
    '/v2/accounts/backend/rotate-secrets',
    { newPublicKey: toPEM(keys.publicKey), newKeyId: keyId },
    keys.privateKeyCrypto
  )
  if (!res.ok) throw rotateError(res.status, await res.text())
}

async function storeKeyReference(apiKey: string, publicKey: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/v1/project/apikey`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ type: 'pk_wallet', uuid: publicKey }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Errors.IncurError({
      code: 'STORE_KEY_FAILED',
      message: `Failed to store wallet key reference: ${text}`,
      retryable: true,
    })
  }
}

const ROTATE_WARNING =
  'This project already has a backend wallet secret. Rotating it generates a new key and the current one stops working immediately, breaking any service that still uses it.'

async function confirmRotation(agent: boolean): Promise<boolean> {
  if (agent || !process.stdin.isTTY) {
    throw new Errors.IncurError({
      code: 'WALLET_SECRET_EXISTS',
      message: `${ROTATE_WARNING}\n\nRe-run with --rotate to replace it.`,
    })
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  try {
    const answer = await rl.question(`${ROTATE_WARNING}\nRotate it now? [y/N] `)
    return /^y(es)?$/i.test(answer.trim())
  } finally {
    rl.close()
  }
}

// Store raw base64 (no PEM headers) — the SDK wraps it in PEM internally
function saveKeys(keys: KeyPair, keyId: string): void {
  ensureConfigDir()
  writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_WALLET_PUBLIC_KEY', keys.publicKey.replaceAll('\n', ''))
  writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_WALLET_SECRET', keys.privateKey.replaceAll('\n', ''))
  writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_WALLET_KEY_ID', keyId)
}

// --- Response types ---

interface RevokeSecretResponse {
  keyId: string
  revoked: boolean
  revokedAt: number
}

// --- CLI command ---

export const backendWallet = Cli.create('backend-wallet', {
  description: 'Configure backend wallet signing keys.',
})

backendWallet.command('setup', {
  description: 'Generate and register backend wallet signing keys (ECDSA P-256).',
  output: z.object({
    message: z.string(),
    credentialsPath: z.string(),
  }),
  options: z.object({
    rotate: z.boolean().optional().describe('Rotate the wallet secret without asking if the project already has one'),
  }),
  examples: [
    {
      description: 'Set up backend wallet signing keys and save to credentials',
    },
    {
      options: { rotate: true },
      description: 'Replace an existing wallet secret without a confirmation prompt',
    },
  ],
  hint: 'Requires OPENFORT_API_KEY. Run "openfort login" first. If the project already has a wallet secret, you are asked before it is rotated (requires the "api_key:rotate" scope).',
  async run(c) {
    const apiKey = requireApiKey()

    const keys = await generateKeyPair()
    const keyId = `ws_${Date.now()}`

    const registerRes = await postWithWalletAuth(
      apiKey,
      '/v2/accounts/backend/register-secret',
      { publicKey: toPEM(keys.publicKey), keyId },
      keys.privateKeyCrypto
    )

    let message = `Backend wallet keys were created and saved to ${CREDENTIALS_PATH}`
    if (!registerRes.ok) {
      const text = await registerRes.text()
      if (!text.includes('Wallet already exists')) {
        throw new Errors.IncurError({
          code: 'REGISTER_SECRET_FAILED',
          message: `Failed to register wallet secret: ${text}`,
          retryable: true,
        })
      }
      // The existing secret is one-time shown and cannot be fetched, so the only way forward is to replace it.
      const approved = c.options.rotate || (await confirmRotation(c.agent))
      if (!approved) {
        throw new Errors.IncurError({
          code: 'ROTATION_CANCELLED',
          message: 'Wallet secret rotation cancelled. The existing secret is unchanged.',
        })
      }
      await rotateSecret(apiKey, keys, keyId)
      message = `Project already had a wallet secret; it was rotated and the new keys were saved to ${CREDENTIALS_PATH}`
    }

    await storeKeyReference(apiKey, keys.publicKey)
    saveKeys(keys, keyId)

    return c.ok(
      { message, credentialsPath: CREDENTIALS_PATH },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: 'accounts evm create', description: 'Create an EVM backend wallet' },
            { command: 'accounts solana create', description: 'Create a Solana backend wallet' },
            { command: 'accounts list', description: 'List your backend wallets' },
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
    const apiKey = requireApiKey()
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

    const data: RevokeSecretResponse = await res.json()
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
    const apiKey = requireApiKey()

    const keys = await generateKeyPair()
    const keyId = `ws_${Date.now()}`

    await rotateSecret(apiKey, keys, keyId)
    await storeKeyReference(apiKey, keys.publicKey)
    saveKeys(keys, keyId)

    return c.ok({ message: `Wallet secret rotated and new keys saved to ${CREDENTIALS_PATH}`, credentialsPath: CREDENTIALS_PATH })
  },
})
