import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  console.log('Shared multiplayer integration test skipped (TEST_DATABASE_URL is not set).');
  process.exit(0);
}

const chrome = process.env.CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome');
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const dataDirs = [], servers = [];
let browser;

async function startServer() {
  const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-multi-instance-'));
  dataDirs.push(dataDir);
  const child = spawn(process.execPath, [join(root, 'server.js')], {
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, DATABASE_URL: databaseUrl, HEARTBEAT_MS: '1000' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  servers.push(child);
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  return new Promise((resolveServer, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server did not start: ${output}`)), 15000);
    child.once('message', (message) => {
      clearTimeout(timeout);
      resolveServer({ child, port: message.port });
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`server exited before readiness (${code}): ${output}`));
    });
  });
}

async function openSocket(page, port, id, name, room) {
  await page.goto(`http://127.0.0.1:${port}/api/hello`);
  await page.evaluate((url) => {
    window.wsEvents = [];
    window.gameSocket = new WebSocket(url);
    window.gameSocket.addEventListener('message', (event) => window.wsEvents.push(JSON.parse(event.data)));
  }, `ws://127.0.0.1:${port}/ws`);
  await page.waitForFunction(() => window.gameSocket.readyState === WebSocket.OPEN, { timeout: 8000 });
  await page.evaluate((join) => window.gameSocket.send(JSON.stringify(join)), {
    t: 'join', room, id, name, look: {}, x: 20, y: 13, dir: 0,
  });
}

async function waitForMessage(page, predicate, description) {
  const test = predicate.toString();
  try {
    await page.waitForFunction(`() => window.wsEvents.some(${test})`, { timeout: 8000 });
  } catch (error) {
    throw new Error(`timed out waiting for ${description}: ${error.message}`, { cause: error });
  }
  return page.evaluate(`() => window.wsEvents.find(${test})`);
}

try {
  const [serverA, serverB] = await Promise.all([startServer(), startServer()]);
  browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });
  const pageA = await browser.newPage(), pageB = await browser.newPage();
  const room = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'A');
  const idA = `player-${Math.random().toString(36).slice(2, 10)}`;
  const idB = `player-${Math.random().toString(36).slice(2, 10)}`;

  await openSocket(pageA, serverA.port, idA, 'Бат', room);
  const welcomeA = await waitForMessage(pageA, (message) => message.t === 'welcome', 'first player welcome');
  assert.deepEqual(welcomeA.players, [], 'first player starts alone');

  await openSocket(pageB, serverB.port, idB, 'Найз', room);
  const welcomeB = await waitForMessage(pageB, (message) => message.t === 'welcome', 'second player welcome');
  assert.ok(welcomeB.players.some((player) => player.id === idA), 'joining another server discovers the first player');
  await waitForMessage(pageA, (message) => message.t === 'join' && message.p.id === idB, 'cross-instance join');

  await pageB.evaluate(() => window.gameSocket.send(JSON.stringify({ t: 'move', x: 31, y: 16, dir: 2 })));
  await waitForMessage(pageA, (message) => message.t === 'move' && message.id === idB && message.x === 31, 'cross-instance movement');
  await pageA.evaluate(() => window.gameSocket.send(JSON.stringify({ t: 'say', k: 'p', i: 0 })));
  await waitForMessage(pageB, (message) => message.t === 'say' && message.id === idA && message.i === 0, 'cross-instance chat');

  await pageB.evaluate(() => window.gameSocket.close());
  await waitForMessage(pageA, (message) => message.t === 'leave' && message.id === idB, 'cross-instance disconnect');
  console.log('Shared multiplayer: two PostgreSQL-backed servers synchronize join, snapshot, movement, chat and leave.');
} finally {
  if (browser) await browser.close();
  for (const server of servers) {
    if (server.exitCode === null) {
      await new Promise((resolveExit) => {
        const timeout = setTimeout(() => { server.kill(); resolveExit(); }, 5000);
        server.once('exit', () => { clearTimeout(timeout); resolveExit(); });
        server.kill('SIGTERM');
      });
    }
  }
  for (const dataDir of dataDirs) rmSync(dataDir, { recursive: true, force: true });
}
