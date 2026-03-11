#!/usr/bin/env node
/**
 * mdstudio CLI
 * Usage:
 *   mdstudio report.md          # open file in browser
 *   cat file.md | mdstudio      # pipe markdown to browser
 *   mdstudio                    # open studio with empty editor
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

// ── Read content ───────────────────────────────────────────
async function readContent() {
  const file = process.argv[2];

  if (file) {
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved)) {
      console.error(`mdstudio: file not found: ${file}`);
      process.exit(1);
    }
    return fs.readFileSync(resolved, 'utf-8');
  }

  // Check if stdin has data (piped input)
  if (!process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', chunk => data += chunk);
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', reject);
    });
  }

  return null; // no content — just open studio
}

// ── Check if server is already running ────────────────────
function isServerRunning() {
  return new Promise(resolve => {
    http.get(`${BASE_URL}/`, res => {
      res.resume();
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

// ── Start server in background ─────────────────────────────
function startServer() {
  const serverPath = path.join(__dirname, '..', 'server.js');
  const { spawn } = require('child_process');
  const child = spawn('node', [serverPath], {
    env: { ...process.env, PORT: String(PORT) },
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // Wait until server responds
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function poll() {
      if (Date.now() - start > 5000) return reject(new Error('Server did not start in time'));
      http.get(`${BASE_URL}/`, res => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        setTimeout(poll, 200);
      }).on('error', () => setTimeout(poll, 200));
    }
    setTimeout(poll, 300);
  });
}

// ── Open browser ───────────────────────────────────────────
function openBrowser(url) {
  const platform = process.platform;
  try {
    if (platform === 'darwin')      execSync(`open "${url}"`);
    else if (platform === 'win32')  execSync(`start "" "${url}"`);
    else                            execSync(`xdg-open "${url}"`);
  } catch {
    console.log(`Open in browser: ${url}`);
  }
}

// ── Main ───────────────────────────────────────────────────
(async () => {
  const content = await readContent();

  let url = BASE_URL;
  if (content) {
    const encoded = Buffer.from(content, 'utf-8').toString('base64');
    url = `${BASE_URL}/#md=${encodeURIComponent(encoded)}`;
  }

  const running = await isServerRunning();
  if (!running) {
    process.stdout.write('Starting Markdown Studio server... ');
    await startServer();
    console.log('ready.');
  }

  openBrowser(url);
  console.log(`Markdown Studio → ${url.length > 80 ? url.slice(0, 77) + '...' : url}`);
})().catch(e => {
  console.error('mdstudio:', e.message);
  process.exit(1);
});
