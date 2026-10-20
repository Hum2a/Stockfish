// Pure helpers shared by the UI. No DOM access, so they can be tested in Node.
import { Chess, validateFen } from './vendor/chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const FILES = 'abcdefgh';

// Fill in fields that are often left off when FENs are shared, e.g. just the placement.
export function normalizeFen(text) {
  const parts = text.trim().split(/\s+/);
  const defaults = ['', 'w', '-', '-', '0', '1'];
  if (parts.length === 0 || parts.length > 6) return text.trim();
  return [...parts, ...defaults.slice(parts.length)].join(' ');
}

// Rough check for whether a piece of text is a FEN rather than a PGN.
export function looksLikeFen(text) {
  return /^\s*([1-8pnbrqkPNBRQK]{1,8}\/){7}[1-8pnbrqkPNBRQK]{1,8}(\s|$)/.test(text);
}

// Same placement, different side to move. En passant is cleared since it only
// makes sense for the side that was originally to move.
export function fenWithTurn(fen, turn) {
  const parts = fen.split(' ');
  parts[1] = turn;
  parts[3] = '-';
  return parts.join(' ');
}

// Returns null if the position is fine for the engine, otherwise a reason.
export function checkPosition(fen) {
  const parts = fen.trim().split(/\s+/);
  if (parts.length !== 6) return 'A FEN needs 6 fields (placement, side, castling, en passant, halfmove, fullmove).';

  const placement = parts[0];
  const count = (ch) => placement.split('').filter((c) => c === ch).length;
  if (count('K') !== 1) return 'White must have exactly one king.';
  if (count('k') !== 1) return 'Black must have exactly one king.';

  const ranks = placement.split('/');
  if (ranks.length === 8 && /[pP]/.test(ranks[0] + ranks[7])) return 'Pawns cannot stand on the first or last rank.';

  const { ok, error } = validateFen(fen);
  if (!ok) return error;

  // The side that is NOT to move must not be in check, or the position is unreachable.
  const other = parts[1] === 'w' ? 'b' : 'w';
  const flipped = new Chess(fenWithTurn(fen, other), { skipValidation: true });
  if (flipped.inCheck()) {
    return `${other === 'w' ? 'White' : 'Black'} is in check but it is not their move, so this position is impossible.`;
  }
  return null;
}

// Board map {square: 'wK'} -> FEN, with castling rights derived from where the
// kings and rooks stand.
export function boardToFen(board, turn) {
  let placement = '';
  for (let rank = 8; rank >= 1; rank--) {
    let empty = 0;
    for (const file of FILES) {
      const p = board[file + rank];
      if (!p) { empty++; continue; }
      if (empty) { placement += empty; empty = 0; }
      placement += p[0] === 'w' ? p[1].toUpperCase() : p[1].toLowerCase();
    }
    if (empty) placement += empty;
    if (rank > 1) placement += '/';
  }

  let castling = '';
  if (board.e1 === 'wK') {
    if (board.h1 === 'wR') castling += 'K';
    if (board.a1 === 'wR') castling += 'Q';
  }
  if (board.e8 === 'bK') {
    if (board.h8 === 'bR') castling += 'k';
    if (board.a8 === 'bR') castling += 'q';
  }
  return `${placement} ${turn} ${castling || '-'} - 0 1`;
}

export function fenToBoard(fen) {
  const board = {};
  const ranks = fen.split(' ')[0].split('/');
  ranks.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      board[FILES[f] + (8 - i)] = color + ch.toUpperCase();
      f++;
    }
  });
  return board;
}

export function uciToMove(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

// Convert a UCI principal variation to SAN with move numbers, e.g. "12. Nf3 Nc6 13. d4".
export function pvToSan(fen, pv, maxMoves = 12) {
  const game = new Chess(fen, { skipValidation: true });
  const out = [];
  for (const uci of pv.slice(0, maxMoves)) {
    const moveNo = game.moveNumber();
    const white = game.turn() === 'w';
    let move;
    try {
      move = game.move(uciToMove(uci));
    } catch {
      break;
    }
    if (white) out.push(`${moveNo}. ${move.san}`);
    else out.push(out.length === 0 ? `${moveNo}… ${move.san}` : move.san);
  }
  return out.join(' ');
}

export function uciToSan(fen, uci) {
  try {
    return new Chess(fen, { skipValidation: true }).move(uciToMove(uci)).san;
  } catch {
    return uci;
  }
}

// Engine scores are from the side to move; the UI always shows them from White's side.
export function whiteScore(info, turn) {
  const sign = turn === 'w' ? 1 : -1;
  return { type: info.scoreType, value: info.score * sign };
}

export function formatScore({ type, value }) {
  if (type === 'mate') return value > 0 ? `#${value}` : `#-${Math.abs(value)}`;
  const pawns = value / 100;
  return (pawns > 0 ? '+' : '') + pawns.toFixed(2);
}

// Share of the eval bar that is White's, 0–100. Same curve Lichess uses.
export function whitePercent({ type, value }) {
  if (type === 'mate') return value > 0 ? 100 : 0;
  const winChance = 2 / (1 + Math.exp(-0.00368208 * value)) - 1;
  return 50 + 50 * winChance;
}
