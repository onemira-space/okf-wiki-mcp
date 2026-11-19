import fs from 'node:fs';
import path from 'node:path';

export function parseFrontmatter(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return {frontmatter: {}, body: text};
  const endIdx = text.indexOf('\n---\n', 4);
  if (endIdx === -1) return {frontmatter: {}, body: text};
  const yamlBlock = text.slice(4, endIdx);
  const body = text.slice(endIdx + 5);
  const frontmatter = {};
  let currentListKey = null;

  for (const line of yamlBlock.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentListKey) {
      frontmatter[currentListKey].push(stripQuotes(listMatch[1].trim()));
      continue;
    }
    const kvMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kvMatch) {
      currentListKey = null;
      continue;
    }
    const [, key, rawVal] = kvMatch;
    const val = rawVal.trim();
    if (!val) {
      frontmatter[key] = [];
      currentListKey = key;
    } else if (val.startsWith('[') && val.endsWith(']')) {
      frontmatter[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
      currentListKey = null;
    } else {
      frontmatter[key] = stripQuotes(val);
      currentListKey = null;
    }
  }
  return {frontmatter, body};
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.startsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function extractWikiLinks(text) {
  const links = new Set();
  const re = /\[\[([^[\]|#]+)(?:#[^[\]|]*)?(?:\|[^[\]]*)?\]\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const target = m[1].trim();
    if (target) links.add(target);
  }
  return [...links];
}

export function extractActionItems(body, relPath) {
  const items = [];
  body.split('\n').forEach((line, idx) => {
    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (!m) return;
    const completed = m[1].toLowerCase() === 'x';
    const text = m[2].trim();
    const ownerMatch = text.match(/@([A-Za-z0-9_.-]+)/) || text.match(/\*\*([A-Za-z0-9 _.-]{2,30})\*\*\s*:/);
    items.push({
      file: relPath,
      line: idx + 1,
      completed,
      owner: ownerMatch ? ownerMatch[1].trim() : null,
      text,
    });
  });
  return items;
}

function walkMarkdownFiles(rootDir, currentDir = rootDir, acc = []) {
  if (!fs.existsSync(currentDir)) return acc;
  for (const entry of fs.readdirSync(currentDir, {withFileTypes: true})) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) walkMarkdownFiles(rootDir, fullPath, acc);
    else if (entry.isFile() && /\.md$/i.test(entry.name)) acc.push(fullPath);
  }
  return acc;
}

function extractInlineSpeakers(body) {
  const found = new Set();
  const re = /^(?:\*\*|\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s+)?([A-Z][A-Za-z0-9 _-]{1,24})(?:\*\*)?:\s+\S/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    const candidate = m[1].trim();
    if (!/^(Note|Summary|Decision|Decisions|Action|Actions|Date|Topic|Agenda)$/i.test(candidate)) {
      found.add(candidate);
    }
  }
  return [...found];
}

