import { Chess } from './vendor/chess.js';
import { Engine } from './engine.js';
import {
  START_FEN, FILES, normalizeFen, fenWithTurn, checkPosition, boardToFen, fenToBoard,
  pvToSan, uciToSan, whiteScore, formatScore, whitePercent,
} from './chess-utils.js';

const $ = (id) => document.getElementById(id);

// Outline glyph, filled glyph. U+FE0E forces text (not emoji) rendering.
const GLYPHS = {
  K: ['♔', '♚'], Q: ['♕', '♛'], R: ['♖', '♜'], B: ['♗', '♝'], N: ['♘', '♞'], P: ['♙', '♟'],
};
const VS = '︎';

const state = {
  startFen: START_FEN,
  moves: [], // { san, uci, from, to, fen }
  ply: 0,
  orientation: 'w',
  selected: null,
  editing: false,
  editBoard: {},
  editTool: 'wP',
  lines: [],
  analysis: null, // { fen, depth, done, best }
};

let game = new Chess();

const currentFen = () => (state.ply === 0 ? state.startFen : state.moves[state.ply - 1].fen);

function pieceEl(code) {
  const el = document.createElement('div');
  el.className = `piece ${code[0]}`;
  const [line, fill] = GLYPHS[code[1]];
  el.innerHTML = `<span class="fill">${fill}${VS}</span><span class="line">${line}${VS}</span>`;
  return el;
}

function showError(msg) {
  $('error').textContent = msg || '';
}

// ---------- Board ----------

const boardEl = $('board');
const squareEls = {};

function displaySquares() {
  const ranks = state.orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = state.orientation === 'w' ? FILES.split('') : FILES.split('').reverse();
  return ranks.flatMap((r) => files.map((f) => f + r));
}

function buildBoard() {
  boardEl.innerHTML = '';
  $('eval-bar').classList.toggle('flipped', state.orientation === 'b');
  const order = displaySquares();
  order.forEach((sq, i) => {
    const el = document.createElement('div');
    const fileIdx = FILES.indexOf(sq[0]);
    const rank = Number(sq[1]);
    el.className = `sq ${(fileIdx + rank) % 2 === 0 ? 'light' : 'dark'}`;
    el.dataset.square = sq;
    if (i % 8 === 0) el.insertAdjacentHTML('beforeend', `<span class="coord rank">${rank}</span>`);
    if (i >= 56) el.insertAdjacentHTML('beforeend', `<span class="coord file">${sq[0]}</span>`);
    boardEl.appendChild(el);
    squareEls[sq] = el;
  });
}

function boardPieces() {
  if (state.editing) return state.editBoard;
  return fenToBoard(game.fen());
}

function legalTargets(from) {
  return game.moves({ square: from, verbose: true }).map((m) => m.to);
}

function renderBoard() {
  const pieces = boardPieces();
  const last = !state.editing && state.ply > 0 ? state.moves[state.ply - 1] : null;
  const targets = !state.editing && state.selected ? legalTargets(state.selected) : [];
  let checkSq = null;
  if (!state.editing && game.inCheck()) {
    checkSq = Object.keys(pieces).find((s) => pieces[s] === `${game.turn()}K`);
  }

  for (const [sq, el] of Object.entries(squareEls)) {
    el.querySelector('.piece')?.remove();
    if (pieces[sq]) el.appendChild(pieceEl(pieces[sq]));
    el.classList.toggle('last', !!last && (sq === last.from || sq === last.to));
    el.classList.toggle('sel', sq === state.selected);
    el.classList.toggle('target', targets.includes(sq));
    el.classList.toggle('capture', targets.includes(sq) && !!pieces[sq]);
    el.classList.toggle('check', sq === checkSq);
  }
  renderArrows();
}

function squareCenter(sq) {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]) - 1;
  const col = state.orientation === 'w' ? f : 7 - f;
  const row = state.orientation === 'w' ? 7 - r : r;
  return [col + 0.5, row + 0.5];
}

