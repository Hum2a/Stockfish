// Self-contained: Chrome serializes this function into the selected tab's
// isolated world. Read DOM only; never click, access page JS, or make moves.
export function readBoard(boardIndex = 0) {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 80 && rect.height > 80 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const candidates = [...document.querySelectorAll('wc-chess-board, chess-board, cg-board, [data-fen], [class*="board-b72b1"], [data-chess-board]')]
    .filter(visible).filter((el, i, all) => !all.some((other, j) => i !== j && el.contains(other))).slice(0, 16);
  const root = candidates[boardIndex];
  if (!root) return { error: candidates.length ? 'That board is no longer visible. Select it again.' : 'No supported board found. Open a Chess.com board, Chessground board, or a board exposing data-fen.', boardCount: candidates.length };
  const orientation = root.closest('.flipped, .orientation-black, [data-orientation="black"]') ? 'b' : 'w';
  const base = { orientation, boardCount: candidates.length, boardIndex, host: location.hostname };
  const fen = root.closest('[data-fen]')?.getAttribute('data-fen');
  if (fen && /^([1-8pnbrqkPNBRQK]+\/){7}[1-8pnbrqkPNBRQK]+(?:\s|$)/.test(fen.trim())) {
    return { ...base, adapter: 'FEN board', placement: fen.trim().split(/\s/)[0], fen: fen.trim().split(/\s+/).length === 6 ? fen.trim() : null };
  }
  const squares = {};
  let adapter;
  if (root.matches('wc-chess-board, chess-board')) {
    adapter = 'Chess.com';
    for (const el of root.querySelectorAll('.piece')) {
      if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue;
      if (el.classList.contains('ghost') || el.classList.contains('dragging')) return { ...base, transient: true };
      const classes = el.getAttribute('class') || '';
      const piece = classes.match(/(?:^|\s)([wb])([pnbrqk])(?:\s|$)/);
      const square = classes.match(/(?:^|\s)square-([1-8])([1-8])(?:\s|$)/);
      if (!piece || !square) continue;
      const sq = 'abcdefgh'[Number(square[1]) - 1] + square[2];
      if (squares[sq]) return { ...base, transient: true };
      squares[sq] = piece[1] === 'w' ? piece[2].toUpperCase() : piece[2];
    }
  } else if (root.matches('cg-board')) {
    adapter = 'Chessground';
    const rect = root.getBoundingClientRect();
    const names = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
    for (const el of root.querySelectorAll('piece')) {
      if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue;
      if (el.classList.contains('ghost') || el.classList.contains('dragging') || el.classList.contains('anim')) return { ...base, transient: true };
      const type = Object.keys(names).find((name) => el.classList.contains(name));
      if (!type || (!el.classList.contains('white') && !el.classList.contains('black'))) continue;
      const r = el.getBoundingClientRect();
      const x = Math.round((r.left - rect.left) / (rect.width / 8));
      const y = Math.round((r.top - rect.top) / (rect.height / 8));
      if (x < 0 || x > 7 || y < 0 || y > 7) return { ...base, transient: true };
      const sq = 'abcdefgh'[orientation === 'b' ? 7 - x : x] + (orientation === 'b' ? y + 1 : 8 - y);
      if (squares[sq]) return { ...base, transient: true };
      squares[sq] = el.classList.contains('white') ? names[type].toUpperCase() : names[type];
    }
  } else {
    adapter = 'Annotated board';
    for (const el of root.querySelectorAll('[data-piece]')) {
      const square = el.closest('[data-square]')?.getAttribute('data-square');
      const piece = el.getAttribute('data-piece');
      if (!/^[a-h][1-8]$/.test(square || '') || !/^[wb][pnbrqk]$/i.test(piece || '')) continue;
      if (squares[square]) return { ...base, transient: true };
      squares[square] = piece[0].toLowerCase() === 'w' ? piece[1].toUpperCase() : piece[1].toLowerCase();
    }
  }
  if (Object.values(squares).filter((p) => p === 'K').length !== 1 || Object.values(squares).filter((p) => p === 'k').length !== 1) return { ...base, error: 'Waiting for a complete board with both kings.' };
  const ranks = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = ''; let empty = 0;
    for (const file of 'abcdefgh') {
      const piece = squares[file + rank];
      if (!piece) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += piece;
    }
    if (empty) row += empty;
    ranks.push(row);
  }
  return { ...base, adapter, placement: ranks.join('/'), fen: null };
}
