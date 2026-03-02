import { Cli, z } from 'incur'
import { varsSchema } from '../vars.js'

const userItem = z.object({
  id: z.string(),
  createdAt: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneNumber: z.string().nullable(),
  phoneNumberVerified: z.boolean(),
  isAnonymous: z.boolean().optional(),
  linkedAccounts: z.array(z.object({
    provider: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
    accountId: z.string().optional(),
    chainType: z.string().optional(),
    connectorType: z.string().optional(),
    walletClientType: z.string().optional(),
  })),
})

export const users = Cli.create('users', {
  description: 'Manage authenticated users.',
  vars: varsSchema,
})

users.command('list', {
  description: 'List users.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
    email: z.string().optional().describe('Filter by email'),
    name: z.string().optional().describe('Filter by name'),
  }),
  alias: { limit: 'l' },
  output: z.object({
    data: z.array(userItem),
    total: z.number(),
  }),
  async run(c) {
    const res = await c.var.openfort.iam.users.list({
      limit: c.options.limit,
      skip: c.options.skip,
      email: c.options.email,
      name: c.options.name,
    })
    return c.ok({
      data: res.data.map(u => ({
        id: u.id,
        createdAt: u.createdAt,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        phoneNumber: u.phoneNumber,
        phoneNumberVerified: u.phoneNumberVerified,
        isAnonymous: u.isAnonymous,
        linkedAccounts: u.linkedAccounts,
      })),
      total: res.total,
    })
  },
})

users.command('get', {
  description: 'Get a user by ID.',
  args: z.object({
    id: z.string().describe('User ID (usr_...)'),
  }),
  output: userItem,
  async run(c) {
    const u = await c.var.openfort.iam.users.get(c.args.id)
    return c.ok({
      id: u.id,
      createdAt: u.createdAt,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      phoneNumber: u.phoneNumber,
      phoneNumberVerified: u.phoneNumberVerified,
      isAnonymous: u.isAnonymous,
      linkedAccounts: u.linkedAccounts,
    })
  },
})

users.command('delete', {
  description: 'Delete a user.',
  args: z.object({
    id: z.string().describe('User ID (usr_...)'),
  }),
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await c.var.openfort.iam.users.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})
