# Stockfish teaching tools

Chess analysis tools built on Stockfish 19, for teaching.

| Folder | What it is |
| --- | --- |
| [`web-app/`](web-app/) | Analysis board that runs locally at http://localhost:8080 |
| [`extension/`](extension/) | Chrome / Edge extension with the same board built in and opt-in tracking of a selected chessboard tab. |
| [`Stockfish/`](Stockfish/) | The official Stockfish engine source, as a git submodule. For reference; the apps use the prebuilt WebAssembly engine from npm. |

## Setup

Install **Node.js 22 or newer** (including npm) and Git, then run:

```sh
git clone https://github.com/Hum2a/Stockfish.git
cd Stockfish
npm run setup
npm start
```

Open <http://localhost:8080>. `npm run setup` works on Windows, macOS, and Linux, before installing any dependencies. It installs exact app versions from the lockfile, creates `.env` from `.env.example` if missing, generates `web-app/vendor/`, builds `web-app/dist/` and `extension/dist/`, and runs the app and extension tests. Rerunning it preserves your existing `.env` and rebuilds generated files. Internet access is required for dependency downloads.

No API keys are required. The local server automatically reads the root `.env`; change `PORT` there if needed. Existing shell environment variables take priority. `.env` stays out of Git. Browser game history, Cloudflare credentials, and machine-specific caches are personal state, not shared setup files. Deployment caches under `deploy/.cloudflare/` are recreated by the deployment commands.

Allow free disk space on both the project drive and the npm cache drive for the engine and deployment-tool downloads. If installation fails, fix the reported issue and rerun the same setup command.

The upstream Stockfish Git submodule is reference source; the apps use the npm WebAssembly build. To fetch that source too, use `npm run setup -- --with-source`. Deployment tools are optional: `npm run setup -- --with-deploy` also installs exact versions from `deploy/package-lock.json`. For everything, including upstream source and deployment tools, run `npm run setup -- --with-deploy --with-source`. If you use nvm, `.nvmrc` selects Node 22. To load the extension in Chrome or Edge, see [Install the extension locally](extension/INSTALL.md).

After pulling updates:

```sh
git pull
npm run setup
```

Then reload the extension in `chrome://extensions`. Setup does not sign in or publish anything. To deploy, first run setup with `--with-deploy`; deploying requires your own Cloudflare authentication and adapting `deploy/cloudflare.config.ts` to a domain/account you control. The checked-in configuration targets the original project's domain.

## Commands (run from this folder)

| Command | Does |
| --- | --- |
| `npm run setup` | Installs dependencies, creates local configuration, generates both builds, and runs tests |
| `npm start` | Runs the web app at http://localhost:8080 |
| `npm run build` | Builds the loadable browser extension into `extension/dist/` |
| `npm run build:extension` | Same as `npm run build` |
| `npm run build:web` | Builds the website into `web-app/dist/` |
| `npm test` | Builds the extension, then runs every workspace's tests |

## Install the extension locally

Full walkthrough: [extension/INSTALL.md](extension/INSTALL.md)

```sh
npm install
npm run build
```

Then open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked**, and select the `extension/dist` folder.

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
