---
"@openfort/cli": patch
---

Mark read-only commands (`get`, `list`, `logs`, `policies evaluate`, `transactions estimate`, `message hash`) with the MCP `readOnlyHint` annotation, so agents can run them through `call_read_tool`. Before, every command was unannotated and `call_read_tool` rejected all of them. Commands that create, update, delete, sign, send or export keys stay write-only.