export function loadVault(vaultDir) {
  const resolvedRoot = path.resolve(vaultDir);
  const files = walkMarkdownFiles(resolvedRoot).sort();
  const notes = files.map((absPath) => {
    const relPath = path.relative(resolvedRoot, absPath).split(path.sep).join('/');
    const slug = path.basename(relPath, path.extname(relPath));
    const raw = fs.readFileSync(absPath, 'utf8');
    const {frontmatter, body} = parseFrontmatter(raw);
    const h1Match = body.match(/^#\s+(.+)$/m);
    const title = frontmatter.title || (h1Match ? h1Match[1].trim() : slug);
    const date = frontmatter.date || frontmatter.created_at || null;
    const speakers = Array.isArray(frontmatter.speakers)
      ? frontmatter.speakers
      : typeof frontmatter.speakers === 'string' && frontmatter.speakers
        ? [frontmatter.speakers]
        : extractInlineSpeakers(body);
    const tags = Array.isArray(frontmatter.tags)
      ? frontmatter.tags
      : typeof frontmatter.tags === 'string' && frontmatter.tags
        ? [frontmatter.tags]
        : [];
    return {
      relPath,
      slug,
      title,
      date,
      speakers,
      tags,
      wikiLinks: extractWikiLinks(body),
      actions: extractActionItems(body, relPath),
      frontmatter,
      body,
    };
  });
  return {vaultDir: resolvedRoot, notes};
}

function buildSnippet(body, term) {
  const clean = body.replace(/\s+/g, ' ').trim();
  if (!term) return clean.slice(0, 220);
  const pos = clean.toLowerCase().indexOf(term.toLowerCase());
  if (pos === -1) return clean.slice(0, 220);
  const start = Math.max(0, pos - 60);
  return (start > 0 ? '...' : '') + clean.slice(start, start + 220);
}

export function searchMeetings(vault, {query = '', speaker = '', tag = '', fromDate = '', toDate = '', limit = 10} = {}) {
  const terms = String(query).toLowerCase().split(/\s+/).map((t) => t.trim()).filter(Boolean);
  const speakerNeedle = String(speaker || '').toLowerCase().trim();
  const tagNeedle = String(tag || '').toLowerCase().trim();
  const scored = [];

  for (const note of vault.notes) {
    if (speakerNeedle && !note.speakers.some((s) => s.toLowerCase().includes(speakerNeedle))) continue;
    if (tagNeedle && !note.tags.some((t) => t.toLowerCase().includes(tagNeedle))) continue;
    if (fromDate && note.date && String(note.date) < fromDate) continue;
    if (toDate && note.date && String(note.date) > toDate) continue;

    let score = terms.length === 0 ? 1 : 0;
    const titleLower = note.title.toLowerCase();
    const bodyLower = note.body.toLowerCase();
    for (const term of terms) {
      if (titleLower.includes(term)) score += 5;
      if (note.wikiLinks.some((w) => w.toLowerCase().includes(term))) score += 3;
      let idx = 0, hits = 0;
      while ((idx = bodyLower.indexOf(term, idx)) !== -1 && hits < 10) {
        hits++;
        idx += term.length;
      }
      score += hits;
    }
    if (score > 0) {
      scored.push({
        file: note.relPath,
        title: note.title,
        date: note.date,
        speakers: note.speakers,
        tags: note.tags,
        wikiLinks: note.wikiLinks,
        openActionItems: note.actions.filter((a) => !a.completed).length,
        score,
        snippet: buildSnippet(note.body, terms[0]),
      });
    }
  }
  scored.sort((a, b) => b.score - a.score || String(b.date || '').localeCompare(String(a.date || '')));
  return scored.slice(0, Math.max(1, Math.min(50, Number(limit) || 10)));
}

export function listActionItems(vault, {status = 'open', owner = '', limit = 50} = {}) {
  const ownerNeedle = String(owner || '').toLowerCase().trim();
  return vault.notes
    .flatMap((n) => n.actions.map((a) => ({...a, title: n.title, date: n.date})))
    .filter((item) => {
      if (status === 'open' && item.completed) return false;
      if (status === 'completed' && !item.completed) return false;
      if (ownerNeedle && (!item.owner || !item.owner.toLowerCase().includes(ownerNeedle))) return false;
      return true;
    })
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 50)));
}

export function readNote(vault, target) {
  const needle = String(target || '').trim().replace(/^\[\[|\]\]$/g, '');
  const found = vault.notes.find(
    (n) =>
      n.relPath === needle ||
      n.slug.toLowerCase() === needle.toLowerCase() ||
      n.title.toLowerCase() === needle.toLowerCase(),
  );
  if (!found) return null;
  const backlinks = vault.notes
    .filter(
      (other) =>
        other.relPath !== found.relPath &&
        other.wikiLinks.some(
          (w) => w.toLowerCase() === found.slug.toLowerCase() || w.toLowerCase() === found.title.toLowerCase(),
        ),
    )
    .map((other) => ({file: other.relPath, title: other.title, date: other.date}));
  return {
    file: found.relPath,
    title: found.title,
    date: found.date,
    speakers: found.speakers,
    tags: found.tags,
    frontmatter: found.frontmatter,
    wikiLinks: found.wikiLinks,
    backlinks,
    actions: found.actions,
    body: found.body,
  };
}

