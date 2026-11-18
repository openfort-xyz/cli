import { readFileSync } from 'node:fs'
import type { BeforeSendFn, PostHog } from '@posthog/mcp'
import { Cli, Mcp } from 'incur'
import { POSTHOG_HOST, POSTHOG_PROJECT_TOKEN } from './constants.js'

const { version }: { version: string } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
)

const FEEDBACK_INSTRUCTIONS =
  'Feedback: when an Openfort tool fails, returns something wrong or unclear, or its description misleads you, report it with send_feedback once per problem, after the user\'s task. When the user needs something no Openfort tool does (search_tools finds nothing), send it with feedback_type missing_capability.'

const FEEDBACK_DESCRIPTION = [
  'Report a problem with the Openfort CLI\'s tools to the team that builds them. The team reads every report and ships fixes from them.',
  'Call this when a tool was missing for what you needed (feedback_type missing_capability), failed, returned something wrong or unclear, forced a workaround, or its description misled you. Call it once per distinct problem, after you have finished or given up on the user\'s task, never instead of doing it. Tell the user in one line that you sent feedback.',
  'Be specific so the team can act without asking you: set tool_name, describe the input you sent, what came back and what you expected, and put in suggested_improvement the exact change you propose (a new parameter, a reworded description, a new tool, a different default).',
  'Never include API keys, secret or publishable keys, wallet secrets, private keys, wallet addresses, transaction hashes, user ids, emails or any other user data, in any field. Describe their shape instead ("a sk_test_ key", "an EVM address", "a user id").',
].join('\n\n')

/** Every property that may leave the process. Anything else the SDK adds (`$mcp_parameters`,
 *  `$mcp_response`, `$mcp_error_message`, `$set`, `$groups`, properties of later SDK versions)
 *  is dropped: CLI tool arguments and results carry keys and addresses. */
const SENT_PROPERTIES = new Set([
  '$mcp_interface',
  '$mcp_source',
  '$session_id',
  '$process_person_profile',
  '$mcp_tool_name',
  '$mcp_resource_name',
  '$mcp_listed_tool_names',
  '$mcp_input_keys',
  '$mcp_duration_ms',
  '$mcp_is_error',
  '$mcp_server_name',
  '$mcp_server_version',
  '$mcp_client_name',
  '$mcp_client_version',
  '$mcp_client_user_agent',
  '$mcp_vendor_client',
  '$mcp_protocol_version',
  '$mcp_llm_model',
  '$mcp_llm_model_source',
  '$mcp_intent',
  '$mcp_intent_source',
  '$mcp_feedback_type',
  '$mcp_feedback_summary',
  '$mcp_feedback_details',
  '$mcp_feedback_friction_points',
  '$mcp_feedback_suggested_improvement',
  '$mcp_feedback_tool',
  '$mcp_feedback_sentiment',
  '$mcp_feedback_task_completed',
])

/** Agent-written text: the SDK masks emails, phones, IPs and cards; this masks the rest. */
const FREE_TEXT = /^\$mcp_(intent|feedback_(summary|details|friction_points|suggested_improvement))$/
/** API keys, then any 32+ character token: wallet secrets, EVM and Solana addresses, tx hashes. */
const SECRET = /\b[sp]k_(?:test|live)_[\w-]*|[A-Za-z0-9_+/=-]{32,}/g
/** Progressive discovery runs every command through these; events name the command instead. */
const DISPATCH_TOOLS = new Set(['call_read_tool', 'call_write_tool'])

function optedOut(value: string | undefined): boolean {
  return Boolean(value) && !['0', 'false'].includes(value!.toLowerCase())
}

/** True in `--mcp` mode unless `DO_NOT_TRACK` or `OPENFORT_TELEMETRY_DISABLED` is set. */
export function mcpTelemetryEnabled(argv = process.argv.slice(2), env = process.env): boolean {
  return argv.includes('--mcp') && !optedOut(env.DO_NOT_TRACK) && !optedOut(env.OPENFORT_TELEMETRY_DISABLED)
}

