import { Chess } from './vendor/chess.js';
import { START_FEN, checkPosition } from './chess-utils.js';

const placement = (fen) => fen.split(' ')[0];
const record = (m) => ({ san: m.san, uci: m.from + m.to + (m.promotion || ''), from: m.from, to: m.to, fen: m.after });

// Independent source history: exploring the studio never changes this game.
export class TrackedGame {
  constructor(saved = null) {
    this.startFen = null; this.moves = []; this.ply = 0;
    if (saved) {
      if (checkPosition(saved.startFen) || !Array.isArray(saved.moves) || saved.moves.length > 10000) throw new Error('Invalid saved source game.');
      const game = new Chess(saved.startFen);
      this.moves = saved.moves.map((uci) => record(game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })));
      this.startFen = saved.startFen;
      this.ply = Number.isInteger(saved.ply) ? Math.max(0, Math.min(this.moves.length, saved.ply)) : this.moves.length;
    }
  }
  serialize() { return { startFen: this.startFen, moves: this.moves.map((m) => m.uci), ply: this.ply }; }
  currentFen() { return this.ply ? this.moves[this.ply - 1].fen : this.startFen; }
  update(snapshot, { turn = 'auto', castling = '-', reset = false } = {}) {
    if (!snapshot || typeof snapshot.placement !== 'string' || snapshot.placement.length > 80) throw new Error('Waiting for a readable board.');
    if (snapshot.fen && checkPosition(snapshot.fen)) throw new Error('Waiting for a legal position; the source board may be animating.');
    if (snapshot.fen) snapshot = { ...snapshot, fen: new Chess(snapshot.fen).fen() };
    if (!this.startFen || reset) {
      let fen = snapshot.fen;
      if (!fen && snapshot.placement === placement(START_FEN)) fen = START_FEN;
      if (!fen) {
        if (!['w', 'b'].includes(turn)) throw new Error('Joining midgame: choose the side to move below, then click Resync.');
        if (!/^(?:K?Q?k?q?|-)$/.test(castling) || !castling) throw new Error('Choose valid castling rights.');
        fen = `${snapshot.placement} ${turn} ${castling} - 0 1`;
      }
      const problem = checkPosition(fen);
      if (problem) throw new Error(problem);
      this.startFen = fen; this.moves = []; this.ply = 0;
      return this.result(true);
    }
    const matches = (fen) => snapshot.fen ? fen === snapshot.fen : placement(fen) === snapshot.placement;
    if (matches(this.currentFen())) return this.result(false);
    const game = new Chess(this.currentFen());
    const options = game.moves({ verbose: true });
    let found = options.find((m) => matches(m.after));
    let path = found ? [found] : null;
    if (!path) {
      // Catch up if two half-moves arrived between stable snapshots.
      for (const first of options) {
        const next = new Chess(first.after);
        found = next.moves({ verbose: true }).find((m) => matches(m.after));
        if (found) { path = [first, found]; break; }
      }
    }
    if (path) {
      this.moves = [...this.moves.slice(0, this.ply), ...path.map(record)];
      this.ply = this.moves.length;
      return this.result(true);
    }
    const known = [this.startFen, ...this.moves.map((m) => m.fen)].findIndex(matches);
    if (known >= 0) { this.ply = known; return this.result(true); }
    if (snapshot.fen) return this.update(snapshot, { reset: true });
    throw new Error('Source jumped to an unfamiliar position. Choose its side to move and castling rights, then Resync.');
  }
  result(changed) { return { changed, startFen: this.startFen, moves: [...this.moves], ply: this.ply }; }
}
