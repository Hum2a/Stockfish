// Thin wrapper around the Stockfish WASM worker speaking UCI.
// Handles the stop -> bestmove handshake so output from an old search never
// leaks into the display for a new position.

export const ENGINE_PATH = './vendor/stockfish-19-lite-single.js';

// Parse a UCI "info" line. Returns null for lines without a principal variation.
export function parseInfo(line) {
  const t = line.trim().split(/\s+/);
  if (t[0] !== 'info') return null;
  const info = { multipv: 1 };
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth': info.depth = Number(t[++i]); break;
      case 'seldepth': info.seldepth = Number(t[++i]); break;
      case 'multipv': info.multipv = Number(t[++i]); break;
      case 'nodes': info.nodes = Number(t[++i]); break;
      case 'nps': info.nps = Number(t[++i]); break;
      case 'score':
        info.scoreType = t[++i]; // 'cp' or 'mate'
        info.score = Number(t[++i]);
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') info.bound = t[++i];
        break;
      case 'pv': info.pv = t.slice(i + 1); i = t.length; break;
    }
  }
  if (!info.pv || info.pv.length === 0 || info.scoreType === undefined || info.bound) return null;
  return info;
}

export class Engine {
  constructor({ onInfo, onBestMove, onReady, path = ENGINE_PATH }) {
    this.onInfo = onInfo;
    this.onBestMove = onBestMove;
    this.onReady = onReady;
    this.ready = false;
    this.searching = false;
    this.stopping = false;
    this.pending = null;
    this.current = null;

    this.worker = new Worker(path);
    this.worker.onmessage = (e) => this.handle(String(e.data));
    this.send('uci');
  }

  send(cmd) {
    this.worker.postMessage(cmd);
  }

  // Queue an analysis job; replaces any job that has not started yet.
  analyse(job) {
    this.pending = job;
    if (!this.ready) return;
    if (this.searching) {
      if (!this.stopping) {
        this.stopping = true;
        this.send('stop');
      }
    } else {
      this.start();
    }
  }

  stop() {
    this.pending = null;
    if (this.searching && !this.stopping) {
      this.stopping = true;
      this.send('stop');
    }
  }

  start() {
    const job = this.pending;
    this.pending = null;
    if (!job) return;
    this.current = job;
    this.searching = true;
    this.send(`setoption name MultiPV value ${job.multipv}`);
    this.send(`position fen ${job.fen}`);
    this.send(`go depth ${job.depth}`);
  }

  handle(line) {
    if (line === 'uciok') {
      this.send('isready');
    } else if (line === 'readyok') {
      if (!this.ready) {
        this.ready = true;
        this.onReady?.();
        this.start();
      }
    } else if (line.startsWith('info')) {
      if (!this.searching || this.stopping) return;
      const info = parseInfo(line);
      if (info) this.onInfo(this.current, info);
    } else if (line.startsWith('bestmove')) {
      const wasStopped = this.stopping;
      this.searching = false;
      this.stopping = false;
      if (this.pending) {
        this.start();
      } else if (!wasStopped) {
        this.onBestMove(this.current, line.split(/\s+/)[1]);
      }
    }
  }
}
