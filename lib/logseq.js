// lib/logseq.js
// Minimal client for the Logseq local HTTP API.
// All methods POST {method, args} to /api with a bearer token.

const DEFAULT_HOST = 'http://127.0.0.1:12315';

export async function getSettings() {
  const s = await browser.storage.local.get([
    'token',
    'host',
    'dateFormatOverride',
    'lastTitleSuffix'
  ]);
  return {
    token: s.token || '',
    host: s.host || DEFAULT_HOST,
    dateFormatOverride: s.dateFormatOverride || '',
    lastTitleSuffix: s.lastTitleSuffix || ''
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
// titleSuffix (optional): string appended to the page title with a space
// separator before the page is created. Trimmed; empty/whitespace is ignored.
export async function createPageAndLink(title, url, note, titleSuffix) {
  const baseTitle = title || 'Untitled';
  const suffix = (titleSuffix || '').trim();
  const combinedTitle = suffix ? `${baseTitle} ${suffix}` : baseTitle;
  const pageName = sanitizePageName(combinedTitle);
  const journalName = await getTodaysJournalName();

  const existing = await logseqCall('logseq.Editor.getPage', [pageName]);
  const pageExists = !!(existing && (existing.uuid || existing.id || existing.name));

  if (!pageExists) {
    await logseqCall('logseq.Editor.createPage', [
      pageName,
      {},
      { createFirstBlock: false, redirect: false }
    ]);

    const propsBlock =
      `source:: ${url}\n` +
      `date:: [[${journalName}]]\n` +
      `tags:: `;
    await logseqCall('logseq.Editor.appendBlockInPage', [pageName, propsBlock]);
  }

  await logseqCall('logseq.Editor.appendBlockInPage', [pageName, url]);
  if (note && note.trim()) {
    await logseqCall('logseq.Editor.appendBlockInPage', [pageName, note.trim()]);
  }

  await logseqCall('logseq.Editor.appendBlockInPage', [journalName, `[[${pageName}]]`]);

  return pageName;
}

export async function testConnection() {
  const graph = await logseqCall('logseq.App.getCurrentGraph');
  if (!graph || !graph.name) {
    throw new Error('Connected, but no current graph reported. Is a graph open in Logseq?');
  }
  return graph;
}
