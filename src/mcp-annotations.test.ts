import { PassThrough } from 'node:stream'
import { Cli, Mcp } from 'incur'
import { describe, expect, it } from 'vitest'
import cli from './cli.js'

const commands = Cli.toCommands.get(cli as unknown as Cli.Cli)!

/** Every MCP tool and whether it only reads. A new command fails this test until it is added here. */
const CLASSIFICATION: Record<string, 'read' | 'write'> = {
  'accounts_evm_create': 'write',
  'accounts_evm_delete': 'write',
  // Returns a private key: kept off call_read_tool, which hosts may run without asking.
  'accounts_evm_export': 'write',
  'accounts_evm_get': 'read',
  'accounts_evm_import': 'write',
  'accounts_evm_list': 'read',
  'accounts_evm_list-delegated': 'read',
  'accounts_evm_list-smart': 'read',
  'accounts_evm_send-transaction': 'write',
  'accounts_evm_sign': 'write',
  'accounts_evm_update': 'write',
  'accounts_list': 'read',
  'accounts_solana_create': 'write',
  'accounts_solana_delete': 'write',
  'accounts_solana_export': 'write',
  'accounts_solana_get': 'read',
  'accounts_solana_import': 'write',
  'accounts_solana_list': 'read',
  'accounts_solana_sign': 'write',
  'accounts_solana_transfer': 'write',
  'backend-wallet_revoke': 'write',
  'backend-wallet_rotate': 'write',
  'backend-wallet_setup': 'write',
  'chains_list': 'read',
  'contracts_create': 'write',
  'contracts_delete': 'write',
  'contracts_get': 'read',
  'contracts_list': 'read',
  'contracts_update': 'write',
  'embedded-wallet_setup': 'write',
  'login': 'write',
  'logs_list': 'read',
  'logs_subscriptions': 'read',
  'logs_webhook': 'read',
  'message_hash': 'read',
  'paymasters_create': 'write',
  'paymasters_delete': 'write',
  'paymasters_get': 'read',
  'paymasters_update': 'write',
  'policies_create': 'write',
  'policies_delete': 'write',
  'policies_evaluate': 'read',
  'policies_get': 'read',
  'policies_list': 'read',
  'policies_update': 'write',
  'sessions_create': 'write',
  'sessions_get': 'read',
  'sessions_list': 'read',
  'sessions_revoke': 'write',
  'sessions_sign': 'write',
  'sponsorship_create': 'write',
  'sponsorship_delete': 'write',
  'sponsorship_disable': 'write',
  'sponsorship_enable': 'write',
  'sponsorship_get': 'read',
  'sponsorship_list': 'read',
  'sponsorship_update': 'write',
  'subscriptions_create': 'write',
  'subscriptions_delete': 'write',
  'subscriptions_get': 'read',
  'subscriptions_list': 'read',
  'subscriptions_triggers_create': 'write',
  'subscriptions_triggers_delete': 'write',
  'subscriptions_triggers_get': 'read',
  'subscriptions_triggers_list': 'read',
  'transactions_create': 'write',
  'transactions_estimate': 'read',
  'transactions_get': 'read',
  'transactions_list': 'read',
  'transactions_sign': 'write',
  'users_delete': 'write',
  'users_get': 'read',
  'users_list': 'read',
}

describe('MCP tool annotations', () => {
  it('marks exactly the read commands read-only', () => {
    const actual = Object.fromEntries(
      Mcp.collectTools(commands, []).map((tool) => [
        tool.name,
        tool.annotations?.readOnlyHint === true ? 'read' : 'write',
      ]),
    )
    expect(actual).toEqual(CLASSIFICATION)
  })

  it('runs read commands through call_read_tool and refuses write commands there', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const responses = new Map<number, (response: any) => void>()
    let buffer = ''
    output.on('data', (data: Buffer) => {
      buffer += data.toString()
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const response = JSON.parse(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        responses.get(response.id)?.(response)
      }
    })
    let id = 0
    const call = (name: string, args: Record<string, unknown>) =>
      new Promise<any>((resolve) => {
        responses.set(++id, (response) => resolve(response.result))
        input.write(`${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })}\n`)
      })
    await Mcp.serve('openfort', '0.0.0', commands, { input, output })

    const read = await call('call_read_tool', { name: 'message_hash', arguments: { message: 'hello' } })
    expect(read.isError).toBeUndefined()
    expect(JSON.parse(read.content[0].text).hash).toMatch(/^0x[0-9a-f]{64}$/)

    const write = await call('call_read_tool', { name: 'accounts_evm_create', arguments: {} })
    expect(write.isError).toBe(true)
    expect(write.content[0].text).toContain('Tool is not read-only: accounts_evm_create')

    const readAsWrite = await call('call_write_tool', { name: 'accounts_evm_list', arguments: {} })
    expect(readAsWrite.content[0].text).toContain('Tool is read-only: accounts_evm_list')
    input.end()
  })
})
