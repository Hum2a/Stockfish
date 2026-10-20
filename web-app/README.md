# Stockfish Analysis Board

A local analysis board for teaching. Set up or paste any position, choose which side is to move, and Stockfish 19 shows the best move (arrow + notation), the evaluation, and its top lines.

## Run it

From the repo root:

```sh
npm install
npm start
```

Open <http://localhost:8080>. Everything runs on your computer; the engine is the Stockfish 19 WebAssembly build and needs no internet once installed.

## Features

- **Best move for either side**: use the *Side to move* switch to see what White or Black should play in the same position.
- **Play moves** by clicking or dragging. The engine updates after every move. Navigate with the arrow buttons or ← → / Home / End; press **F** to flip the board.
- **Set up position**: place any pieces with the editor. Impossible positions (missing kings, pawns on the back rank, the wrong side in check) are rejected with a reason.
- **FEN / PGN**: paste a FEN or a whole game. *Copy* puts the current FEN on the clipboard.
- **Share a position** with a link: `http://localhost:8080/?fen=<FEN>` opens straight into it (URL-encode the FEN).
- **Engine settings**: search depth 8–30 and 1, 3 or 5 lines.

## Tests

Run `npm test` from the repo root. The web app's tests cover the position/notation helpers, the engine's stop/restart handling, and a real Stockfish search.
