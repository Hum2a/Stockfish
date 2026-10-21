import { TrackedGame } from './tracked-game.js';

const $ = (id) => document.getElementById(id);
const requests = new Map();
window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'stockfish-tracker-response') return;
  const request = requests.get(event.data.id);
  if (request) { requests.delete(event.data.id); clearTimeout(request.timer); request.resolve(event.data.response); }
});

async function request(type, session) {
  if (location.protocol === 'chrome-extension:' && globalThis.chrome?.runtime?.sendMessage) {
    return chrome.runtime.sendMessage({ type, session });
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { requests.delete(id); reject(new Error('Extension unavailable. Install or reload it, then reopen tracking from the source tab.')); }, 4000);
    requests.set(id, { resolve, timer });
    window.postMessage({ channel: 'stockfish-tracker-request', id, type, session }, location.origin);
  });
}

export function setupTracker({ apply, setFollowing, onDisconnected }) {
  let session = new URLSearchParams(location.hash.slice(1)).get('follow');
  if (!/^[a-f0-9-]{36}$/.test(session || '')) session = null;
  let sourceGame;
  const storageKey = `stockfish-tracker:${session}`;
  try { sourceGame = new TrackedGame(JSON.parse(sessionStorage.getItem(storageKey))); }
  catch { sourceGame = new TrackedGame(); }
  let following = true;
  let lastStable = null;
  let candidate = null;
  let seen = '';
  let synced = false;
  let timer;
  let reset = false;
  const status = (message, kind = '') => { $('tracking-status').textContent = message; document.querySelector('.tracking-panel').dataset.state = kind; };
  const setFollow = (value) => {
    following = value;
    if (value && !synced) onDisconnected();
    else setFollowing(value);
    $('tracking-follow').textContent = value ? 'Following' : 'Return to source';
    $('tracking-follow').setAttribute('aria-pressed', String(value));
  };
  const applySource = () => {
    if (!sourceGame.startFen || !lastStable) return;
    apply({ ...sourceGame.result(true), orientation: $('tracking-mirror').checked ? lastStable.orientation : null });
  };
  $('tracking-help').onclick = () => { $('tracking-guide').hidden = !$('tracking-guide').hidden; $('tracking-help').setAttribute('aria-expanded', String(!$('tracking-guide').hidden)); };
  $('tracking-follow').onclick = () => { setFollow(!following); if (following && synced) applySource(); };
  $('tracking-mirror').onchange = () => { if (following && synced) applySource(); };
  $('tracking-resync').onclick = () => { reset = true; seen = ''; };
  $('tracking-stop').onclick = async () => {
    const current = session;
    if (!current) return;
    // Keep Stop retryable if the extension could not confirm revocation.
    try {
      const result = await request('tracker-stop', current);
      if (result.error) throw new Error(result.error);
      session = null; clearTimeout(timer); setFollow(false);
      try { sessionStorage.removeItem(storageKey); } catch { /* Session storage can be disabled. */ }
      $('tracking-stop').hidden = $('tracking-follow').hidden = $('tracking-setup').hidden = true;
      $('tracking-help').hidden = false;
      history.replaceState(null, '', location.pathname + location.search);
      status('Tracking stopped. Your captured game is ready to explore.');
    } catch (err) { status(err.message, 'error'); }
  };
  async function poll() {
    const current = session;
    if (!current) return;
    try {
      const snapshot = await request('tracker-read', current);
      if (session !== current) return;
      if (!snapshot) throw new Error('Extension did not respond. Reload it and start tracking again.');
      if (snapshot.error) throw new Error(snapshot.error);
      if (snapshot.transient) { candidate = null; synced = false; if (following) onDisconnected(); status('Waiting for the source board to settle…', 'waiting'); return; }
      const fingerprint = JSON.stringify([snapshot.placement, snapshot.fen, snapshot.orientation]);
      // Require two consecutive snapshots to avoid captures/animations halfway
      // through a move. Never continuously install observers into source pages.
      if (fingerprint !== candidate) { candidate = fingerprint; synced = false; if (following) onDisconnected(); status('Reading source board…', 'waiting'); return; }
      lastStable = snapshot;
      if (fingerprint !== seen || reset || !synced) {
        sourceGame.update(snapshot, { turn: $('tracking-turn').value, castling: $('tracking-castling').value, reset });
        try { sessionStorage.setItem(storageKey, JSON.stringify(sourceGame.serialize())); } catch { /* Continue without persistence. */ }
        reset = false; seen = fingerprint; synced = true; setFollowing(following);
        if (following) applySource();
      }
      status(`${following ? 'Following' : 'Exploring locally · source still tracked'} ${snapshot.host} · ${snapshot.adapter}`, following ? 'live' : 'paused');
    } catch (err) {
      if (session !== current) return;
      synced = false; if (following) onDisconnected();
      status(err.message, 'error');
      $('tracking-setup').open = true;
    } finally {
      if (session === current) timer = setTimeout(poll, 800);
    }
  }
  if (session) {
    $('tracking-stop').hidden = $('tracking-follow').hidden = $('tracking-setup').hidden = false;
    $('tracking-help').hidden = true;
    status('Connecting to your selected tab…', 'waiting');
    poll();
  }
  return {
    explore() { if (session && following) { setFollow(false); status('Exploring locally. Click Return to source to resume following.', 'paused'); } },
  };
}
