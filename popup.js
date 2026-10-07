// popup.js
import {
  sendLinkToJournal,
  createPageAndLink,
  getSettings,
  sanitizePageName
} from './lib/logseq.js';

const $ = (id) => document.getElementById(id);

async function init() {
  const { token, lastTitleSuffix } = await getSettings();

  if (!token) {
    $('ready').classList.add('hidden');
    $('unconfigured').classList.remove('hidden');
    $('open-options-empty').addEventListener('click', () => {
      browser.runtime.openOptionsPage();
      window.close();
    });
    return;
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const title = tab.title || tab.url || 'Untitled';
  const url = tab.url || '';
  $('page-title').textContent = title;
  $('page-url').textContent = url;

  // Restore last-used suffix so a session of same-themed captures doesn't
  // require retyping. Cleared with one keystroke if not wanted.
  const suffixInput = $('title-suffix');
  suffixInput.value = lastTitleSuffix;

  const preview = $('suffix-preview');
  const updatePreview = () => {
    const suffix = suffixInput.value.trim();
    if (!suffix) {
      preview.textContent = '';
      return;
    }
    const combined = sanitizePageName(`${title} ${suffix}`);
    preview.textContent = `Page: ${combined}`;
  };
  suffixInput.addEventListener('input', updatePreview);

  const status = $('status');
  const setStatus = (text, kind) => {
    status.textContent = text;
    status.className = 'status' + (kind ? ' ' + kind : '');
  };

  const buttons = [$('send-link'), $('create-page')];
  const lock = (locked) => buttons.forEach(b => b.disabled = locked);

  const run = async (label, fn) => {
    lock(true);
    setStatus(`${label}…`);
    try {
      const result = await fn();
      const msg = typeof result === 'string'
        ? `Done. Created "${result}".`
        : 'Done.';
      setStatus(msg, 'ok');
      setTimeout(() => window.close(), 700);
    } catch (e) {
      console.error(e);
      setStatus(e.message || String(e), 'err');
      lock(false);
    }
  };

  $('send-link').addEventListener('click', () => {
    run('Sending', () => sendLinkToJournal(title, url));
  });

  $('create-page').addEventListener('click', async () => {
    const note = $('note').value;
    const suffix = suffixInput.value.trim();

    // Remember the suffix for next time (empty string also persists, which
    // is correct — clearing means "I don't want this anymore").
    await browser.storage.local.set({ lastTitleSuffix: suffix });

    run('Creating page', () => createPageAndLink(title, url, note, suffix));
  });
}

init().catch(e => {
  console.error('popup init failed', e);
  const s = document.getElementById('status');
  if (s) {
    s.textContent = e.message || 'Initialization failed';
    s.className = 'status err';
  }
});
