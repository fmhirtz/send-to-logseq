// lib/logseq.js
// Minimal client for the Logseq local HTTP API.
// All methods POST {method, args} to /api with a bearer token.

const DEFAULT_HOST = 'http://127.0.0.1:12315';

export async function getSettings() {
  const s = await browser.storage.local.get(['token', 'host', 'dateFormatOverride']);
  return {
    token: s.token || '',
    host: s.host || DEFAULT_HOST,
    dateFormatOverride: s.dateFormatOverride || ''
  };
}

export async function logseqCall(method, args = []) {
  const { token, host } = await getSettings();
  if (!token) {
    const err = new Error('No Logseq token configured. Open the extension options to set one.');
    err.code = 'NO_TOKEN';
    throw err;
  }

  let res;
  try {
    res = await fetch(`${host}/api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ method, args })
    });
  } catch (e) {
    // Network-level failure: Logseq not running, wrong host, HTTP server off.
    const err = new Error(`Could not reach Logseq at ${host}. Is the desktop app running with the HTTP API server enabled?`);
    err.code = 'UNREACHABLE';
    err.cause = e;
    throw err;
  }

  if (res.status === 401) {
    const err = new Error('Logseq rejected the token (401). Re-authorize a token in Logseq and update the options.');
    err.code = 'BAD_TOKEN';
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Logseq API ${res.status}: ${body || res.statusText}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Convenience: fetch the user's preferred date format and format today accordingly.
// If the user supplied an override in options, use that instead.
export async function getTodaysJournalName() {
  const { dateFormatOverride } = await getSettings();
  let fmt = dateFormatOverride;
  if (!fmt) {
    const cfg = await logseqCall('logseq.App.getUserConfigs');
    fmt = (cfg && cfg.preferredDateFormat) || 'MMM do, yyyy';
  }
  return formatDate(new Date(), fmt);
}

// date-fns-style formatter covering the tokens Logseq actually uses.
// Supported: yyyy yy MMMM MMM MM M do dd d EEEE EEE
// Tokens are matched longest-first to avoid 'M' eating the 'M' inside 'MMMM'.
export function formatDate(d, fmt) {
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const ord = n => {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const M = d.getMonth();
  const D = d.getDate();
  const Y = d.getFullYear();
  const W = d.getDay();
  const pad = (n, l = 2) => String(n).padStart(l, '0');

  // Tokenize: walk the string and replace known tokens, leaving everything else intact.
  const tokens = [
    ['yyyy', () => String(Y)],
    ['yy',   () => String(Y).slice(-2)],
    ['MMMM', () => months[M]],
    ['MMM',  () => months[M].slice(0, 3)],
    ['MM',   () => pad(M + 1)],
    ['M',    () => String(M + 1)],
    ['EEEE', () => days[W]],
    ['EEE',  () => days[W].slice(0, 3)],
    ['do',   () => ord(D)],
    ['dd',   () => pad(D)],
    ['d',    () => String(D)]
  ];

  let out = '';
  let i = 0;
  while (i < fmt.length) {
    let matched = false;
    for (const [tok, fn] of tokens) {
      if (fmt.startsWith(tok, i)) {
        out += fn();
        i += tok.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += fmt[i];
      i++;
    }
  }
  return out;
}

// Page names containing '/' become hierarchies in Logseq. Replace with '-'.
// Also collapse whitespace and trim to a reasonable length.
export function sanitizePageName(title) {
  return (title || 'Untitled')
    .replace(/[\/\\]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'Untitled';
}

// High-level flow 1: append a link block to today's journal page.
export async function sendLinkToJournal(title, url) {
  const journal = await getTodaysJournalName();
  const safeTitle = (title || url).replace(/\]/g, '\\]');
  const content = `[${safeTitle}](${url})`;
  return logseqCall('logseq.Editor.appendBlockInPage', [journal, content]);
}

// High-level flow 2: create (or reuse) a page named after the title,
// populate it, and link it from today's journal.
//
// On a freshly created page we add a properties block:
//     source:: <url>
//     date:: [[<today, in Logseq's preferredDateFormat>]]
//     tags::
// The date links to today's journal page; tags is left empty for the user
// to fill in. If the page already exists, the properties block is NOT
// re-added — we don't want to clobber tags you've already filled in.
export async function createPageAndLink(title, url, note) {
  const pageName = sanitizePageName(title);
  const journalName = await getTodaysJournalName();

  // Check existence first so we can decide whether to write the properties block.
  // getPage returns null (or a falsy object) for pages that don't exist yet.
  const existing = await logseqCall('logseq.Editor.getPage', [pageName]);
  const pageExists = !!(existing && (existing.uuid || existing.id || existing.name));

  if (!pageExists) {
    // Create the page with no first block so we can set up the properties
    // block exactly how we want it (with empty tags::).
    await logseqCall('logseq.Editor.createPage', [
      pageName,
      {},
      { createFirstBlock: false, redirect: false }
    ]);

    // A single block whose content is several `key:: value` lines becomes
    // a page-level properties block in Logseq.
    const propsBlock =
      `source:: ${url}\n` +
      `date:: [[${journalName}]]\n` +
      `tags:: `;
    await logseqCall('logseq.Editor.appendBlockInPage', [pageName, propsBlock]);
  }

  // Always append the URL as a clickable block, and the note if provided.
  await logseqCall('logseq.Editor.appendBlockInPage', [pageName, url]);
  if (note && note.trim()) {
    await logseqCall('logseq.Editor.appendBlockInPage', [pageName, note.trim()]);
  }

  // Link the page from today's journal.
  await logseqCall('logseq.Editor.appendBlockInPage', [journalName, `[[${pageName}]]`]);

  return pageName;
}

// Lightweight ping used by the options page "Test connection" button.
export async function testConnection() {
  // getCurrentGraph returns { name, path, url } when authorized.
  const graph = await logseqCall('logseq.App.getCurrentGraph');
  if (!graph || !graph.name) {
    throw new Error('Connected, but no current graph reported. Is a graph open in Logseq?');
  }
  return graph;
}
