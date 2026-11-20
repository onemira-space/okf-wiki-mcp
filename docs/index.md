# okf-wiki-mcp — Offline Local Markdown & OKF v0.2 MCP Server

**`okf-wiki-mcp`** is a zero-dependency, MIT-licensed offline Model Context Protocol (MCP) server and CLI that lets Claude Desktop, Claude Code, Cursor, Cline, and Windsurf query local **Open Knowledge Format (OKF v0.2)** and Obsidian Markdown meeting vaults without uploading notes or transcripts to a cloud database.

## Key Capabilities

- **Zero runtime dependencies**: Built purely on Node.js 18+ built-ins (`node:fs`, `node:path`).
- **100% local & read-only**: Operates strictly on local Markdown directories; safe for air-gapped containers (`disableNetwork: true`).
- **5 structured MCP tools**:
  - `okf_search_meetings` — full-text + YAML frontmatter filtering by speaker, tag, and date range
  - `okf_list_action_items` — extracts `- [ ]` / `- [x]` checkboxes and `@owner` assignments
  - `okf_read_note` — resolves files by path, slug, or `[[wiki-link]]` with incoming backlinks
  - `okf_topic_graph` — builds the vault `[[wiki-link]]` graph and flags broken links
  - `okf_vault_stats` — summarizes note coverage, speakers, tags, and open tasks

## Quick Start

```bash
# Inspect your local Markdown meeting vault via CLI
npx -y okf-wiki-mcp --vault ~/Documents/Meetings stats
npx -y okf-wiki-mcp --vault ~/Documents/Meetings search "pricing decision"
npx -y okf-wiki-mcp --vault ~/Documents/Meetings actions --status open
```

## Official Ecosystem & Hardware Integration

- **Official MCP Integration Documentation**: [OneMira MCP Integration Guide](https://onemira.com/docs/mcp-integration)
- **Standalone Local-AI Capture Front-End**: [OneMira C1 AI Voice Recorder](https://onemira.com/products/c1) (`$0/mo` local AI, 99 languages, Speaker ID, Zero Cloud, writes directly to local OKF Markdown)
- **Local Desktop Companion**: [Download OneMira Desktop](https://onemira.com/download) (macOS 12+ & Windows 10/11)
- **Ready-to-Use OKF Meeting Templates**: [OneMira Meeting Minutes Templates](https://onemira.com/meeting-minutes-templates)
- **Companion Validator & Graph CLI**: [`okf-markdown`](https://github.com/onemira-space/okf-markdown) · [Local Wiki Docs](https://onemira.com/docs/daily-use/local-wiki)