function renderArrows() {
  const layer = $('arrow-layer');
  layer.innerHTML = '';
  if (state.editing || !state.analysis || state.analysis.fen !== currentFen()) return;
  // Draw alternatives first so the best move sits on top.
  const lines = state.lines.filter(Boolean);
  [...lines].reverse().forEach((line) => {
    const uci = line.pv[0];
    const best = line.multipv === 1;
    const [x1, y1] = squareCenter(uci.slice(0, 2));
    const [x2, y2] = squareCenter(uci.slice(2, 4));
    // Pull the end back so the arrow head lands inside the target square.
    const len = Math.hypot(x2 - x1, y2 - y1);
    const k = (len - 0.25) / len;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('x1', x1);
    el.setAttribute('y1', y1);
    el.setAttribute('x2', x1 + (x2 - x1) * k);
    el.setAttribute('y2', y1 + (y2 - y1) * k);
    el.setAttribute('stroke', best ? 'var(--arrow-best)' : 'var(--arrow-alt)');
    el.setAttribute('stroke-width', best ? 0.17 : 0.11);
    el.setAttribute('marker-end', `url(#head-${best ? 'best' : 'alt'})`);
    layer.appendChild(el);
  });
}

// ---------- Moving pieces ----------

function pickPromotion(color) {
  const promo = $('promo');
  promo.innerHTML = '';
  promo.hidden = false;
  return new Promise((resolve) => {
    for (const t of ['Q', 'R', 'B', 'N']) {
      const b = document.createElement('button');
      b.appendChild(pieceEl(color + t));
      b.onclick = (e) => { e.stopPropagation(); promo.hidden = true; resolve(t.toLowerCase()); };
      promo.appendChild(b);
    }
    promo.onclick = () => { promo.hidden = true; resolve(null); };
  });
}

async function tryMove(from, to) {
  const candidates = game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  if (candidates.length === 0) return false;
  let promotion;
  if (candidates.some((m) => m.promotion)) {
    promotion = await pickPromotion(game.turn());
    if (!promotion) { state.selected = null; renderBoard(); return false; }
  }
  const move = game.move({ from, to, promotion });
  state.moves = state.moves.slice(0, state.ply);
  state.moves.push({ san: move.san, uci: from + to + (promotion || ''), from, to, fen: game.fen() });
  state.ply++;
  state.selected = null;
  positionChanged();
  return true;
}

let drag = null;

boardEl.addEventListener('pointerdown', async (e) => {
  const sqEl = e.target.closest('.sq');
  if (!sqEl || e.button !== 0) return;
  const sq = sqEl.dataset.square;

  if (state.editing) { editClick(sq); return; }

  if (state.selected && state.selected !== sq && legalTargets(state.selected).includes(sq)) {
    await tryMove(state.selected, sq);
    return;
  }

  const piece = game.get(sq);
  if (piece && piece.color === game.turn()) {
    state.selected = sq;
    renderBoard();
    startDrag(e, sq);
  } else if (state.selected) {
    state.selected = null;
    renderBoard();
  }
});

