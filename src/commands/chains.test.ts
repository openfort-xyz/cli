import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../constants.js'
import cli from '../cli.js'

const base = { chainId: 8453, name: 'Base', chainType: 'EVM', testnet: false, eip7702: true }
const baseSepolia = { ...base, chainId: 84532, name: 'Base Sepolia', testnet: true }
const solanaDevnet = { chainId: 2, name: 'Solana Devnet', chainType: 'SVM', testnet: true, eip7702: false }
const apiBody = { object: 'list', url: '/v1/chains', start: 0, end: 3, total: 3, data: [base, baseSepolia, solanaDevnet] }

async function run(argv: string[]) {
  let out = ''
  let code = 0
  await cli.serve(['chains', 'list', ...argv, '--json'], {
    stdout: (s) => {
      out += s
    },
    exit: (c) => {
      code = c
    },
    env: {},
  })
  return { code, body: JSON.parse(out) }
}

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('chains list', () => {
  it('calls the public endpoint without an API key or auth header', async () => {
    const fetchMock = mockFetch(async () => Response.json(apiBody))

    const { code, body } = await run([])

    expect(code).toBe(0)
    expect(body).toEqual({ data: [base, baseSepolia, solanaDevnet], total: 3 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE_URL}/v1/chains`)
    expect(new Headers(init?.headers).has('authorization')).toBe(false)
  })

  it('filters by chain type', async () => {
    mockFetch(async () => Response.json(apiBody))

    const { body } = await run(['--chainType', 'SVM'])

    expect(body).toEqual({ data: [solanaDevnet], total: 1 })
  })

  it('filters by network', async () => {
    mockFetch(async () => Response.json(apiBody))

    expect((await run(['--network', 'mainnet'])).body.data).toEqual([base])
    expect((await run(['--network', 'testnet', '--chainType', 'EVM'])).body.data).toEqual([baseSepolia])
  })

  it('explains a 404 as the endpoint not being deployed yet', async () => {
    mockFetch(async () => new Response('Not Found', { status: 404 }))

    const { code, body } = await run([])

    expect(code).not.toBe(0)
    expect(body.code).toBe('CHAINS_NOT_AVAILABLE')
    expect(body.message).toBe('Chain list not available from this API yet.')
  })

  it('reports other HTTP failures with the status', async () => {
    mockFetch(async () => new Response('boom', { status: 503 }))

    const { body } = await run([])

    expect(body.code).toBe('CHAINS_FETCH_FAILED')
    expect(body.message).toContain('503')
    expect(body.retryable).toBe(true)
  })

  it('times out after 10 seconds', async () => {
    // AbortSignal.timeout runs on Node's internal timers, which fake timers do not drive,
    // so hand back a signal that has already fired the way it would after 10s.
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(AbortSignal.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')))
    mockFetch(async (_url, init) => {
      throw init?.signal?.reason
    })

    const { code, body } = await run([])

    expect(timeoutSpy).toHaveBeenCalledWith(10_000)
    expect(code).not.toBe(0)
    expect(body.code).toBe('CHAINS_TIMEOUT')
    expect(body.retryable).toBe(true)
  })
})
