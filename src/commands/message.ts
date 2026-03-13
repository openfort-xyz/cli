import { Cli, z } from 'incur'
import { keccak256, toBytes } from 'viem'
import { varsSchema } from '../vars.js'

export const message = Cli.create('message', {
  description: 'Message utilities.',
  vars: varsSchema,
})

message.command('hash', {
  description: 'Hash a message using keccak256.',
  args: z.object({
    message: z.string().describe('The message to hash'),
  }),
  examples: [
    { args: { message: 'Hello World' }, description: 'Hash a message' },
  ],
  output: z.object({
    hash: z.string(),
  }),
  async run(c) {
    const hash = keccak256(toBytes(c.args.message))
    return c.ok({ hash })
  },
})
