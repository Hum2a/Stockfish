# Install the extension locally

This loads the Stockfish analysis board from this repository. You do not need the Chrome Web Store.

## 1. Build it

Install **Node.js 22 or newer**, then in the repository root:

```sh
npm install
npm run build
```

When it works, the last lines look like:

```text
Extension built in:
  …\Stockfish\extension\dist
```

That `extension/dist` folder is what the browser loads. Do not pick `extension` or `extension/src`.

`npm run build` and `npm run build:extension` do the same thing. After you change code, run `npm run build` again.

## 2. Load it in the browser

### Chrome, Edge, or Brave

1. Open the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
2. Turn on **Developer mode** (top-right switch).
3. Click **Load unpacked**.
4. Select the `extension/dist` folder inside this repository, then confirm.
5. You should see **Stockfish Analysis Board** in the list, with no errors.
6. Optional: click the puzzle-piece icon in the toolbar and **pin** the extension.

### Check that it works

Click the extension icon, then **Open studio without tracking**. The analysis board should open. To follow a live game, open a Chess.com board tab, click the extension again, and choose **Start tracking**.

## Using it on Chess.com

Do not try to install the extension from Chess.com itself. After it is loaded unpacked:

1. Open a page that already shows a board, such as [chess.com/analysis](https://www.chess.com/analysis) or an in-progress game.
2. Click the Stockfish toolbar icon **on that tab**.
3. Choose **Start tracking**. If Chrome asks to allow access to chess.com, click **Allow**.

The Chess.com homepage, news pages, and Play lobby before a game starts have no board the extension can read.

## 3. After you change code

```sh
npm run build
```

Then on `chrome://extensions` (or Edge/Brave), click **Reload** on the Stockfish card. Tracking sessions do not survive a reload; start tracking again if you were following a board.

After `git pull`, run `npm install` if dependencies changed, then `npm run build`, then reload the extension.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| `Load unpacked` is missing | Turn on **Developer mode** first. |
| Manifest / file not found | You selected the wrong folder. Choose `extension/dist` (it must contain `manifest.json`). |
| Build fails with missing `vendor` or `chess.js` | From the repo root: `npm install`, then `npm run build`. |
| `Node.js 22 or newer is required` | Install Node 22+ (see `.nvmrc`) and open a new terminal. |
| Extension card shows an error after a rebuild | Click **Reload**. If it persists, **Remove** the extension and **Load unpacked** again. |
| Studio opens but the engine never starts | Rebuild (`npm run build`) and confirm `extension/dist/vendor/` contains the `.wasm` file, then reload. |
| Popup says no chessboard on Chess.com | Open [chess.com/analysis](https://www.chess.com/analysis) or a game that already shows pieces, then click the extension on **that** tab. Reload the unpacked extension after rebuilding. |

Firefox can load `extension/dist/manifest.json` as a temporary add-on from `about:debugging#/runtime/this-firefox`, but it is cleared when Firefox restarts. Chrome, Edge, and Brave are the supported local install path.
