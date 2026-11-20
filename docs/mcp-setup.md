# MCP Client Setup (Claude Desktop, Claude Code, Cursor)

Add `okf-wiki-mcp` to your `claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "okf-wiki": {
      "command": "npx",
      "args": [
        "-y",
        "okf-wiki-mcp",
        "--vault",
        "/Users/you/Documents/Meetings",
        "--serve"
      ]
    }
  }
}
```

## Security Model

- Strictly **read-only** filesystem access scoped inside `--vault`.
- Supports both newline-delimited JSON-RPC 2.0 and `Content-Length` stdio framing.
- Zero outbound HTTP requests, zero telemetry, zero API keys required.

## Full Integration Guides

- [OneMira MCP Integration Guide](https://onemira.com/docs/mcp-integration)
- [AI Voice Recorder for Obsidian & Local Markdown](https://onemira.com/blogs/ai-voice-recorder-for-obsidian-and-local-markdown)
- [OneMira C1 Hardware Overview](https://onemira.com/products/c1)