function startDrag(e, from) {
  const original = squareEls[from].querySelector('.piece');
  if (!original) return;
  const ghost = original.cloneNode(true);
  ghost.classList.add('ghost');
  ghost.style.left = `${e.clientX}px`;
  ghost.style.top = `${e.clientY}px`;
  document.body.appendChild(ghost);
  drag = { from, ghost, original, moved: false };

  const move = (ev) => {
    drag.moved = true;
    original.classList.add('dragging');
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
  };
  const up = async (ev) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    ghost.remove();
    original.classList.remove('dragging');
    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.sq')?.dataset.square;
    const wasMoved = drag.moved;
    drag = null;
    // A drop on another square plays the move; a plain click keeps the piece selected.
    if (wasMoved && target && target !== from) {
      if (!(await tryMove(from, target))) { state.selected = null; renderBoard(); }
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

// ---------- Navigation ----------

function goTo(ply) {
  state.ply = Math.max(0, Math.min(state.moves.length, ply));
  state.selected = null;
  positionChanged();
}

function loadPosition(fen, moves = []) {
  state.startFen = fen;
  state.moves = moves;
  state.ply = moves.length;
  state.selected = null;
  showError('');
  positionChanged();
}

$('btn-start').onclick = () => goTo(0);
$('btn-back').onclick = () => goTo(state.ply - 1);
$('btn-fwd').onclick = () => goTo(state.ply + 1);
$('btn-end').onclick = () => goTo(state.moves.length);
$('btn-flip').onclick = () => {
  state.orientation = state.orientation === 'w' ? 'b' : 'w';
  buildBoard();
  renderBoard();
  renderAnalysis();
};
$('btn-reset').onclick = () => loadPosition(START_FEN);

document.addEventListener('keydown', (e) => {
  if (state.editing || e.target.closest('input, textarea, select')) return;
  if (e.key === 'ArrowLeft') goTo(state.ply - 1);
  else if (e.key === 'ArrowRight') goTo(state.ply + 1);
  else if (e.key === 'Home') goTo(0);
  else if (e.key === 'End') goTo(state.moves.length);
  else if (e.key === 'f') $('btn-flip').click();
  else return;
  e.preventDefault();
});

// ---------- Side to move ----------

function setTurn(turn) {
  if (state.editing || turn === game.turn()) return;
  const fen = fenWithTurn(currentFen(), turn);
  const problem = checkPosition(fen);
  if (problem) { showError(problem); return; }
  // Changing who moves starts a fresh line from this position.
  loadPosition(fen);
}
$('turn-w').onclick = () => setTurn('w');
$('turn-b').onclick = () => setTurn('b');

// ---------- Position editor ----------

function buildPalette() {
  const palette = $('palette');
  const tools = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'x', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
  for (const t of tools) {
    const b = document.createElement('button');
    b.dataset.tool = t;
    if (t === 'x') {
      // Eraser fills the last column, beside both rows of pieces.
      b.className = 'trash';
      b.textContent = 'Erase';
      b.style.gridColumn = '7';
      b.style.gridRow = '1 / span 2';
      b.style.height = 'auto';
    } else {
      b.appendChild(pieceEl(t));
    }
    b.onclick = () => { state.editTool = t; renderPalette(); };
    palette.appendChild(b);
  }
}

function renderPalette() {
  for (const b of $('palette').children) b.classList.toggle('on', b.dataset.tool === state.editTool);
}

function editClick(sq) {
  const t = state.editTool;
  if (t === 'x' || state.editBoard[sq] === t) delete state.editBoard[sq];
  else state.editBoard[sq] = t;
  renderBoard();
}

function setEditing(on) {
  state.editing = on;
  state.selected = null;
  $('editor').hidden = !on;
  $('play-tools').hidden = on;
  if (on) {
    state.editBoard = fenToBoard(currentFen());
    $('edit-turn').value = game.turn();
    engine?.stop();
    renderPalette();
    renderBoard();
    renderAnalysis();
  } else {
    positionChanged();
  }
}

$('btn-edit').onclick = () => setEditing(true);
$('edit-cancel').onclick = () => { showError(''); setEditing(false); };
$('edit-startpos').onclick = () => { state.editBoard = fenToBoard(START_FEN); renderBoard(); };
$('edit-clear').onclick = () => { state.editBoard = {}; renderBoard(); };
$('edit-done').onclick = () => {
  const fen = boardToFen(state.editBoard, $('edit-turn').value);
  const problem = checkPosition(fen);
  if (problem) { showError(problem); return; }
  state.editing = false;
  $('editor').hidden = true;
  $('play-tools').hidden = false;
  loadPosition(fen);
};

// ---------- FEN / PGN ----------

$('fen-load').onclick = () => {
  const fen = normalizeFen($('fen').value);
  const problem = checkPosition(fen);
  if (problem) { showError(problem); return; }
  if (state.editing) setEditing(false);
  loadPosition(fen);
};
$('fen').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('fen-load').click(); });
$('fen-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(currentFen());
    $('fen-copy').textContent = 'Copied';
    setTimeout(() => { $('fen-copy').textContent = 'Copy'; }, 1200);
  } catch {
    $('fen').select();
  }
};

