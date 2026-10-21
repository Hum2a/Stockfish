import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../vendor/chess.js';
import { START_FEN } from '../chess-utils.js';
import { TrackedGame } from '../tracked-game.js';

const snapshot = (fen, full = false) => ({ placement: fen.split(' ')[0], fen: full ? fen : null });
test('tracks legal moves, catches up two half-moves, and preserves en passant and castling rights', () => {
  const tracked = new TrackedGame();
  tracked.update(snapshot(START_FEN));
  const game = new Chess();
  game.move('e4'); game.move('a6');
  let result = tracked.update(snapshot(game.fen()));
  assert.deepEqual(result.moves.map((m) => m.san), ['e4', 'a6']);
  for (const san of ['e5', 'd5', 'exd6', 'exd6', 'Nf3', 'Nf6', 'Be2', 'Be7', 'O-O']) {
    game.move(san); result = tracked.update(snapshot(game.fen()));
    assert.equal(tracked.currentFen(), game.fen());
  }
  assert.equal(result.moves.at(-1).san, 'O-O');
  assert.equal(tracked.currentFen().split(' ')[2], 'kq');
});
test('supports promotion and resuming after source navigation', () => {
  const game = new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  const tracked = new TrackedGame();
  tracked.update(snapshot(game.fen(), true));
  game.move('a8=Q+');
  tracked.update(snapshot(game.fen()));
  assert.equal(tracked.moves[0].uci, 'a7a8q');
  tracked.update(snapshot(tracked.startFen));
  assert.equal(tracked.ply, 0);
  tracked.update(snapshot(game.fen()));
  assert.equal(tracked.ply, 1);
});
test('requires explicit turn when joining midgame; does not invent castling rights', () => {
  const game = new Chess(); game.move('e4');
  const tracked = new TrackedGame();
  assert.throws(() => tracked.update(snapshot(game.fen())), /choose the side/);
  tracked.update(snapshot(game.fen()), { turn: 'b' });
  assert.equal(tracked.currentFen().split(' ')[1], 'b');
  assert.equal(tracked.currentFen().split(' ')[2], '-');
});
test('unknown jumps leave history intact until resync; full FEN jumps recover automatically', () => {
  const tracked = new TrackedGame(); tracked.update(snapshot(START_FEN));
  const game = new Chess(); for (const m of ['e4', 'e5', 'Nf3']) game.move(m);
  assert.throws(() => tracked.update(snapshot(game.fen())), /unfamiliar position/);
  assert.equal(tracked.currentFen(), START_FEN);
  tracked.update(snapshot(game.fen(), true));
  assert.equal(tracked.currentFen(), game.fen());
});
test('repeated snapshots do not duplicate moves; returned history is independent', () => {
  const tracked = new TrackedGame(); tracked.update(snapshot(START_FEN));
  assert.equal(tracked.update(snapshot(START_FEN)).changed, false);
  const game = new Chess(); game.move('e4');
  const result = tracked.update(snapshot(game.fen())); result.moves.pop();
  assert.equal(tracked.moves.length, 1);
});
test('replayable capture state restores rights and continues after a studio reload', () => {
  const original = new TrackedGame(); original.update(snapshot(START_FEN));
  const game = new Chess(); game.move('e4'); original.update(snapshot(game.fen()));
  const restored = new TrackedGame(JSON.parse(JSON.stringify(original.serialize())));
  assert.equal(restored.currentFen(), original.currentFen());
  game.move('e5'); restored.update(snapshot(game.fen()));
  assert.deepEqual(restored.moves.map((m) => m.san), ['e4', 'e5']);
  assert.throws(() => new TrackedGame({ startFen: START_FEN, moves: ['e2e5'] }));
});
