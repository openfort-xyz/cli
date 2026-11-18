import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mcpTelemetryEnabled } from './telemetry.js'

type SentEvent = { event: string; distinct_id: string; properties: Record<string, unknown> }
type RpcResponse = { id: number; result?: any; error?: unknown }

const BIN = join(import.meta.dirname, 'bin.ts')
const ADDRESS = '0x1111111111111111111111111111111111111111'
const API_KEY = ['sk', 'test', '00000000-0000-4000-8000-000000000000'].join('_')
const MESSAGE = 'transfer to my cold wallet'

let sink: Server
let received: SentEvent[]
let host: string

beforeEach(async () => {
  received = []
  sink = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      let body = Buffer.concat(chunks)
      if (req.headers['content-encoding'] === 'gzip') body = gunzipSync(body)
      if (req.url === '/batch/') received.push(...JSON.parse(body.toString()).batch)
      res.end('{}')
    })
  })
  await new Promise<void>((resolve) => sink.listen(0, '127.0.0.1', resolve))
  host = `http://127.0.0.1:${(sink.address() as AddressInfo).port}`
})

afterEach(async () => {
  await new Promise((resolve) => sink.close(resolve))
})

/** Runs the CLI as a child process with a clean config dir, telemetry pointed at the local sink. */
function startCli(args: string[], env: Record<string, string> = {}) {
  return spawn(process.execPath, ['--import', 'tsx', BIN, ...args], {
    env: {
      PATH: process.env.PATH ?? '',
      XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'openfort-telemetry-')),
      OPENFORT_POSTHOG_HOST: host,
      OPENFORT_API_KEY: API_KEY,
      ...env,
    },
    stdio: ['pipe', 'pipe', 'inherit'],
  })
}

/** Starts `openfort --mcp`, runs `session` against it, then closes stdin (or sends SIGTERM)
 *  and waits for a clean exit. */
async function runMcp(
  env: Record<string, string>,
  session: (rpc: Rpc, init: RpcResponse) => Promise<void>,
  stop: 'stdin' | 'SIGTERM' = 'stdin',
) {
  const child = startCli(['--mcp'], env)
  const pending = new Map<number, (response: RpcResponse) => void>()
  let buffer = ''
  child.stdout.on('data', (data: Buffer) => {
    buffer += data.toString()
    let newline: number
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const response = JSON.parse(buffer.slice(0, newline)) as RpcResponse
      buffer = buffer.slice(newline + 1)
      pending.get(response.id)?.(response)
    }
  })
  let id = 0
  const rpc: Rpc = (method, params) =>
    new Promise((resolve) => {
      pending.set(++id, resolve)
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  const exited = new Promise<number | null>((resolve) => child.on('exit', resolve))
  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test-agent', version: '1.2.3' },
  })
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
  await session(rpc, init)
  if (stop === 'stdin') child.stdin.end()
  else child.kill('SIGTERM')
  expect(await exited).toBe(0)
}

type Rpc = (method: string, params: Record<string, unknown>) => Promise<RpcResponse>

async function hashMessage(rpc: Rpc) {
  const response = await rpc('tools/call', {
    name: 'call_read_tool',
    arguments: {
      name: 'message_hash',
      arguments: { message: MESSAGE },
      context: `hash a message for ${ADDRESS}`,
    },
  })
  expect(response.result.isError).not.toBe(true)
  return JSON.parse(response.result.content[0].text).hash as string
}

describe('mcpTelemetryEnabled', () => {
  it('is on only in --mcp mode', () => {
    expect(mcpTelemetryEnabled(['--mcp'], {})).toBe(true)
    expect(mcpTelemetryEnabled(['accounts', 'list'], {})).toBe(false)
  })

  it.each(['DO_NOT_TRACK', 'OPENFORT_TELEMETRY_DISABLED'])('is off when %s is truthy', (name) => {
    for (const value of ['1', 'true', 'yes']) expect(mcpTelemetryEnabled(['--mcp'], { [name]: value })).toBe(false)
    for (const value of ['', '0', 'false', 'FALSE']) expect(mcpTelemetryEnabled(['--mcp'], { [name]: value })).toBe(true)
  })
})

