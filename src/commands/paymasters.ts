import { Cli, z } from 'incur'
import { varsSchema } from '../vars.js'

const paymasterItem = z.object({
  id: z.string(),
  createdAt: z.number(),
  address: z.string(),
  url: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})

export const paymasters = Cli.create('paymasters', {
  description: 'Manage ERC-4337 paymasters.',
  vars: varsSchema,
})

paymasters.command('create', {
  description: 'Create a paymaster.',
  options: z.object({
    address: z.string().describe('Paymaster contract address'),
    name: z.string().optional().describe('Paymaster name'),
    url: z.string().optional().describe('Paymaster URL'),
  }),
  output: paymasterItem,
  async run(c) {
    const res = await c.var.openfort.paymasters.create({
      address: c.options.address,
      name: c.options.name,
      url: c.options.url,
    })
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      address: res.address,
      url: res.url,
      context: res.context,
    })
  },
})

paymasters.command('get', {
  description: 'Get a paymaster by ID.',
  args: z.object({
    id: z.string().describe('Paymaster ID (pay_...)'),
  }),
  output: paymasterItem,
  async run(c) {
    const p = await c.var.openfort.paymasters.get(c.args.id)
    return c.ok({
      id: p.id,
      createdAt: p.createdAt,
      address: p.address,
      url: p.url,
      context: p.context,
    })
  },
})

paymasters.command('update', {
  description: 'Update a paymaster.',
  args: z.object({
    id: z.string().describe('Paymaster ID (pay_...)'),
  }),
  options: z.object({
    address: z.string().describe('Paymaster address'),
    name: z.string().optional().describe('New name'),
    url: z.string().optional().describe('New URL'),
  }),
  output: paymasterItem,
  async run(c) {
    const res = await c.var.openfort.paymasters.update(c.args.id, {
      address: c.options.address,
      name: c.options.name,
      url: c.options.url,
    })
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      address: res.address,
      url: res.url,
      context: res.context,
    })
  },
})

paymasters.command('delete', {
  description: 'Delete a paymaster.',
  args: z.object({
    id: z.string().describe('Paymaster ID (pay_...)'),
  }),
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await c.var.openfort.paymasters.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})
