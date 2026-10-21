// Assembles the loadable extension in dist/ from src/ plus the web app's board.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webApp = path.join(here, '..', 'web-app');
const dist = path.join(here, 'dist');
const vendorWasm = path.join(webApp, 'vendor', 'stockfish-19-lite-single.wasm');

function ensureVendor() {
  if (fs.existsSync(vendorWasm)) return;
  const vendorScript = path.join(webApp, 'scripts', 'vendor.mjs');
  console.log('web-app/vendor is missing. Generating it…');
  const result = spawnSync(process.execPath, [vendorScript], { cwd: webApp, stdio: 'inherit' });
  if (result.status !== 0 || !fs.existsSync(vendorWasm)) {
    console.error('Could not generate web-app/vendor. From the repository root, run:');
    console.error('  npm install');
    console.error('  npm run build');
    process.exit(1);
  }
}

ensureVendor();

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(here, 'src'), dist, { recursive: true });
fs.cpSync(path.join(webApp, 'vendor'), path.join(dist, 'vendor'), { recursive: true });
for (const file of ['app.js', 'engine.js', 'chess-utils.js', 'tracker.js', 'tracked-game.js', 'style.css']) {
  fs.copyFileSync(path.join(webApp, file), path.join(dist, file));
}
fs.copyFileSync(path.join(webApp, 'index.html'), path.join(dist, 'analysis.html'));

console.log(`\nExtension built in:\n  ${dist}\n`);
console.log('Load this folder as an unpacked extension:');
console.log('  Chrome: chrome://extensions  → Developer mode → Load unpacked');
console.log('  Edge:   edge://extensions    → Developer mode → Load unpacked');
console.log('Step-by-step guide: extension/INSTALL.md');
