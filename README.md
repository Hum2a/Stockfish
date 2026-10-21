# Stockfish teaching tools

Chess analysis tools built on Stockfish 19, for teaching.

| Folder | What it is |
| --- | --- |
| [`web-app/`](web-app/) | Analysis board that runs locally at http://localhost:8080 |
| [`extension/`](extension/) | Chrome / Edge extension with the same board built in and opt-in tracking of a selected chessboard tab. |
| [`Stockfish/`](Stockfish/) | The official Stockfish engine source, as a git submodule. For reference; the apps use the prebuilt WebAssembly engine from npm. |

## Setup

```sh
git clone --recurse-submodules <this repo>
npm install
```

`npm install` installs both workspaces and copies the engine and chess.js into `web-app/vendor/`.

## Commands (run from this folder)

| Command | Does |
| --- | --- |
| `npm start` | Runs the web app at http://localhost:8080 |
| `npm run build` | Builds the extension into `extension/dist/` |
| `npm test` | Builds the extension, then runs every workspace's tests |

To install the extension, run `npm run build`, open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and pick `extension/dist`.

## Chess studio

The website and extension share a responsive analysis workspace with light and dark themes, animated piece moves, and reduced-motion support. Games, board orientation, engine depth, line count, and arrow preferences are saved locally on your device. Shared FEN or PGN links take priority over a saved game.

Click **Play best move** or an engine line to explore a recommendation. **Export PGN** downloads the full game, including moves ahead of the position currently being viewed. Use **← / →** to navigate, **Home / End** to jump to the first or last position, **F** to flip, **A** to toggle arrows, and **Escape** to clear selection. Board squares and move history also support keyboard activation with Enter or Space.

After rebuilding, reload an already installed unpacked extension in `chrome://extensions` to pick up changes.

## Follow a chessboard tab

Open Chess.com (or a supported DOM chessboard), click the Stockfish extension, select a board and destination, and press **Start tracking**. The extension studio works offline; the website destination uses the extension's bridge. A standalone website cannot read other tabs without the extension. Only the tab selected through the toolbar receives temporary access; tracking stops reading when the studio closes or you press **Stop tracking**.

The reader supports Chess.com's square classes, Chessground piece geometry, `data-fen` boards, and annotated `data-square` / `data-piece` boards. It polls the selected board about every 800 ms and waits for two stable snapshots before updating. Embedded frames, canvas-only boards, videos, and unrecognized markup need additional adapters. Compatibility depends on each site's current markup.

Starting from the initial position preserves legal move history, castling, and en passant. When joining midgame without a complete FEN, select the side to move and available castling rights under **Position setup & recovery**, then **Resync position**. Unknown en passant and earlier move counters are not reconstructed. Unsupported jumps require resync; full FEN sources can recover automatically. Clicking or playing in the studio pauses mirroring while source history continues to be captured. Use **Return to source** to catch up. PGN export contains the captured game only, not moves played before capture began.

## License

GPL-3.0-or-later, matching Stockfish.