// Returns an error message, or null once the game is loaded.
function loadPgnText(text) {
  const c = new Chess();
  try {
    c.loadPgn(text);
  } catch (err) {
    return `Could not read that PGN: ${err.message}`;
  }
  const hist = c.history({ verbose: true });
  const start = hist.length ? hist[0].before : c.fen();
  const problem = checkPosition(start);
  if (problem) return problem;
  if (state.editing) setEditing(false);
  loadPosition(start, hist.map((m) => ({
    san: m.san, uci: m.from + m.to + (m.promotion || ''), from: m.from, to: m.to, fen: m.after,
  })));
  return null;
}

$('pgn-load').onclick = () => {
  const text = $('pgn').value.trim();
  if (text) showError(loadPgnText(text));
};

// ---------- Move list ----------

function renderMoves() {
  const el = $('moves');
  el.innerHTML = '';
  if (state.moves.length === 0) {
    el.innerHTML = '<span class="empty">No moves yet. Play on the board to explore lines.</span>';
    return;
  }
  const start = new Chess(state.startFen, { skipValidation: true });
  let moveNo = start.moveNumber();
  let whiteToMove = start.turn() === 'w';

  if (!whiteToMove) {
    el.insertAdjacentHTML('beforeend', `<span class="num">${moveNo}.</span><span class="mv"></span>`);
  }
  state.moves.forEach((m, i) => {
    if (whiteToMove) el.insertAdjacentHTML('beforeend', `<span class="num">${moveNo}.</span>`);
    const span = document.createElement('span');
    span.className = `mv${i + 1 === state.ply ? ' cur' : ''}`;
    span.textContent = m.san;
    span.onclick = () => goTo(i + 1);
    el.appendChild(span);
    if (!whiteToMove) moveNo++;
    whiteToMove = !whiteToMove;
  });
  el.querySelector('.cur')?.scrollIntoView({ block: 'nearest' });
}

// ---------- Analysis display ----------

const sideName = (c) => (c === 'w' ? 'White' : 'Black');

function gameOverText() {
  if (game.isCheckmate()) return `Checkmate. ${sideName(game.turn() === 'w' ? 'b' : 'w')} wins.`;
  if (game.isStalemate()) return 'Stalemate. The game is drawn.';
  return null;
}

function renderEvalBar(score) {
  const pct = score ? whitePercent(score) : 50;
  $('eval-fill').style.height = `${pct}%`;
  const label = $('eval-label');
  label.textContent = score ? formatScore(score).replace('+', '') : '';
  // Put the label at the end of the side that is ahead so it stays readable.
  const blackAhead = pct < 50;
  label.classList.toggle('dark', blackAhead);
  label.classList.toggle('top', blackAhead !== (state.orientation === 'b'));
}

