import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-chat-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasTestPhrase = (chat) => Array.isArray(chat) && chat.some((line) => line.k === 'p' && line.id === 'chat-test-1' && line.i === 0);

async function waitForSavedPhrase() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (existsSync(join(dataDir, 'rooms.json'))) {
      const saved = JSON.parse(readFileSync(join(dataDir, 'rooms.json'), 'utf8'));
      if (saved.NUTAG && hasTestPhrase(saved.NUTAG.chat)) return saved;
    }
    await sleep(100);
  }
  throw new Error('the preset phrase was not written to the room data file');
}

async function startServer() {
  const server = spawn(process.execPath, [join(root, 'server.js')], {
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, DATABASE_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const port = await new Promise((resolvePort, reject) => {
    const timeout = setTimeout(() => {
      server.kill();
      reject(new Error('server did not start'));
    }, 8000);
    server.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.on('message', (message) => {
      if (message.port) {
        clearTimeout(timeout);
        resolvePort(message.port);
      }
    });
    server.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`server exited before startup (${code})`));
    });
  });
  return { server, port };
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  const exited = new Promise((resolveExit) => server.once('exit', resolveExit));
  server.kill();
  await exited;
}

async function joinAndReadChat(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  try {
    return await new Promise((resolveChat, reject) => {
      const timeout = setTimeout(() => reject(new Error('timed out waiting for welcome')), 5000);
      socket.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('websocket connection failed'));
      }, { once: true });
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ t: 'join', room: 'NUTAG', id: 'chat-test-1', name: 'Тест', look: {}, x: 20, y: 13 }));
      }, { once: true });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.t !== 'welcome') return;
        clearTimeout(timeout);
        resolveChat(message.chat);
      });
    });
  } finally {
    socket.close();
  }
}

let server;
try {
  let started = await startServer();
  server = started.server;
  const firstSocket = new WebSocket(`ws://127.0.0.1:${started.port}/ws`);
  await new Promise((resolveOpen, reject) => {
    const timeout = setTimeout(() => reject(new Error('timed out connecting to first server')), 5000);
    firstSocket.addEventListener('open', () => {
      clearTimeout(timeout);
      resolveOpen();
    }, { once: true });
    firstSocket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('first websocket connection failed'));
    }, { once: true });
  });
  firstSocket.send(JSON.stringify({ t: 'join', room: 'NUTAG', id: 'chat-test-1', name: 'Тест', look: {}, x: 20, y: 13 }));
  await new Promise((resolveSay, reject) => {
    const timeout = setTimeout(() => reject(new Error('timed out waiting for the preset phrase')), 5000);
    firstSocket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.t === 'welcome') {
        firstSocket.send(JSON.stringify({ t: 'say', k: 'p', i: 0 }));
      } else if (message.t === 'say' && message.id === 'chat-test-1') {
        clearTimeout(timeout);
        resolveSay();
      }
    });
  });
  const saved = await waitForSavedPhrase();
  if (!hasTestPhrase(saved.NUTAG.chat)) throw new Error('the saved room data did not include the test phrase');
  await new Promise((resolveClose) => {
    firstSocket.addEventListener('close', resolveClose, { once: true });
    firstSocket.close();
  });
  await stopServer(server);
  server = null;

  started = await startServer();
  server = started.server;
  const chat = await joinAndReadChat(started.port);
  if (!hasTestPhrase(chat)) {
    throw new Error(`the preset phrase was missing after restarting the server: ${JSON.stringify(chat)}`);
  }
  console.log('Chat persistence: recent preset phrase survives a server restart.');
} finally {
  if (server) await stopServer(server);
  rmSync(dataDir, { recursive: true, force: true });
}
