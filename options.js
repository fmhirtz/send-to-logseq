// options.js
import { getSettings, testConnection, formatDate } from './lib/logseq.js';

const $ = (id) => document.getElementById(id);

async function load() {
  const s = await getSettings();
  $('host').value = s.host || '';
  $('token').value = s.token || '';
  $('dateFormatOverride').value = s.dateFormatOverride || '';
}

function setStatus(text, kind) {
  const el = $('status');
  el.textContent = text;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

async function save() {
  const host = $('host').value.trim() || 'http://127.0.0.1:12315';
  const token = $('token').value.trim();
  const dateFormatOverride = $('dateFormatOverride').value.trim();

  await browser.storage.local.set({ host, token, dateFormatOverride });

  let msg = 'Saved.';
  if (dateFormatOverride) {
    try {
      const sample = formatDate(new Date(), dateFormatOverride);
      msg += ` Today would be: "${sample}"`;
    } catch (e) {
      msg += ' (warning: date format failed to render)';
    }
  }
  setStatus(msg, 'ok');
}

async function test() {
  setStatus('Testing…');
  try {
    const graph = await testConnection();
    setStatus(`Connected to graph "${graph.name}".`, 'ok');
  } catch (e) {
    setStatus(e.message || String(e), 'err');
  }
}

$('save').addEventListener('click', save);
$('test').addEventListener('click', test);

load();
