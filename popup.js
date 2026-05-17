// popup.js
import {
  sendLinkToJournal,
  createPageAndLink,
  getSettings
} from './lib/logseq.js';

const $ = (id) => document.getElementById(id);

async function init() {
  // Hide the main UI and show the "configure first" prompt if there's no token.
  const { token } = await getSettings();
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

  $('create-page').addEventListener('click', () => {
    const note = $('note').value;
    run('Creating page', () => createPageAndLink(title, url, note));
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
