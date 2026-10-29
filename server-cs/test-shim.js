// Runs the C# server for the Node tests (tests/*.mjs): they spawn this file as they spawn server/server.js and wait for its
// { port } over IPC. Use: dotnet build server-cs, then NAADAMY_SERVER=server-cs/test-shim.js node tests/<test>.mjs
// Killing this process closes the server's stdin, and the server then saves and stops (Windows has no SIGTERM to pass on).
'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');

const dll = path.join(__dirname, 'bin', 'Debug', 'net10.0', 'Naadamy.Server.dll');
const child = spawn('dotnet', [dll], { env: { ...process.env, NAADAMY_STOP_ON_STDIN_EOF: '1' }, stdio: ['pipe', 'pipe', 'inherit'] });
let out = '', sent = false;
child.stdout.on('data', (d) => {
  out += d;
  const m = /http:\/\/localhost:(\d+)/.exec(out);
  if (m && !sent && process.send) { sent = true; process.send({ port: Number(m[1]) }); }
});
child.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.stdin.end());
