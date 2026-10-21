import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBoard } from '../src/board-reader.js';

const rect = { left: 0, top: 0, width: 800, height: 800 };
function piece(classes, x = 0, y = 0) {
  return {
    classList: { contains: (name) => classes.split(' ').includes(name) },
    getAttribute: () => classes,
    getBoundingClientRect: () => ({ left: x * 100, top: y * 100, width: 100, height: 100 }),
  };
}
function root(type, pieces, { flipped = false, fen = null } = {}) {
  const result = {
    matches: (selector) => selector.split(', ').includes(type),
    contains: () => false,
    closest: (selector) => selector === '[data-fen]' ? (fen ? result : null) : (flipped ? result : null),
    getAttribute: () => fen,
    getBoundingClientRect: () => rect,
    querySelectorAll: () => pieces,
  };
  return result;
}
function use(roots) {
  globalThis.document = { querySelectorAll: () => roots };
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible' });
  globalThis.location = { hostname: 'www.chess.com' };
}
test('Chess.com square classes are orientation independent; multiple boards can be selected', () => {
  use([root('wc-chess-board', [piece('piece wk square-51'), piece('piece bk square-58')], { flipped: true }), root('wc-chess-board', [piece('piece wk square-41'), piece('piece bk square-48')])]);
  assert.equal(readBoard().placement, '4k3/8/8/8/8/8/8/4K3');
  assert.equal(readBoard().orientation, 'b');
  assert.equal(readBoard(1).placement, '3k4/8/8/8/8/8/8/3K4');
  assert.equal(readBoard(1).boardCount, 2);
});
test('transient duplicate squares and incomplete boards do not emit misleading positions', () => {
  use([root('wc-chess-board', [piece('piece wk square-51'), piece('piece bk square-58'), piece('piece br square-58')])]);
  assert.equal(readBoard().transient, true);
  use([root('wc-chess-board', [piece('piece wk square-51')])]);
  assert.match(readBoard().error, /both kings/);
});
test('Chessground piece geometry handles both board orientations', () => {
  use([root('cg-board', [piece('white king', 4, 7), piece('black king', 4, 0)])]);
  assert.equal(readBoard().placement, '4k3/8/8/8/8/8/8/4K3');
  use([root('cg-board', [piece('white king', 3, 0), piece('black king', 3, 7)], { flipped: true })]);
  assert.equal(readBoard().placement, '4k3/8/8/8/8/8/8/4K3');
});
test('annotated FEN boards preserve turn, castling, en passant and counters', () => {
  const fen = '4k3/8/8/8/8/8/8/4K3 b - - 0 14';
  use([root('board', [], { fen })]);
  assert.equal(readBoard().fen, fen);
  use([]); assert.match(readBoard().error, /No supported board/);
});
