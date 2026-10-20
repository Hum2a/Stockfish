import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Engine, parseInfo } from '../engine.js';

test('parseInfo reads score, multipv and pv; skips bound and pv-less lines', () => {
  const info = parseInfo('info depth 12 seldepth 18 multipv 2 score cp -35 nodes 1000 nps 5000 pv e7e5 g1f3');
  assert.equal(info.depth, 12);
  assert.equal(info.multipv, 2);
  assert.equal(info.scoreType, 'cp');
  assert.equal(info.score, -35);
  assert.deepEqual(info.pv, ['e7e5', 'g1f3']);
  assert.equal(parseInfo('info depth 5 score mate 3 pv d1h5').scoreType, 'mate');
  assert.equal(parseInfo('info depth 5 currmove e2e4 currmovenumber 1'), null);
  assert.equal(parseInfo('info depth 9 score cp 20 lowerbound pv e2e4'), null);
});

// Fake worker that records commands so the stop/bestmove handshake can be checked.
class FakeWorker {
  constructor() { this.sent = []; FakeWorker.last = this; }
  postMessage(cmd) { this.sent.push(cmd); }
  emit(line) { this.onmessage({ data: line }); }
}

test('a new position stops the old search and ignores its output', () => {
  globalThis.Worker = FakeWorker;
  const infos = [];
  const bests = [];
  const engine = new Engine({
    onInfo: (job, info) => infos.push([job.fen, info.depth]),
    onBestMove: (job, best) => bests.push([job.fen, best]),
  });
  const w = FakeWorker.last;
  engine.analyse({ fen: 'A', depth: 10, multipv: 1 });
  assert.ok(!w.sent.includes('position fen A'), 'waits for readyok');
  w.emit('uciok');
  w.emit('readyok');
  assert.ok(w.sent.includes('position fen A'));

  w.emit('info depth 1 score cp 10 pv e2e4');
  engine.analyse({ fen: 'B', depth: 10, multipv: 2 });
  engine.analyse({ fen: 'C', depth: 10, multipv: 2 }); // replaces B before it starts
  assert.equal(w.sent.filter((c) => c === 'stop').length, 1);
  w.emit('info depth 2 score cp 12 pv e2e4'); // late output from A
  w.emit('bestmove e2e4');                     // A's answer to stop
  assert.ok(!w.sent.includes('position fen B'));
  assert.ok(w.sent.includes('position fen C'));
  w.emit('info depth 1 score cp 5 multipv 2 pv d2d4');
  w.emit('bestmove d2d4');

  assert.deepEqual(infos, [['A', 1], ['C', 1]]);
  assert.deepEqual(bests, [['C', 'd2d4']]);
});

test('real Stockfish finds a mate in one for Black', async () => {
  const require = createRequire(import.meta.url);
  // Black to move: Qd8-h4 is mate (fool's mate).
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2';
  const lines = [];
  const best = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('engine timed out')), 60000);
    const sf = require('stockfish')('lite-single', (line) => {
      const info = parseInfo(line);
      if (info) lines.push(info);
      const m = /^bestmove (\S+)/.exec(line);
      if (m) { clearTimeout(timer); sf.terminate(); resolve(m[1]); }
    });
    sf.processCommand('uci');
    sf.processCommand('setoption name MultiPV value 2');
    sf.processCommand(`position fen ${fen}`);
    sf.processCommand('go depth 8');
  });
  assert.equal(best, 'd8h4');
  const top = lines.filter((l) => l.multipv === 1).at(-1);
  assert.equal(top.scoreType, 'mate');
  assert.equal(top.score, 1);
  assert.ok(lines.some((l) => l.multipv === 2), 'MultiPV produced a second line');
});
