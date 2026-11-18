# okf-wiki-mcp

Zero-dependency, 100% offline **Model Context Protocol (`MCP` JSON-RPC 2.0)** stdio server and CLI for querying local **Google OKF v0.2** and **Obsidian Markdown** meeting-notes vaults inside **Claude Desktop**, **Claude Code**, **Cursor**, **Windsurf**, and **OneMira**.

- **Zero npm runtime dependencies** — pure Node.js `>=18` standard library (`node:fs`, `node:path`), auditable in under 350 lines.
- **100% Local & Zero Cloud** — reads `.md` transcripts, YAML frontmatter, `[[wiki-links]]`, and `- [ ]` action items directly from disk with zero external network calls.
- **Works with any local Markdown vault** — Obsidian vaults, transcripts migrated via [`transcript-to-okf`](https://github.com/onemira-space/transcript-to-okf) from Otter/Plaud/HiNotes/Notta, or live spoken context captured by the [OneMira C1 AI Voice Recorder](https://onemira.com/products/c1) (`$0/mo` Local AI · Works Standalone · Speaker ID · Zero Cloud).

---

## Install & Run Instantly

### Via `npx` (Zero Global Install)
```bash
npx -y okf-wiki-mcp --vault ~/Documents/Meetings stats
```

### Via Homebrew (`macOS` & `Linux`)
```bash
brew tap onemira-space/tap https://github.com/onemira-space/homebrew-tap
brew install okf-wiki-mcp
okf-wiki-mcp --vault ~/Documents/Meetings stats
```

---

## Connect to Claude Desktop, Claude Code & Cursor (`mcpServers`)

Add to `claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "okf-wiki": {
      "command": "npx",
      "args": ["-y", "okf-wiki-mcp", "--vault", "/Users/you/Documents/Meetings", "--serve"]
    }
  }
}
```

### Provided MCP Tools (`tools/list`)
| Tool | Description |
| :--- | :--- |
| `okf_search_meetings` | Search `.md` transcripts and notes by keyword, `speaker`, `tag`, and ISO `fromDate`/`toDate`. |
| `okf_list_action_items` | Extract `- [ ]` / `- [x]` action items across all sessions filtered by `status` and `@owner`. |
| `okf_read_note` | Read a note by relative path, slug, or `[[wiki-link]]` title, including frontmatter and incoming **backlinks**. |
| `okf_topic_graph` | Compute the relational `[[wiki-link]]` graph, top referenced entities, and unresolved links. |
| `okf_vault_stats` | Audit total notes, YAML frontmatter coverage, unique speakers, and action-item completion counts. |

---

## Companion Open-Source Local Context Tools

- **[OneMira MCP Integration Guide](https://onemira.com/docs/mcp-integration)** — Full architecture reference for OneMira Desktop's native `mira` CLI & MCP server.
- **[AI Voice Recorder for Obsidian & Local Markdown Workflows](https://onemira.com/blogs/ai-voice-recorder-for-obsidian-and-local-markdown)** — End-to-end local `.md` + stereo `.wav` setup guide.
- **[`transcript-to-okf`](https://github.com/onemira-space/transcript-to-okf)** — Offline multi-vendor transcript migrator (Otter.ai, Plaud, HiNotes/HiDock, Notta, Zoom/Teams WebVTT & SRT -> OKF v0.2 Markdown).
- **[`okf-markdown`](https://github.com/onemira-space/okf-markdown)** — OKF v0.2 schema validator & relational link linter.
- **[`meeting-minutes-md`](https://github.com/onemira-space/meeting-minutes-md)** — 7-language (`EN/DE/FR/IT/ES/PT/KO`) agenda & meeting-minutes formatter.
- **[`ai-voice-recorder-tco-dataset`](https://github.com/onemira-space/ai-voice-recorder-tco-dataset)** — CC-BY-4.0 2026 AI voice recorder spec & 24-month TCO calculator (`Compare 14+ models` at [onemira.com/compare](https://onemira.com/compare)).

## License

MIT © [OneMira](https://onemira.com)
