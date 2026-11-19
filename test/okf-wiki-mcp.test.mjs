import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import test from 'node:test';
import {
  loadVault,
  searchMeetings,
  listActionItems,
  readNote,
  buildTopicGraph,
  computeVaultStats,
  handleMcpRequest,
} from '../src/index.mjs';

function createFixtureVault() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'okf-wiki-mcp-test-'));
  fs.writeFileSync(
    path.join(dir, '2026-11-15-architecture-sync.md'),
    `---
title: Q4 Firmware & Local AI Architecture Sync
date: 2026-11-15
okf_version: "0.2"
kind: meeting
speakers: [Alice, Bob]
tags: [firmware, local-ai]
---

# Q4 Firmware & Local AI Architecture Sync

Reviewed [[Local AI Pipeline]] and [[USB-C Transfer Protocol]] latency targets.

## Action Items
- [ ] @Alice Benchmark stereo WAV transfer speed on macOS 15
- [x] @Bob Lock 1250mAh standby power profile
`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(dir, 'local-ai-pipeline.md'),
    `---
title: Local AI Pipeline
date: 2026-11-16
okf_version: "0.2"
kind: wiki-topic
speakers: [Alice, Clara]
tags: [local-ai, speaker-id]
---

# Local AI Pipeline

Connects 99-language offline ASR and Speaker ID to [[Obsidian Vaults]] without cloud uploads.

- [ ] @Clara Document MCP stdio configuration for Claude Desktop and Cursor
`,
    'utf8',
  );
  return dir;
}

test('1. loadVault & computeVaultStats accurately audit notes, speakers, wiki-links, and actions', () => {
  const dir = createFixtureVault();
  try {
    const stats = computeVaultStats(loadVault(dir));
    assert.equal(stats.totalNotes, 2);
    assert.equal(stats.notesWithFrontmatter, 2);
    assert.deepEqual(stats.uniqueSpeakers.sort(), ['Alice', 'Bob', 'Clara']);
    assert.equal(stats.totalWikiLinks, 3);
    assert.equal(stats.unresolvedWikiLinks, 2);
    assert.equal(stats.openActionItems, 2);
    assert.equal(stats.completedActionItems, 1);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('2. searchMeetings filters by keyword, speaker, and tag', () => {
  const dir = createFixtureVault();
  try {
    const vault = loadVault(dir);
    const res = searchMeetings(vault, {query: 'stereo WAV', speaker: 'Alice'});
    assert.equal(res.length, 1);
    assert.equal(res[0].file, '2026-11-15-architecture-sync.md');
    assert.equal(searchMeetings(vault, {tag: 'speaker-id'})[0].file, 'local-ai-pipeline.md');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('3. listActionItems filters open vs completed items and @owner assignments', () => {
  const dir = createFixtureVault();
  try {
    const vault = loadVault(dir);
    assert.equal(listActionItems(vault, {status: 'open'}).length, 2);
    assert.equal(listActionItems(vault, {status: 'open', owner: 'clara'}).length, 1);
    assert.equal(listActionItems(vault, {status: 'completed'})[0].owner, 'Bob');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('4. readNote resolves [[wiki-link]] title and computes incoming backlinks', () => {
  const dir = createFixtureVault();
  try {
    const note = readNote(loadVault(dir), '[[Local AI Pipeline]]');
    assert.equal(note.file, 'local-ai-pipeline.md');
    assert.equal(note.backlinks.length, 1);
    assert.equal(note.backlinks[0].file, '2026-11-15-architecture-sync.md');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('5. buildTopicGraph identifies referenced topics and unresolved wiki-links', () => {
  const dir = createFixtureVault();
  try {
    const graph = buildTopicGraph(loadVault(dir));
    assert.equal(graph.totalEdges, 3);
    assert.equal(graph.unresolvedLinks.length, 2);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('6. end-to-end stdio JSON-RPC 2.0 MCP server handles initialize, tools/list, tools/call, and resources/read', async () => {
  const dir = createFixtureVault();
  try {
    const binPath = new URL('../bin/okf-wiki-mcp.mjs', import.meta.url).pathname;
    const child = spawn(process.execPath, [binPath, '--vault', dir, '--serve'], {stdio: ['pipe', 'pipe', 'pipe']});
    const responses = [];
    let outBuf = '';
    child.stdout.on('data', (chunk) => {
      outBuf += chunk.toString('utf8');
      let nl;
      while ((nl = outBuf.indexOf('\n')) !== -1) {
        const line = outBuf.slice(0, nl).trim();
        outBuf = outBuf.slice(nl + 1);
        if (line) responses.push(JSON.parse(line));
      }
    });
    for (const req of [
      {jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2024-11-05'}},
      {jsonrpc: '2.0', method: 'notifications/initialized'},
      {jsonrpc: '2.0', id: 2, method: 'tools/list'},
      {jsonrpc: '2.0', id: 3, method: 'tools/call', params: {name: 'okf_vault_stats', arguments: {}}},
      {jsonrpc: '2.0', id: 4, method: 'resources/read', params: {uri: 'okf://note/local-ai-pipeline.md'}},
    ]) {
      child.stdin.write(JSON.stringify(req) + '\n');
    }
    child.stdin.end();
    await new Promise((resolve) => child.on('close', resolve));
    assert.equal(responses.length, 4);
    assert.equal(responses[0].result.serverInfo.name, 'okf-wiki-mcp');
    assert.equal(responses[1].result.tools.length, 5);
    assert.equal(JSON.parse(responses[2].result.content[0].text).totalNotes, 2);
    assert.ok(responses[3].result.contents[0].text.includes('99-language offline ASR'));
    assert.deepEqual(handleMcpRequest(dir, {jsonrpc: '2.0', id: 99, method: 'ping'}), {jsonrpc: '2.0', id: 99, result: {}});
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('7. MCP tool definitions include titles, read-only annotations, and parameter descriptions; empty vault boots cleanly', () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'okf-wiki-empty-'));
  try {
    const init = handleMcpRequest(emptyDir, {jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2024-11-05'}});
    assert.equal(init.result.serverInfo.version, '1.0.3');
    const list = handleMcpRequest(emptyDir, {jsonrpc: '2.0', id: 2, method: 'tools/list'});
    assert.equal(list.result.tools.length, 5);
    for (const tool of list.result.tools) {
      assert.ok(tool.title && tool.title.length > 3, `missing title on ${tool.name}`);
      assert.equal(tool.annotations?.readOnlyHint, true, `missing readOnlyHint on ${tool.name}`);
      assert.equal(tool.annotations?.destructiveHint, false);
      assert.equal(tool.annotations?.openWorldHint, false);
      assert.equal(tool.inputSchema.additionalProperties, false);
      for (const [k, prop] of Object.entries(tool.inputSchema.properties || {})) {
        assert.ok(prop.description && prop.description.length > 15, `missing param description on ${tool.name}.${k}`);
      }
    }
    const stats = handleMcpRequest(emptyDir, {jsonrpc: '2.0', id: 3, method: 'tools/call', params: {name: 'okf_vault_stats', arguments: {}}});
    assert.equal(JSON.parse(stats.result.content[0].text).totalNotes, 0);
  } finally {
    fs.rmSync(emptyDir, {recursive: true, force: true});
  }
});
