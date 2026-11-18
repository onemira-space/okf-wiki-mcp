#!/usr/bin/env node
import path from 'node:path';
import {
  loadVault,
  searchMeetings,
  listActionItems,
  readNote,
  buildTopicGraph,
  computeVaultStats,
  startStdioMcpServer,
} from '../src/index.mjs';

const args = process.argv.slice(2);

function readFlag(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`okf-wiki-mcp v1.0.1 — Offline MCP Server & CLI for Google OKF v0.2 / Obsidian Markdown Vaults

Usage:
  okf-wiki-mcp --vault <dir> [--serve]               Start stdio MCP JSON-RPC 2.0 server
  okf-wiki-mcp --vault <dir> stats                   Print vault frontmatter, speaker & wiki-link stats
  okf-wiki-mcp --vault <dir> search <query>          Search local meeting notes & transcripts offline
  okf-wiki-mcp --vault <dir> actions [--owner name]  List open Markdown action items (- [ ])
  okf-wiki-mcp --vault <dir> read <note>             Read a note with frontmatter & incoming backlinks
  okf-wiki-mcp --vault <dir> graph                   Output relational [[wiki-link]] topic graph

Docs: https://onemira.com/docs/mcp-integration`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log('1.0.1');
  process.exit(0);
}

const vaultDir = path.resolve(readFlag('--vault') || process.env.OKF_VAULT_DIR || process.cwd());
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--vault' || args[i] === '--owner' || args[i] === '--status') {
    i++;
    continue;
  }
  if (args[i].startsWith('--')) continue;
  positional.push(args[i]);
}

const cmd = positional[0];
if (!cmd || args.includes('--serve')) {
  startStdioMcpServer(vaultDir);
} else {
  const vault = loadVault(vaultDir);
  if (cmd === 'stats') console.log(JSON.stringify(computeVaultStats(vault), null, 2));
  else if (cmd === 'search') console.log(JSON.stringify(searchMeetings(vault, {query: positional.slice(1).join(' ')}), null, 2));
  else if (cmd === 'actions') console.log(JSON.stringify(listActionItems(vault, {owner: readFlag('--owner') || '', status: readFlag('--status') || 'open'}), null, 2));
  else if (cmd === 'read') {
    const note = readNote(vault, positional.slice(1).join(' '));
    if (!note) { console.error('Note not found'); process.exit(1); }
    console.log(JSON.stringify(note, null, 2));
  } else if (cmd === 'graph') console.log(JSON.stringify(buildTopicGraph(vault), null, 2));
  else {
    console.error(`Unknown command: ${cmd}. Run okf-wiki-mcp --help`);
    process.exit(1);
  }
}
