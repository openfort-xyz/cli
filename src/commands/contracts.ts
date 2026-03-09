import { Cli, z } from 'incur'
import { varsSchema } from '../vars.js'

const contractItem = z.object({
  id: z.string(),
  createdAt: z.number(),
  name: z.string().nullable(),
  chainId: z.number(),
  address: z.string(),
  deleted: z.boolean(),
  abi: z.array(z.any()),
  publicVerification: z.boolean(),
})

export const contracts = Cli.create('contracts', {
  description: 'Manage smart contracts.',
  vars: varsSchema,
})

contracts.command('list', {
  description: 'List registered contracts.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
  }),
  alias: { limit: 'l' },
  examples: [
    { description: 'List all contracts' },
    { options: { limit: 5 }, description: 'List first 5 contracts' },
  ],
  output: z.object({
    data: z.array(contractItem),
    total: z.number(),
  }),
  async run(c) {
    const res = await c.var.openfort.contracts.list({
      limit: c.options.limit,
      skip: c.options.skip,
    })
    return c.ok({
      data: res.data.map(ct => ({
        id: ct.id,
        createdAt: ct.createdAt,
        name: ct.name,
        chainId: ct.chainId,
        address: ct.address,
        deleted: ct.deleted,
        abi: ct.abi,
        publicVerification: ct.publicVerification,
      })),
      total: res.total,
    })
  },
})

contracts.command('create', {
  description: 'Register a smart contract.',
  options: z.object({
    name: z.string().describe('Contract name'),
    address: z.string().describe('Contract address'),
    chainId: z.number().describe('Chain ID'),
    abi: z.string().optional().describe('Contract ABI as JSON string'),
  }),
  output: contractItem,
  examples: [
    {
      options: { name: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', chainId: 137 },
      description: 'Register USDC on Polygon',
    },
    {
      options: { name: 'My NFT', address: '0x1234...', chainId: 1, abi: '[{"type":"function","name":"mint",...}]' },
      description: 'Register contract with ABI',
    },
  ],
  async run(c) {
    const res = await c.var.openfort.contracts.create({
      name: c.options.name,
      address: c.options.address,
      chainId: c.options.chainId,
      abi: c.options.abi ? JSON.parse(c.options.abi) : undefined,
    })
    return c.ok(
      {
        id: res.id,
        createdAt: res.createdAt,
        name: res.name,
        chainId: res.chainId,
        address: res.address,
        deleted: res.deleted,
        abi: res.abi,
        publicVerification: res.publicVerification,
      },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `contracts get ${res.id}`, description: 'View this contract' },
            { command: 'policies create', description: 'Create a policy for this contract' },
          ],
        },
      },
    )
  },
})

contracts.command('get', {
  description: 'Get a contract by ID.',
  args: z.object({
    id: z.string().describe('Contract ID (con_...)'),
  }),
  examples: [
    { args: { id: 'con_1a2b3c4d' }, description: 'Get contract details' },
  ],
  output: contractItem,
  async run(c) {
    const ct = await c.var.openfort.contracts.get(c.args.id)
    return c.ok({
      id: ct.id,
      createdAt: ct.createdAt,
      name: ct.name,
      chainId: ct.chainId,
      address: ct.address,
      deleted: ct.deleted,
      abi: ct.abi,
      publicVerification: ct.publicVerification,
    })
  },
})

contracts.command('update', {
  description: 'Update a contract.',
  args: z.object({
    id: z.string().describe('Contract ID (con_...)'),
  }),
  options: z.object({
    name: z.string().optional().describe('New name'),
    address: z.string().optional().describe('New address'),
    chainId: z.number().optional().describe('New chain ID'),
    abi: z.string().optional().describe('New ABI as JSON string'),
  }),
  examples: [
    { args: { id: 'con_1a2b3c4d' }, options: { name: 'USDC v2' }, description: 'Rename a contract' },
  ],
  output: contractItem,
  async run(c) {
    const res = await c.var.openfort.contracts.update(c.args.id, {
      name: c.options.name,
      address: c.options.address,
      chainId: c.options.chainId,
      abi: c.options.abi ? JSON.parse(c.options.abi) : undefined,
    })
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      name: res.name,
      chainId: res.chainId,
      address: res.address,
      deleted: res.deleted,
      abi: res.abi,
      publicVerification: res.publicVerification,
    })
  },
})

contracts.command('delete', {
  description: 'Delete a contract.',
  args: z.object({
    id: z.string().describe('Contract ID (con_...)'),
  }),
  examples: [
    { args: { id: 'con_1a2b3c4d' }, description: 'Delete a contract' },
  ],
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await c.var.openfort.contracts.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})
