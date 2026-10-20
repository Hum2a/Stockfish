// Copies the browser files the app needs out of the installed packages into vendor/.
// Runs automatically after `npm install`. Packages are located through Node's
// resolver, so this works whether they are hoisted to the monorepo root or not.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const pkgDir = (name) => path.dirname(require.resolve(`${name}/package.json`));
const chessJs = pkgDir('chess.js');
const stockfish = pkgDir('stockfish');

const files = {
  [path.join(chessJs, 'dist/esm/chess.js')]: 'chess.js',
  [path.join(stockfish, 'bin/stockfish-19-lite-single.js')]: 'stockfish-19-lite-single.js',
  [path.join(stockfish, 'bin/stockfish-19-lite-single.wasm')]: 'stockfish-19-lite-single.wasm',
  [path.join(stockfish, 'Copying.txt')]: 'STOCKFISH-COPYING.txt',
};

fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
for (const [from, to] of Object.entries(files)) {
  fs.copyFileSync(from, path.join(root, 'vendor', to));
}
console.log(`Copied ${Object.keys(files).length} files into web-app/vendor/`);
