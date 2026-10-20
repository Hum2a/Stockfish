import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal stand-in for the extension APIs so the service worker can be imported.
const listeners = {};
const opened = [];
globalThis.chrome = {
  runtime: { onInstalled: { addListener: (f) => { listeners.installed = f; } }, getURL: (p) => `chrome-extension://id/${p}` },
  action: { onClicked: { addListener: (f) => { listeners.action = f; } } },
  contextMenus: { create: () => {}, onClicked: { addListener: (f) => { listeners.menu = f; } } },
  tabs: { create: ({ url }) => opened.push(url) },
};
const { isPlaySite } = await import('../dist/background.js');

test('play sites are recognised, including subdomains', () => {
  assert.ok(isPlaySite('https://www.chess.com/game/live/123'));
  assert.ok(isPlaySite('https://lichess.org/abcd1234'));
  assert.ok(!isPlaySite('https://en.wikipedia.org/wiki/Forsyth–Edwards_Notation'));
  assert.ok(!isPlaySite('https://notchess.com.example.org/'));
  assert.ok(!isPlaySite('not a url'));
});

test('selected text opens the board, except on play sites', () => {
  opened.length = 0;
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  listeners.menu({ menuItemId: 'analyse-selection', pageUrl: 'https://example.org/article', selectionText: fen });
  listeners.menu({ menuItemId: 'analyse-selection', pageUrl: 'https://example.org/article', selectionText: '1. e4 e5 2. Nf3' });
  listeners.menu({ menuItemId: 'analyse-selection', pageUrl: 'https://www.chess.com/play/online', selectionText: fen });
  assert.equal(opened[0], `chrome-extension://id/analysis.html?fen=${encodeURIComponent(fen)}`);
  assert.equal(opened[1], `chrome-extension://id/analysis.html?pgn=${encodeURIComponent('1. e4 e5 2. Nf3')}`);
  assert.equal(opened[2], 'chrome-extension://id/analysis.html?notice=play-site');
});
