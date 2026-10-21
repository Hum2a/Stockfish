// Copies only the files the browser needs into dist/ for deployment to Cloudflare.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const files = ['index.html', 'app.js', 'engine.js', 'chess-utils.js', 'tracker.js', 'tracked-game.js', 'style.css'];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
for (const file of files) fs.copyFileSync(path.join(root, file), path.join(dist, file));
fs.cpSync(path.join(root, 'vendor'), path.join(dist, 'vendor'), { recursive: true });
console.log(`Site built in ${dist}`);
