// Dependency-free bootstrap: works before npm install on Windows/macOS/Linux.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const allowed = new Set(['--with-deploy', '--with-source', '--help']);

function run(command, argv, label, cwd = root) {
  console.log(`\n${label}`);
  const result = spawnSync(command, argv, { cwd, stdio: 'inherit', shell: false });
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed${result.signal ? ` (${result.signal})` : ` (exit ${result.status})`}. Fix the error above and rerun npm run setup.`);
}

try {
  const unknown = args.find((arg) => !allowed.has(arg));
  if (unknown) throw new Error(`Unknown option: ${unknown}. Use npm run setup -- --help.`);
  if (args.includes('--help')) {
    console.log('npm run setup\n  Install locked app dependencies, create .env if missing, rebuild browser assets, and run tests.\n\nOptional flags (can be combined):\n  --with-deploy  Install locked Cloudflare deployment tools.\n  --with-source  Initialize the upstream Stockfish source submodule.');
  } else {
    if (Number(process.versions.node.split('.')[0]) < 22) throw new Error(`Node.js 22 or newer is required; found ${process.version}. Install a supported Node.js version; .nvmrc specifies version 22.`);
    // npm supplies its real JS entry point. Calling it through Node avoids
    // Windows .cmd spawning and shell quoting problems in paths with spaces.
    const npmCli = process.env.npm_execpath;
    if (!npmCli || !fs.existsSync(npmCli)) throw new Error('Run this bootstrap with npm run setup from the repository root.');
    if (args.includes('--with-source') && !fs.existsSync(path.join(root, '.git'))) throw new Error('--with-source requires a Git clone, not a downloaded source archive.');
    const npm = (argv, label, cwd = root) => run(process.execPath, [npmCli, ...argv], label, cwd);

    console.log(`Setting up Stockfish studio with Node ${process.versions.node}`);
    npm(['ci', '--include=dev'], '1/5 Install locked workspace dependencies');

    try {
      fs.copyFileSync(path.join(root, '.env.example'), path.join(root, '.env'), fs.constants.COPYFILE_EXCL);
      console.log('\nCreated .env from .env.example.');
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      console.log('\nKept your existing .env unchanged.');
    }

    // Explicit regeneration also repairs missing vendor files when npm's
    // lifecycle scripts have been disabled in the user's configuration.
    run(process.execPath, ['web-app/scripts/vendor.mjs'], '2/5 Generate chess.js and Stockfish browser assets');
    npm(['run', 'build', '-w', 'web-app'], '3/5 Build the website');
    npm(['run', 'build', '-w', 'extension'], '4/5 Build the browser extension');
    npm(['test', '--workspaces'], '5/5 Verify the app and extension');

    if (args.includes('--with-deploy')) {
      npm(['ci', '--include=dev'], 'Install optional locked deployment tools', path.join(root, 'deploy'));
    }

    if (args.includes('--with-source')) {
      run('git', ['submodule', 'update', '--init', '--recursive', '--depth', '1'], 'Initialize optional upstream Stockfish source');
    }

    console.log('\nSetup complete.\n\nStart the website: npm start\nServer settings: .env (PORT defaults to 8080)\nLoad the extension: chrome://extensions > Developer mode > Load unpacked');
    console.log(`Extension directory: ${path.join(root, 'extension', 'dist')}`);
    console.log('Website build: web-app/dist');
    console.log(args.includes('--with-deploy') ? '\nDeployment tools are installed.' : '\nOptional deployment tools: npm run setup -- --with-deploy');
    console.log('Deploying requires your own Cloudflare login and a domain/account configuration you control. Setup does not log in or deploy.\nAfter pulling updates, rerun npm run setup, then reload the unpacked extension.');
  }
} catch (err) {
  console.error(`\nSetup failed: ${err.message}`);
  process.exitCode = 1;
}
