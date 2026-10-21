// Assembles the loadable extension in dist/ from src/ plus the web app's board.
// Run `npm install` in ../web-app first so its vendor/ folder exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webApp = path.join(here, '..', 'web-app');
const dist = path.join(here, 'dist');

if (!fs.existsSync(path.join(webApp, 'vendor', 'stockfish-19-lite-single.wasm'))) {
  console.error('web-app/vendor is missing. Run `npm install` in the web-app folder first.');
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(here, 'src'), dist, { recursive: true });
fs.cpSync(path.join(webApp, 'vendor'), path.join(dist, 'vendor'), { recursive: true });
for (const file of ['app.js', 'engine.js', 'chess-utils.js', 'tracker.js', 'tracked-game.js', 'style.css']) {
  fs.copyFileSync(path.join(webApp, file), path.join(dist, file));
}
fs.copyFileSync(path.join(webApp, 'index.html'), path.join(dist, 'analysis.html'));

console.log(`Extension built in ${dist}`);
console.log('Load it from chrome://extensions (or edge://extensions) > Developer mode > Load unpacked.');
