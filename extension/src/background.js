// The extension never reads or touches web pages: it has no host permissions and
// no content scripts. It only opens its own analysis board, either from the
// toolbar button or with text the user highlighted and chose to analyse.
import { looksLikeFen } from './chess-utils.js';

// Sites where people play rated games or solve rated puzzles. Text from these is
// not sent to the engine, so the extension cannot help during a live game.
const PLAY_SITES = [
  'chess.com', 'lichess.org', 'chess24.com', 'chesstempo.com', 'chesskid.com',
  'worldchess.com', 'playchess.com', 'chessclub.com', 'freechess.org',
  'playstrategy.org', 'gameknot.com', 'chessarena.com', 'sparkchess.com',
];

const boardUrl = (query = '') => chrome.runtime.getURL(`analysis.html${query}`);

export function isPlaySite(pageUrl) {
  let host;
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    return false;
  }
  return PLAY_SITES.some((site) => host === site || host.endsWith(`.${site}`));
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'analyse-selection',
    title: 'Analyse with Stockfish',
    contexts: ['selection'],
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: boardUrl() });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'analyse-selection') return;
  if (isPlaySite(info.pageUrl)) {
    chrome.tabs.create({ url: boardUrl('?notice=play-site') });
    return;
  }
  const text = (info.selectionText || '').trim();
  const param = looksLikeFen(text) ? 'fen' : 'pgn';
  chrome.tabs.create({ url: boardUrl(`?${param}=${encodeURIComponent(text)}`) });
});
