import { looksLikeFen } from './chess-utils.js';
import { inspectBoard } from './inspect.js';

export { inspectBoard };

const boardUrl = (query = '') => chrome.runtime.getURL(`analysis.html${query}`);

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'analyse-selection',
    title: 'Analyse with Stockfish',
    contexts: ['selection'],
  });
});


chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'analyse-selection') return;
  const text = (info.selectionText || '').trim();
  const param = looksLikeFen(text) ? 'fen' : 'pgn';
  chrome.tabs.create({ url: boardUrl(`?${param}=${encodeURIComponent(text)}`) });
});

const sessionKey = (session) => `tracker:${session}`;
const validSession = (session) => typeof session === 'string' && /^[a-f0-9-]{36}$/.test(session);
const popupSender = (sender) => sender.id === chrome.runtime.id && (sender.url || '').split(/[?#]/)[0] === chrome.runtime.getURL('popup.html');

export async function handleTrackerMessage(message, sender) {
  if (message.type === 'tracker-ping') return { available: true, version: chrome.runtime.getManifest().version };
  if (['tracker-inspect', 'tracker-start'].includes(message.type)) {
    if (!popupSender(sender)) throw new Error('Choose the source tab using the extension toolbar button.');
    if (message.type === 'tracker-inspect') return inspectBoard(message.tabId);
    const snapshot = await inspectBoard(message.tabId, message.boardIndex);
    if (!snapshot.boardCount) throw new Error(snapshot.error || 'No chessboard found.');
    const session = crypto.randomUUID();
    const key = sessionKey(session);
    const saved = { sourceTabId: message.tabId, boardIndex: message.boardIndex, viewerTabId: null };
    await chrome.storage.session.set({ [key]: saved });
    try {
      const target = message.destination === 'website' ? 'https://stockfish.humza.website/' : boardUrl();
      const viewer = await chrome.tabs.create({ url: `${target}#follow=${session}` });
      await chrome.storage.session.set({ [key]: { ...saved, viewerTabId: viewer.id } });
    } catch (err) { await chrome.storage.session.remove(key); throw err; }
    return { ok: true };
  }
  if (!validSession(message.session)) throw new Error('Tracking session not found. Start again from the source tab.');
  const key = sessionKey(message.session);
  const saved = (await chrome.storage.session.get(key))[key];
  if (!saved && message.type === 'tracker-stop') return { ok: true };
  const extensionViewer = sender.id === chrome.runtime.id && sender.url?.split(/[?#]/)[0] === boardUrl();
  if (!saved || (!extensionViewer && sender.tab?.id !== saved.viewerTabId)) throw new Error('Tracking ended. Start again from the source tab.');
  if (message.type === 'tracker-stop') {
    await chrome.storage.session.remove(key);
    return { ok: true };
  }
  if (message.type !== 'tracker-read') throw new Error('Unknown tracking request.');
  try { return await inspectBoard(saved.sourceTabId, saved.boardIndex); }
  catch { throw new Error('Source tab closed or access expired. Click the extension on that tab to reconnect.'); }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message || !['tracker-ping', 'tracker-inspect', 'tracker-start', 'tracker-read', 'tracker-stop'].includes(message.type)) return false;
  handleTrackerMessage(message, sender).then(respond, (err) => respond({ error: err.message || 'Could not read this board.' }));
  return true;
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const sessions = await chrome.storage.session.get(null);
  const keys = Object.entries(sessions).filter(([key, saved]) => key.startsWith('tracker:') && (saved.viewerTabId === tabId || saved.sourceTabId === tabId)).map(([key]) => key);
  if (keys.length) await chrome.storage.session.remove(keys);
});
