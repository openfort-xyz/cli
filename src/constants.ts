export const API_BASE_URL = process.env.OPENFORT_BASE_URL || 'https://api.openfort.io'
export const OPENFORT_SHIELD_URL = process.env.OPENFORT_SHIELD_URL || 'https://shield.openfort.io'
export const AUTH_PAGE_URL = process.env.OPENFORT_AUTH_PAGE_URL || 'https://dashboard.openfort.io'
export const CLI_CALLBACK_PORT = Number(process.env.OPENFORT_CLI_CALLBACK_PORT) || 8271

/** MCP annotations for commands that only read. `call_read_tool` runs only commands marked read-only. */
export const READ_ONLY_TOOL = { annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true } }
