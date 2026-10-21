// A narrowly scoped bridge only on our studio origins. Never accepts arbitrary
// tab IDs, script code, URLs, or extension commands from the website.
window.addEventListener('message', async (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const msg = event.data;
  if (msg?.channel !== 'stockfish-tracker-request' || typeof msg.id !== 'string' || msg.id.length > 80) return;
  if (!['tracker-read', 'tracker-stop', 'tracker-ping'].includes(msg.type)) return;
  if (msg.type !== 'tracker-ping' && (typeof msg.session !== 'string' || !/^[a-f0-9-]{36}$/.test(msg.session))) return;
  let response;
  try { response = await chrome.runtime.sendMessage({ type: msg.type, session: msg.session }); }
  catch { response = { error: 'Extension disconnected. Reload the studio after reloading the extension.' }; }
  window.postMessage({ channel: 'stockfish-tracker-response', id: msg.id, response }, location.origin);
});
