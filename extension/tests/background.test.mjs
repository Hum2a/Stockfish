import { test } from 'node:test';
import assert from 'node:assert/strict';

const listeners = {};
const opened = [];
const stored = {};
let reads = 0;
globalThis.chrome = {
  runtime: {
    id: 'id', getManifest: () => ({ version: '1.1.0' }),
    onInstalled: { addListener: (f) => { listeners.installed = f; } },
    onMessage: { addListener: (f) => { listeners.message = f; } },
    getURL: (p) => `chrome-extension://id/${p}`,
  },
  contextMenus: { create: () => {}, onClicked: { addListener: (f) => { listeners.menu = f; } } },
  tabs: {
    create: async ({ url }) => { opened.push(url); return { id: 99 }; },
    onRemoved: { addListener: (f) => { listeners.removed = f; } },
  },
  scripting: { executeScript: async ({ target, args }) => {
    reads++;
    if (target.tabId === 42) {
      return [
        { result: { error: 'No supported board found.', boardCount: 0 } },
        { result: { boardCount: 1, host: 'www.chess.com', placement: '4k3/8/8/8/8/8/8/4K3', allFrames: target.allFrames, source: target.tabId, index: args[0] } },
      ];
    }
    return [{ result: { boardCount: 2, host: 'www.chess.com', source: target.tabId, index: args[0] } }];
  } },
  storage: { session: {
    get: async (key) => key === null ? { ...stored } : { [key]: stored[key] },
    set: async (values) => { Object.assign(stored, values); },
    remove: async (keys) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key]; },
  } },
};
const { handleTrackerMessage, inspectBoard } = await import('../dist/background.js');
const popup = { id: 'id', url: 'chrome-extension://id/popup.html' };

test('selected FEN and PGN text open the board, including the requested chess sites', () => {
  opened.length = 0;
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  listeners.menu({ menuItemId: 'analyse-selection', pageUrl: 'https://www.chess.com/analysis', selectionText: fen });
  listeners.menu({ menuItemId: 'analyse-selection', pageUrl: 'https://example.org/article', selectionText: '1. e4 e5 2. Nf3' });
  assert.equal(opened[0], `chrome-extension://id/analysis.html?fen=${encodeURIComponent(fen)}`);
  assert.equal(opened[1], `chrome-extension://id/analysis.html?pgn=${encodeURIComponent('1. e4 e5 2. Nf3')}`);
});
test('only the popup can choose a source; invalid source IDs never execute scripts', async () => {
  const before = reads;
  await assert.rejects(handleTrackerMessage({ type: 'tracker-start', tabId: 7 }, { id: 'id', tab: { id: 20 }, url: 'https://stockfish.humza.website/' }), /toolbar/);
  await assert.rejects(inspectBoard('7'), /Invalid/);
  await assert.rejects(inspectBoard(7, -1), /Invalid/);
  assert.equal(reads, before);
});
test('website sessions bind to their viewer; Stop revokes access immediately', async () => {
  await handleTrackerMessage({ type: 'tracker-start', tabId: 7, boardIndex: 1, destination: 'website' }, popup);
  const url = new URL(opened.at(-1));
  assert.equal(url.origin, 'https://stockfish.humza.website');
  const session = new URLSearchParams(url.hash.slice(1)).get('follow');
  const message = { type: 'tracker-read', session };
  await assert.rejects(handleTrackerMessage(message, { tab: { id: 100 } }), /ended/);
  const result = await handleTrackerMessage(message, { tab: { id: 99 } });
  assert.equal(result.source, 7); assert.equal(result.index, 1);
  await handleTrackerMessage({ type: 'tracker-stop', session }, { tab: { id: 99 } });
  await assert.rejects(handleTrackerMessage(message, { tab: { id: 99 } }), /ended/);
});
test('board reads search nested frames, not only the top page', async () => {
  const result = await inspectBoard(42, 0);
  assert.equal(result.allFrames, true);
  assert.equal(result.placement, '4k3/8/8/8/8/8/8/4K3');
});
test('extension pages can follow without sender.tab and sessions are stored outside worker memory', async () => {
  await handleTrackerMessage({ type: 'tracker-start', tabId: 8, boardIndex: 0 }, popup);
  const session = new URLSearchParams(new URL(opened.at(-1)).hash.slice(1)).get('follow');
  const result = await handleTrackerMessage({ type: 'tracker-read', session }, { id: 'id', url: opened.at(-1) });
  assert.equal(result.source, 8);
  assert.ok(stored[`tracker:${session}`]);
  await listeners.removed(8);
  assert.equal(stored[`tracker:${session}`], undefined);
});