function mask(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(SECRET, '[redacted]')
  if (Array.isArray(value)) return value.map(mask)
  return value
}

type DispatchCall = { request?: { params?: { arguments?: { name?: unknown; arguments?: unknown } } } }

/** The command a `call_*_tool` event ran, with the argument names it declares that were passed. */
function dispatchedTool(properties: Record<string, unknown>, tools: Map<string, Set<string>>) {
  if (!DISPATCH_TOOLS.has(properties.$mcp_tool_name as string)) return undefined
  const call = (properties.$mcp_parameters as DispatchCall | undefined)?.request?.params?.arguments
  const name = call?.name
  const declared = typeof name === 'string' ? tools.get(name) : undefined
  if (!declared) return undefined
  const args = call?.arguments && typeof call.arguments === 'object' ? call.arguments : {}
  return { name: name as string, inputKeys: Object.keys(args).filter((key) => declared.has(key)) }
}

/** Keeps only SENT_PROPERTIES, masks keys and long tokens in agent text, and names the command
 *  behind `call_read_tool` / `call_write_tool`. */
function redactEvent(tools: Map<string, Set<string>>): BeforeSendFn {
  return (event) => {
    const properties: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(event.properties)) {
      if (!SENT_PROPERTIES.has(key)) continue
      properties[key] = FREE_TEXT.test(key) ? mask(value) : value
    }
    const dispatched = dispatchedTool(event.properties, tools)
    if (dispatched) {
      properties.$mcp_tool_name = dispatched.name
      properties.$mcp_resource_name = dispatched.name
      properties.$mcp_input_keys = dispatched.inputKeys
    }
    return { ...event, properties }
  }
}

function commandsOf(cli: object) {
  const commands = Cli.toCommands.get(cli as Cli.Cli)
  if (!commands) throw new Error('MCP: the CLI has no commands registered')
  return commands
}

/** Tool name to declared argument names, for every command incur exposes over MCP. */
function commandTools(cli: object): Map<string, Set<string>> {
  const tools = new Map<string, Set<string>>()
  for (const tool of Mcp.collectTools(commandsOf(cli), [])) {
    tools.set(tool.name, new Set(Object.keys(tool.inputSchema.properties ?? {})))
  }
  return tools
}

/**
 * Serves the CLI over MCP stdio like `openfort --mcp`, with `$mcp_*` events sent to PostHog and a
 * `send_feedback` tool. incur 0.4 creates its MCP server internally with no hook, so this builds
 * the server itself and registers the commands with incur's own `Mcp.registerTools`.
 */
export async function serveMcp(cli: object): Promise<PostHog> {
  const [{ instrument, PostHog }, { McpServer, fromJsonSchema }, { StdioServerTransport }] = await Promise.all([
    import('@posthog/mcp'),
    import('@modelcontextprotocol/server'),
    import('@modelcontextprotocol/server/stdio'),
  ])
  const server = new McpServer({ name: 'openfort', version }, { instructions: FEEDBACK_INSTRUCTIONS })
  Mcp.registerTools(server, commandsOf(cli), {
    fromJsonSchema,
    name: 'openfort',
    sendNotification: (notification) => server.server.notification(notification),
    version,
  })
  const posthog = new PostHog(POSTHOG_PROJECT_TOKEN, { host: POSTHOG_HOST })
  instrument(server, posthog, {
    collectFeedback: { description: FEEDBACK_DESCRIPTION },
    reportMissing: false,
    enableExceptionAutocapture: false,
    // One stdio process is one session; a conversation_id would add an argument to every tool.
    enableConversationId: false,
    beforeSend: redactEvent(commandTools(cli)),
  })
  await server.connect(new StdioServerTransport(process.stdin, process.stdout))
  return posthog
}