function renderAnalysis() {
  const turn = game.turn();
  $('turn-w').classList.toggle('on', turn === 'w');
  $('turn-b').classList.toggle('on', turn === 'b');
  $('turn-w').setAttribute('aria-checked', turn === 'w');
  $('turn-b').setAttribute('aria-checked', turn === 'b');

  const linesEl = $('lines');
  const over = gameOverText();

  if (state.editing) {
    $('best-label').textContent = 'Setting up a position';
    $('best-move').textContent = '—';
    $('best-meta').textContent = 'Press Done to analyse it.';
    linesEl.innerHTML = '';
    renderEvalBar(null);
    return;
  }

  $('best-label').textContent = `Best move for ${sideName(turn)}`;

  if (over) {
    $('best-move').textContent = '—';
    $('best-meta').textContent = over;
    linesEl.innerHTML = '';
    renderEvalBar(game.isCheckmate() ? { type: 'mate', value: turn === 'w' ? -1 : 1 } : { type: 'cp', value: 0 });
    return;
  }

  const a = state.analysis;
  const lines = a && a.fen === currentFen() ? state.lines.filter(Boolean) : [];
  if (lines.length === 0) {
    $('best-move').textContent = '…';
    $('best-meta').textContent = engine?.ready ? 'Thinking…' : 'Waiting for the engine to load…';
    linesEl.innerHTML = '<li class="empty">Analysing…</li>';
    renderEvalBar(null);
    return;
  }

  const top = lines[0];
  const topScore = whiteScore(top, turn);
  $('best-move').textContent = uciToSan(a.fen, a.best || top.pv[0]);
  $('best-meta').textContent = `${formatScore(topScore)} · depth ${top.depth}/${a.depth}${a.done ? ' · done' : ''}`;
  renderEvalBar(topScore);

  linesEl.innerHTML = '';
  for (const line of lines) {
    const s = whiteScore(line, turn);
    const li = document.createElement('li');
    const neg = s.value < 0;
    li.innerHTML = `<span class="score${neg ? ' neg' : ''}"></span><span class="pv"></span>`;
    li.querySelector('.score').textContent = formatScore(s);
    li.querySelector('.pv').textContent = pvToSan(a.fen, line.pv);
    linesEl.appendChild(li);
  }
}

// ---------- Engine ----------

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderAnalysis();
    renderArrows();
  });
}

const engine = new Engine({
  onReady: () => {
    $('engine-status').textContent = 'Stockfish 19 (WASM) ready';
    scheduleRender();
  },
  onInfo: (job, info) => {
    if (job.fen !== currentFen() || state.editing) return;
    if (!state.analysis || state.analysis.fen !== job.fen) {
      state.analysis = { fen: job.fen, depth: job.depth, done: false };
      state.lines = [];
    }
    state.lines[info.multipv - 1] = info;
    scheduleRender();
  },
  onBestMove: (job, best) => {
    if (!state.analysis || job.fen !== state.analysis.fen) return;
    state.analysis.done = true;
    if (best && best !== '(none)') state.analysis.best = best;
    scheduleRender();
  },
});

function analyse() {
  if (state.editing || gameOverText()) {
    engine.stop();
    return;
  }
  const fen = currentFen();
  state.analysis = { fen, depth: Number($('depth').value), done: false };
  state.lines = [];
  engine.analyse({ fen, depth: state.analysis.depth, multipv: Number($('multipv').value) });
}

$('depth').oninput = () => { $('depth-out').textContent = $('depth').value; };
$('depth').onchange = analyse;
$('multipv').onchange = analyse;

// ---------- Glue ----------

function positionChanged() {
  game = new Chess(currentFen(), { skipValidation: true });
  if (document.activeElement !== $('fen')) $('fen').value = currentFen();
  $('btn-start').disabled = $('btn-back').disabled = state.ply === 0;
  $('btn-fwd').disabled = $('btn-end').disabled = state.ply === state.moves.length;
  renderBoard();
  renderMoves();
  analyse();
  renderAnalysis();
}

buildPalette();
buildBoard();

// Links like ?fen=<FEN> or ?pgn=<moves> open straight into a position, e.g. to
// share a puzzle with students. The browser extension uses these too.
const params = new URLSearchParams(location.search);
const linkedFen = params.get('fen') && normalizeFen(params.get('fen'));
const linkedPgn = params.get('pgn');
const NOTICES = {
  'play-site': 'Analysis of text from online play sites is turned off to keep games fair. '
    + 'Use the site\'s own analysis once the game is over, or set the position up here by hand.',
};

positionChanged();
if (linkedFen) {
  const problem = checkPosition(linkedFen);
  if (problem) {
    showError(`The position in the link is invalid: ${problem}`);
  } else {
    if (linkedFen.split(' ')[1] === 'b') state.orientation = 'b';
    buildBoard();
    loadPosition(linkedFen);
  }
} else if (linkedPgn) {
  showError(loadPgnText(linkedPgn));
}
if (NOTICES[params.get('notice')]) showError(NOTICES[params.get('notice')]);