describe('MCP telemetry', { timeout: 30_000 }, () => {
  it('sends nothing for a plain command', async () => {
    const child = startCli(['message', 'hash', MESSAGE, '--format', 'json'])
    let output = ''
    child.stdout.on('data', (data: Buffer) => (output += data.toString()))
    expect(await new Promise((resolve) => child.on('exit', resolve))).toBe(0)
    expect(output).toContain('"hash"')
    expect(received).toEqual([])
  })

  it.each(['DO_NOT_TRACK', 'OPENFORT_TELEMETRY_DISABLED'])('sends nothing and adds no tool when %s=1', async (name) => {
    await runMcp({ [name]: '1' }, async (rpc, init) => {
      expect(init.result.instructions ?? '').not.toContain('send_feedback')
      const { result } = await rpc('tools/list', {})
      expect(result.tools.map((tool: { name: string }) => tool.name)).not.toContain('send_feedback')
      await hashMessage(rpc)
    })
    expect(received).toEqual([])
  })

  it('flushes queued events on SIGTERM', async () => {
    await runMcp({}, async (rpc) => {
      await rpc('tools/list', {})
    }, 'SIGTERM')
    expect(received.map((event) => event.event)).toEqual(['$mcp_initialize', '$mcp_tools_list'])
  })

  it('lists send_feedback and names it in the server instructions', async () => {
    await runMcp({}, async (rpc, init) => {
      expect(init.result.instructions).toContain('send_feedback')
      expect(init.result.instructions).toContain('missing_capability')
      const { result } = await rpc('tools/list', {})
      const feedback = result.tools.find((tool: { name: string }) => tool.name === 'send_feedback')
      expect(feedback?.description).toContain("Report a problem with the Openfort CLI's tools")
      expect(feedback?.description).toContain('wallet secrets')
      expect(result.tools.map((tool: { name: string }) => tool.name)).not.toContain('get_more_tools')
    })
    expect(received.map((event) => event.event)).toEqual(['$mcp_initialize', '$mcp_tools_list'])
  })

  it('serves the same server and commands as incur does with telemetry off', async () => {
    const serve = async (env: Record<string, string>) => {
      const seen: { server?: unknown; tools?: string[]; catalog: unknown[] } = { catalog: [] }
      await runMcp(env, async (rpc, init) => {
        seen.server = init.result.serverInfo
        seen.tools = (await rpc('tools/list', {})).result.tools.map((tool: { name: string }) => tool.name)
        let offset: number | undefined = 0
        while (offset !== undefined) {
          const page = await rpc('tools/call', { name: 'search_tools', arguments: { limit: 20, offset, context: 'list' } })
          const { tools, nextOffset } = JSON.parse(page.result.content[0].text)
          seen.catalog.push(...tools)
          offset = nextOffset
        }
      })
      return seen
    }
    const incur = await serve({ DO_NOT_TRACK: '1' })
    const ours = await serve({})
    expect(ours.server).toEqual(incur.server)
    expect(ours.tools).toEqual([...(incur.tools ?? []), 'send_feedback'])
    expect(ours.catalog).toEqual(incur.catalog)
    expect(incur.catalog.length).toBeGreaterThan(50)
  })

  it('sends a dispatched call under the command name, without argument values or results', async () => {
    let hash = ''
    await runMcp({}, async (rpc) => {
      hash = await hashMessage(rpc)
    })
    const call = received.find((event) => event.event === '$mcp_tool_call')
    expect(call?.properties).toMatchObject({
      $mcp_tool_name: 'message_hash',
      $mcp_resource_name: 'message_hash',
      $mcp_input_keys: ['message'],
      $mcp_client_name: 'test-agent',
      $mcp_client_version: '1.2.3',
      $mcp_intent: 'hash a message for [redacted]',
      $mcp_is_error: false,
      $process_person_profile: false,
    })
    expect(call?.distinct_id).toBe(call?.properties.$session_id)
    expect(call?.properties).not.toHaveProperty('$mcp_parameters')
    expect(call?.properties).not.toHaveProperty('$mcp_response')
    const body = JSON.stringify(received)
    for (const secret of [MESSAGE, hash, ADDRESS, API_KEY]) expect(body).not.toContain(secret)
  })

  it('records a failed call as an error flag, without its message or an $exception', async () => {
    let errorText = ''
    await runMcp({}, async (rpc) => {
      const response = await rpc('tools/call', {
        name: 'call_read_tool',
        arguments: { name: 'message_hash', arguments: { message: 42 } },
      })
      expect(response.result.isError).toBe(true)
      errorText = response.result.content[0].text
    })
    const call = received.find((event) => event.event === '$mcp_tool_call')
    expect(call?.properties).toMatchObject({ $mcp_tool_name: 'message_hash', $mcp_is_error: true })
    expect(call?.properties).not.toHaveProperty('$mcp_error_message')
    expect(received.map((event) => event.event)).not.toContain('$exception')
    expect(JSON.stringify(received)).not.toContain(errorText)
  })

  it('sends feedback with keys and addresses masked', async () => {
    await runMcp({}, async (rpc) => {
      await rpc('tools/call', {
        name: 'send_feedback',
        arguments: {
          feedback_type: 'missing_capability',
          summary: 'No tool lists supported chains',
          details: `Tried with ${API_KEY} for ${ADDRESS}`,
          tool_name: 'accounts_evm_list',
        },
      })
    })
    const feedback = received.find((event) => event.event === '$mcp_feedback')
    expect(feedback?.properties).toMatchObject({
      $mcp_feedback_type: 'missing_capability',
      $mcp_feedback_summary: 'No tool lists supported chains',
      $mcp_feedback_tool: 'accounts_evm_list',
    })
    const body = JSON.stringify(received)
    expect(body).not.toContain('8f3c2a1e')
    expect(body).not.toContain(ADDRESS)
  })
})
