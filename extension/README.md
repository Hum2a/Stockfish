# Stockfish Analysis Board: browser extension

A Chrome / Edge extension with Stockfish 19 built in, for studying and teaching.

- **Toolbar button**: opens a full analysis board in a new tab. Set up any position, choose the side to move, and see the best move, evaluation and top lines.
- **Right-click → "Analyse with Stockfish"**: highlight a FEN or a list of moves on a page (an article, a blog, an ebook) and open it on the board.

## Fair-play design

The extension is built so it cannot be used to get help during a game:

- It has **no access to websites**. The only permission it asks for is `contextMenus`. It adds no scripts to pages, so it cannot see a board on a site or make moves.
- It only receives text **you highlight and choose to send**, the same as copying and pasting.
- On online-play and rated-puzzle sites (chess.com, lichess.org, chess24, Chess Tempo, ChessKid and others), the right-click option is refused and explains why.

## Install

1. From the repo root, run `npm install` (this fetches Stockfish and chess.js).
2. From the repo root, run `npm run build`. That creates `extension/dist/`.
3. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked**, and choose the `dist` folder.

After changing anything in `web-app` or `src`, run `npm run build` again and press the reload button on the extension card.

## Tests

Run `npm test` from the repo root. It builds the extension first, because the tests use `dist/background.js`.