export function buildTopicGraph(vault) {
  const slugSet = new Set(vault.notes.map((n) => n.slug.toLowerCase()));
  const titleSet = new Set(vault.notes.map((n) => n.title.toLowerCase()));
  const edges = [], unresolvedLinks = [];
  const topicCounts = new Map();

  for (const note of vault.notes) {
    for (const target of note.wikiLinks) {
      const key = target.toLowerCase();
      topicCounts.set(target, (topicCounts.get(target) || 0) + 1);
      edges.push({from: note.relPath, to: target});
      if (!slugSet.has(key) && !titleSet.has(key)) unresolvedLinks.push({from: note.relPath, target});
    }
  }
  return {
    totalNotes: vault.notes.length,
    totalEdges: edges.length,
    topTopics: [...topicCounts.entries()].map(([topic, references]) => ({topic, references})).sort((a, b) => b.references - a.references),
    unresolvedLinks,
    edges,
  };
}

export function computeVaultStats(vault) {
  const graph = buildTopicGraph(vault);
  const allActions = vault.notes.flatMap((n) => n.actions);
  return {
    vaultDir: vault.vaultDir,
    totalNotes: vault.notes.length,
    notesWithFrontmatter: vault.notes.filter((n) => Object.keys(n.frontmatter).length > 0).length,
    uniqueSpeakers: [...new Set(vault.notes.flatMap((n) => n.speakers))],
    totalWikiLinks: graph.totalEdges,
    unresolvedWikiLinks: graph.unresolvedLinks.length,
    openActionItems: allActions.filter((a) => !a.completed).length,
    completedActionItems: allActions.filter((a) => a.completed).length,
  };
}

