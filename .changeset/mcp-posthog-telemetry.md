---
"@openfort/cli": minor
---

Send anonymous usage telemetry to PostHog in MCP mode (`openfort --mcp`): tool names, durations, error flags, MCP client name and version, and the intent or feedback text agents write. Argument values, results, keys and addresses are never sent. Agents get a `send_feedback` tool to report broken or missing tools. Plain CLI commands send nothing. Turn it off with `DO_NOT_TRACK=1` or `OPENFORT_TELEMETRY_DISABLED=1`.
