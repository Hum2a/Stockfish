import { readBoard } from './board-reader.js';

export function accessError(err, tab) {
  const msg = String(err?.message || err || '');
  const url = tab?.url || '';
  if (/^(chrome|edge|brave|about|chrome-extension):/i.test(url) || /Cannot access a chrome/i.test(msg)) {
    return 'This is a browser page, not a chessboard. Open Chess.com analysis or a game, then click the extension on that tab.';
  }
  if (/Cannot access contents|permission to access this host/i.test(msg)) {
    return 'Chrome blocked reading this tab. Click the extension icon while the chessboard tab is focused.';
  }
  return msg || 'Could not read this board.';
}

export async function activeChessTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error('Could not find the current tab. Click the extension on a chessboard tab.');
  if (/^(chrome|edge|brave|about|chrome-extension):/i.test(tab.url || '')) {
    throw new Error('Open a Chess.com analysis, replay, or game tab, then click the extension on that tab — not on this browser page.');
  }
  return tab;
}

export async function inspectBoard(tabId, boardIndex = 0) {
  if (!Number.isInteger(tabId) || !Number.isInteger(boardIndex) || boardIndex < 0 || boardIndex > 15) throw new Error('Invalid board selection.');
  let results;
  try {
    results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: readBoard, args: [boardIndex] });
  } catch (err) {
    throw new Error(accessError(err));
  }
  const snapshots = (results || []).map((entry) => entry.result).filter(Boolean);
  return snapshots.find((s) => s.placement || s.fen || s.transient)
    || snapshots.find((s) => s.boardCount > 0)
    || snapshots[0]
    || { error: 'This page cannot be read. Open a supported chessboard and try again.', boardCount: 0 };
}

export async function requestTabAccess(tab) {
  const url = tab?.url || '';
  if (!/^https?:/i.test(url)) return;
  try {
    await chrome.permissions.request({ origins: [`${new URL(url).origin}/*`] });
  } catch {
    // activeTab from clicking the toolbar still covers this visit
  }
}
