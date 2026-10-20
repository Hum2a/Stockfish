# Stockfish teaching tools

Chess analysis tools built on Stockfish 19, for teaching.

| Folder | What it is |
| --- | --- |
| [`web-app/`](web-app/) | Analysis board that runs locally at http://localhost:8080 |
| [`extension/`](extension/) | Chrome / Edge extension with the same board built in. It has no access to websites (see its README for the fair-play design). |
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

## License

GPL-3.0-or-later, matching Stockfish.