export const MCP_TOOLS = [
  {
    name: 'okf_search_meetings',
    title: 'Search Local Meeting Notes & Transcripts',
    description:
      'Search across all local Google OKF v0.2 and Obsidian Markdown meeting transcripts and notes by keyword, speaker name, tag, or ISO date range. ' +
      'Use this first for cross-vault discovery when you do not yet know the exact note path or title; prefer okf_read_note once you have a specific file path, slug, or [[wiki-link]], and prefer okf_list_action_items for task checklists. ' +
      'Read-only and 100% offline (zero network calls, no file modifications). Returns a relevance-ranked JSON array of matching notes with snippets and open action counts, or an empty array [] if no notes match.',
    annotations: {
      title: 'Search Local Meeting Notes & Transcripts',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          description:
            'Space-separated search keywords matched case-insensitively against note titles, [[wiki-links]], and body text (e.g. "Q4 roadmap pricing"). Leave empty to filter solely by speaker, tag, or date range.',
          default: '',
        },
        speaker: {
          type: 'string',
          description:
            'Case-insensitive substring filter matching YAML frontmatter speakers or inline transcript speaker labels (e.g. "Alice").',
          default: '',
        },
        tag: {
          type: 'string',
          description:
            'Case-insensitive substring filter matching YAML frontmatter tags (e.g. "local-ai" or "roadmap").',
          default: '',
        },
        fromDate: {
          type: 'string',
          description:
            'Inclusive lower-bound ISO-8601 date filter (YYYY-MM-DD, e.g. "2026-11-01"). Notes without a date field are retained unless excluded by other filters.',
          default: '',
        },
        toDate: {
          type: 'string',
          description:
            'Inclusive upper-bound ISO-8601 date filter (YYYY-MM-DD, e.g. "2026-11-30").',
          default: '',
        },
        limit: {
          type: 'integer',
          description:
            'Maximum number of ranked meeting notes to return (clamped between 1 and 50).',
          default: 10,
          minimum: 1,
          maximum: 50,
        },
      },
    },
  },
  {
    name: 'okf_list_action_items',
    title: 'List Meeting Action Items',
    description:
      'Extract Markdown task checklist items (- [ ] open or - [x] completed) and @owner / bold-owner assignments across all local meeting notes in the vault. ' +
      'Use this for follow-up tracking, standups, and accountability reviews; prefer okf_search_meetings for general topic search or okf_read_note for full meeting context around a task. ' +
      'Read-only and 100% offline. Returns a JSON array of action item objects containing file, line, completed, owner, text, title, and date, or [] when none match.',
    annotations: {
      title: 'List Meeting Action Items',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'completed', 'all'],
          description:
            'Filter checklist items by completion state: "open" for unchecked (- [ ]), "completed" for checked (- [x]), or "all" for both.',
          default: 'open',
        },
        owner: {
          type: 'string',
          description:
            'Case-insensitive substring filter matching the extracted @owner or **Owner**: assignee (e.g. "Alice"). Leave empty to include unassigned and all owners.',
          default: '',
        },
        limit: {
          type: 'integer',
          description:
            'Maximum number of action items to return (clamped between 1 and 200).',
          default: 50,
          minimum: 1,
          maximum: 200,
        },
      },
    },
  },
  {
    name: 'okf_read_note',
    title: 'Read Local OKF Note with Backlinks',
    description:
      'Read the complete Markdown content, parsed YAML frontmatter, outgoing [[wiki-links]], incoming backlinks, and extracted action items for a single known note. ' +
      'Use this after discovering a note via okf_search_meetings, okf_list_action_items, or okf_topic_graph; do not use it for fuzzy keyword search across multiple files. ' +
      'Read-only and 100% offline. Returns a structured JSON note object, or sets isError: true with a "Note not found" message if no file path, slug, or title matches target.',
    annotations: {
      title: 'Read Local OKF Note with Backlinks',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['target'],
      properties: {
        target: {
          type: 'string',
          description:
            'Exact relative file path (e.g. "2026-11-15-architecture-sync.md"), filename slug (e.g. "local-ai-pipeline"), note title, or [[wiki-link]] reference (e.g. "[[Local AI Pipeline]]").',
          minLength: 1,
        },
      },
    },
  },
  {
    name: 'okf_topic_graph',
    title: 'Build Relational Wiki-Link Topic Graph',
    description:
      'Compute the directed [[wiki-link]] knowledge graph across all Markdown notes in the local vault, ranking the most referenced topics and identifying unresolved (dangling) wiki-links. ' +
      'Use this to map recurring entities/projects or audit broken links; prefer okf_vault_stats for high-level aggregate counts or okf_read_note to inspect one topic page. ' +
      'Read-only and 100% offline. Takes no parameters and returns JSON with totalNotes, totalEdges, topTopics, unresolvedLinks, and edges.',
    annotations: {
      title: 'Build Relational Wiki-Link Topic Graph',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'okf_vault_stats',
    title: 'Audit Local Vault Health & Statistics',
    description:
      'Summarize overall vault health and inventory: total Markdown notes, YAML frontmatter coverage, unique speaker list, total and unresolved [[wiki-link]] counts, and open vs completed action-item totals. ' +
      'Use this first to orient on a vault before running targeted okf_search_meetings or okf_list_action_items queries. ' +
      'Read-only and 100% offline. Takes no parameters and returns a single JSON summary object (zeros when the vault directory is empty).',
    annotations: {
      title: 'Audit Local Vault Health & Statistics',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
];

export function handleMcpRequest(vaultDir, msg) {
  if (!msg || typeof msg !== 'object') return null;
  const {id, method, params = {}} = msg;
  if (id === undefined || id === null) return null;

  try {
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: params?.protocolVersion || '2024-11-05',
          capabilities: {tools: {}, resources: {}},
          serverInfo: {name: 'okf-wiki-mcp', version: '1.0.3'},
        },
      };
    }
    if (method === 'ping') return {jsonrpc: '2.0', id, result: {}};
    if (method === 'tools/list') return {jsonrpc: '2.0', id, result: {tools: MCP_TOOLS}};
    if (method === 'resources/list') {
      const vault = loadVault(vaultDir);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resources: vault.notes.map((n) => ({
            uri: `okf://note/${encodeURI(n.relPath)}`,
            name: n.title,
            description: `${n.relPath}${n.date ? ` (${n.date})` : ''}`,
            mimeType: 'text/markdown',
          })),
        },
      };
    }
    if (method === 'resources/read') {
      const uri = String(params?.uri || '');
      const rel = decodeURI(uri.replace(/^okf:\/\/note\//, ''));
      const vault = loadVault(vaultDir);
      const note = readNote(vault, rel);
      if (!note) return {jsonrpc: '2.0', id, error: {code: -32602, message: `Note not found: ${uri}`}};
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [{uri, mimeType: 'text/markdown', text: fs.readFileSync(path.join(vault.vaultDir, note.file), 'utf8')}],
        },
      };
    }
    if (method === 'tools/call') {
      const vault = loadVault(vaultDir);
      const name = params?.name;
      const args = params?.arguments || {};
      let payload;
      if (name === 'okf_search_meetings') payload = searchMeetings(vault, args);
      else if (name === 'okf_list_action_items') payload = listActionItems(vault, args);
      else if (name === 'okf_read_note') {
        payload = readNote(vault, args.target);
        if (!payload) {
          return {jsonrpc: '2.0', id, result: {isError: true, content: [{type: 'text', text: `Note not found: ${args.target}`}]}};
        }
      } else if (name === 'okf_topic_graph') payload = buildTopicGraph(vault);
      else if (name === 'okf_vault_stats') payload = computeVaultStats(vault);
      else return {jsonrpc: '2.0', id, error: {code: -32601, message: `Unknown tool: ${name}`}};
      return {jsonrpc: '2.0', id, result: {content: [{type: 'text', text: JSON.stringify(payload, null, 2)}]}};
    }
    return {jsonrpc: '2.0', id, error: {code: -32601, message: `Method not found: ${method}`}};
  } catch (err) {
    return {jsonrpc: '2.0', id, error: {code: -32603, message: err instanceof Error ? err.message : String(err)}};
  }
}

