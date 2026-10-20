import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  START_FEN, fenWithTurn, checkPosition, boardToFen, fenToBoard,
  pvToSan, uciToSan, whiteScore, formatScore, whitePercent,
} from '../chess-utils.js';

test('start position is valid and round-trips through the board map', () => {
  assert.equal(checkPosition(START_FEN), null);
  assert.equal(boardToFen(fenToBoard(START_FEN), 'w'), START_FEN);
});

test('switching side to move clears en passant', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
  assert.equal(fenWithTurn(fen, 'b'), 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2');
});

test('rejects impossible positions', () => {
  assert.match(checkPosition('8/8/8/8/8/8/8/K7 w - - 0 1'), /Black must have exactly one king/);
  assert.match(checkPosition('k7/8/8/8/8/8/8/KK6 w - - 0 1'), /White must have exactly one king/);
  assert.match(checkPosition('k6P/8/8/8/8/8/8/K7 w - - 0 1'), /first or last rank/);
  // Black king attacked by the rook, but it is White to move.
  assert.match(checkPosition('k6R/8/8/8/8/8/8/K7 w - - 0 1'), /Black is in check/);
  assert.match(checkPosition('not a fen'), /6 fields/);
});

test('same position is fine with Black to move', () => {
  assert.equal(checkPosition('k6R/8/8/8/8/8/8/K7 b - - 0 1'), null);
});

test('castling rights come from king and rook placement', () => {
  const board = { e1: 'wK', h1: 'wR', e8: 'bK', a8: 'bR' };
  assert.equal(boardToFen(board, 'b'), 'r3k3/8/8/8/8/8/8/4K2R b Kq - 0 1');
  assert.equal(boardToFen({ d1: 'wK', h1: 'wR', e8: 'bK' }, 'w').split(' ')[2], '-');
});

test('PV converts to SAN with move numbers for either side', () => {
  assert.equal(pvToSan(START_FEN, ['e2e4', 'e7e5', 'g1f3']), '1. e4 e5 2. Nf3');
  const blackToMove = fenWithTurn(START_FEN, 'b');
  assert.equal(pvToSan(blackToMove, ['e7e5', 'g1f3']), '1… e5 2. Nf3');
  // Promotion and a bad move that stops conversion.
  assert.equal(uciToSan('8/P6k/8/8/8/8/8/K7 w - - 0 1', 'a7a8q'), 'a8=Q');
  assert.equal(pvToSan(START_FEN, ['e2e4', 'e2e4']), '1. e4');
});

test('scores are shown from White\'s side', () => {
  assert.deepEqual(whiteScore({ scoreType: 'cp', score: 50 }, 'b'), { type: 'cp', value: -50 });
  assert.equal(formatScore({ type: 'cp', value: 123 }), '+1.23');
  assert.equal(formatScore({ type: 'cp', value: -40 }), '-0.40');
  assert.equal(formatScore({ type: 'mate', value: 3 }), '#3');
  assert.equal(formatScore({ type: 'mate', value: -2 }), '#-2');
  assert.equal(whitePercent({ type: 'cp', value: 0 }), 50);
  assert.ok(whitePercent({ type: 'cp', value: 300 }) > 75);
  assert.equal(whitePercent({ type: 'mate', value: -1 }), 0);
});

test('normalizeFen fills in missing fields', async () => {
  const { normalizeFen, looksLikeFen } = await import('../chess-utils.js');
  assert.equal(normalizeFen('8/8/8/8/8/8/8/K6k'), '8/8/8/8/8/8/8/K6k w - - 0 1');
  assert.equal(normalizeFen('  8/8/8/8/8/8/8/K6k   b  -  - '), '8/8/8/8/8/8/8/K6k b - - 0 1');
  assert.equal(normalizeFen(START_FEN), START_FEN);
  assert.ok(looksLikeFen(START_FEN));
  assert.ok(looksLikeFen('8/8/8/8/8/8/8/K6k'));
  assert.ok(!looksLikeFen('1. e4 e5 2. Nf3 Nc6'));
});
