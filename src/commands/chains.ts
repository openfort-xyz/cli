import { Cli, Errors, z } from 'incur'
import { API_BASE_URL } from '../constants.js'

const TIMEOUT_MS = 10_000

const chain = z.object({
  chainId: z.number(),
  name: z.string(),
  chainType: z.enum(['EVM', 'SVM']),
  testnet: z.boolean(),
  bundler: z.enum(['alto', 'pimlico']).nullable(),
  eip7702: z.boolean(),
})

type Chain = z.infer<typeof chain>

const chainList = z.object({
  data: z.array(chain),
  total: z.number(),
})

// Public endpoint: no API key, and not in the published openfort-node SDK yet, so plain fetch.
async function fetchChains(): Promise<Chain[]> {
  const url = `${API_BASE_URL}/v1/chains`
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Errors.IncurError({
        code: 'CHAINS_TIMEOUT',
        message: `GET ${url} timed out after ${TIMEOUT_MS / 1000}s.`,
        retryable: true,
      })
    }
    throw error
  }
  if (res.status === 404) {
    throw new Errors.IncurError({
      code: 'CHAINS_NOT_AVAILABLE',
      message: 'Chain list not available from this API yet.',
      hint: `GET ${url} returned 404. See https://www.openfort.io/docs/configuration/chains`,
    })
  }
  if (!res.ok) {
    throw new Errors.IncurError({
      code: 'CHAINS_FETCH_FAILED',
      message: `GET ${url} failed with ${res.status}: ${await res.text()}`,
      retryable: res.status >= 500,
    })
  }
  const body = (await res.json()) as { data: Chain[] }
  return body.data
}

export const chains = Cli.create('chains', {
  description: 'Look up the chains Openfort supports.',
})

chains.command('list', {
  description:
    'List the chains Openfort supports, with chain ID, name, chain type (EVM or SVM), testnet flag, ' +
    'ERC-4337 bundler (alto or pimlico; null for Solana) and EIP-7702 support. Use this to answer ' +
    '"is chain X supported?", "which chains can I use?", "does chain X support 7702?" and ' +
    '"which bundler serves chain X?". No API key needed.',
  options: z.object({
    chainType: z.enum(['EVM', 'SVM']).optional().describe('Only EVM or only Solana (SVM) chains'),
    network: z.enum(['mainnet', 'testnet']).optional().describe('Only mainnets or only testnets'),
  }),
  examples: [
    { description: 'List every supported chain' },
    { options: { chainType: 'EVM', network: 'mainnet' }, description: 'EVM mainnets only' },
  ],
  output: chainList,
  mcp: { annotations: { readOnlyHint: true, openWorldHint: true } },
  async run(c) {
    const { chainType, network } = c.options
    const data = (await fetchChains()).filter(
      (item) =>
        (chainType === undefined || item.chainType === chainType) &&
        (network === undefined || item.testnet === (network === 'testnet')),
    )
    return c.ok({ data, total: data.length })
  },
})