export function startStdioMcpServer(vaultDir, input = process.stdin, output = process.stdout) {
  let buffer = Buffer.alloc(0);
  let useContentLength = false;
  function send(resp) {
    if (!resp) return;
    const json = JSON.stringify(resp);
    if (useContentLength) output.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`);
    else output.write(`${json}\n`);
  }
  input.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    while (buffer.length > 0) {
      if (/^Content-Length:/i.test(buffer.slice(0, 32).toString('utf8'))) {
        useContentLength = true;
        const sepIdx = buffer.indexOf('\r\n\r\n');
        if (sepIdx === -1) break;
        const m = buffer.slice(0, sepIdx).toString('utf8').match(/Content-Length:\s*(\d+)/i);
        if (!m) {
          buffer = buffer.slice(sepIdx + 4);
          continue;
        }
        const len = Number(m[1]);
        const bodyStart = sepIdx + 4;
        if (buffer.length < bodyStart + len) break;
        const jsonStr = buffer.slice(bodyStart, bodyStart + len).toString('utf8');
        buffer = buffer.slice(bodyStart + len);
        try { send(handleMcpRequest(vaultDir, JSON.parse(jsonStr))); } catch {}
      } else {
        const nlIdx = buffer.indexOf('\n');
        if (nlIdx === -1) break;
        const line = buffer.slice(0, nlIdx).toString('utf8').trim();
        buffer = buffer.slice(nlIdx + 1);
        if (!line) continue;
        try { send(handleMcpRequest(vaultDir, JSON.parse(line))); } catch {}
      }
    }
  });
}
