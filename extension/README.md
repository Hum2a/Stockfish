# Stockfish Analysis Board: browser extension

A Chrome / Edge extension with Stockfish 19 built in, for studying and teaching.

- **Toolbar button**: opens a board picker for the current tab. Start tracking in the extension studio or on stockfish.humza.website, or open a standalone studio without tracking.
- **Right-click → "Analyse with Stockfish"**: highlight a FEN or a list of moves on a page (an article, a blog, an ebook) and open it on the board.

## Follow a board

1. Open a Chess.com board (analysis, replay, or another board page).
2. Click the extension toolbar button. Select the board if the page has several.
3. Choose **Extension studio** or **stockfish.humza.website**, then **Start tracking**.
4. Keep the source tab open. New stable positions update the studio automatically.
5. For midgame positions without full FEN data, use **Position setup & recovery** to set the side to move and known castling rights, then **Resync position**.
6. Explore variations locally to pause mirroring; **Return to source** catches up. **Stop tracking** ends the session.

The source reader also supports Chessground-style boards, `data-fen` boards, and annotated `data-square` / `data-piece` markup. It does not recognize video, canvas-only boards, or boards inside frames. Site markup changes may require an adapter update. Without full FEN data, midgame en passant and earlier move counters are unknown. Start capture from the starting position for complete move history and rights. Two missed half-moves can be recovered; larger unknown jumps require resync.

## Access and data

- `activeTab` and `scripting` read only the tab you select with the toolbar, using temporary access. No blanket host access to chess sites is requested.
- `storage` keeps source/viewer session bindings in browser-session storage so service-worker restarts do not lose the connection. Closing the source or viewer clears its binding.
- A content script on `stockfish.humza.website`, `localhost`, and `127.0.0.1` relays the studio's tracking requests. Each web session is restricted to the viewer tab that started it. This bridge cannot select arbitrary tabs or inject arbitrary code.
- The source reader returns only board positions, orientation, adapter name and hostname. It never clicks the source board or makes moves. Positions are analyzed locally; tracking sessions are not sent to a backend.
- `contextMenus` preserves manual FEN/PGN selection imports.

## Install

1. From the repo root, run `npm install` (this fetches Stockfish and chess.js).
2. From the repo root, run `npm run build`. That creates `extension/dist/`.
3. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked**, and choose the `dist` folder.

After changing anything in `web-app` or `src`, run `npm run build` again and press the reload button on the extension card.

Version 1.1.0 adds permissions and a website bridge. Reload the unpacked extension, review any browser prompt, then reload an already-open website studio so the bridge is available. Tracking sessions must be restarted after reloading the extension or restarting the browser.

## Tests

Run `npm test` from the repo root. It builds the extension first, because the tests use `dist/background.js`.
