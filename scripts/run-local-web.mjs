import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, appendFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, request as httpRequest } from 'node:http';
import { createServer as createMutex } from 'node:net';
import { startGateway } from './local-web-gateway.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = path.join(root, '.local-data');
const port = Number(process.env.DC_WEB_PORT || 43127);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('DC_WEB_PORT must be between 1024 and 65535');
await mkdir(stateDir, { recursive: true });
if (process.platform === 'win32') {
  const protection = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/protect-local-data.ps1'), '-Path', stateDir], { windowsHide: true, encoding: 'utf8' });
  if (protection.status !== 0) throw new Error('Cannot protect local credentials: ' + (protection.stderr || protection.error?.message || 'ACL failed'));
}
const mutex = createMutex(socket => socket.destroy());
const mutexAddress = process.platform === 'win32'
  ? '\\\\.\\pipe\\DesktopCommanderLocal-' + createHash('sha256').update(root).digest('hex').slice(0, 16)
  : path.join(stateDir, 'launcher.sock');
await new Promise((resolve, reject) => { mutex.once('error', reject); mutex.listen(mutexAddress, resolve); });
const stateFile = path.join(stateDir, 'web-status.json');
const secretFile = path.join(stateDir, 'connection-secret.txt');
let secret;
try { secret = (await readFile(secretFile, 'utf8')).trim(); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
  secret = randomBytes(24).toString('base64url');
  await writeFile(secretFile, secret + '\n', { mode: 0o600, flag: 'wx' });
}
if (!/^[A-Za-z0-9_-]{32,}$/.test(secret)) throw new Error('Invalid local connection secret. Restore .local-data/connection-secret.txt.');

let tunnel;
let gateway;
let publicUrl = process.env.DC_PUBLIC_URL;
let frontend;
let closing = false;
let ownsState = false;
async function close(code = 0) {
  if (closing) return;
  closing = true;
  if (ownsState) await unlink(stateFile).catch(() => {});
  tunnel?.kill();
  if (frontend) await new Promise(resolve => { frontend.close(resolve); frontend.closeAllConnections(); });
  await gateway?.close().catch(() => {});
  await new Promise(resolve => mutex.close(resolve));
  process.exitCode = code;
}
process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());

try {
  // Bind the tunnel's origin before creating it, so an occupied port can never expose another service.
  frontend = createServer((req, res) => {
    if (!gateway || closing) { res.writeHead(503); res.end('Starting'); return; }
    const host = new URL(publicUrl).host;
    if (![host, `127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) { res.writeHead(403); res.end(); return; }
    // This gateway applies one shared rate limit; forwarded client IPs are deliberately not trusted.
    const incomingHost = String(req.headers.host ?? '');
    const localHost = incomingHost === `127.0.0.1:${port}` || incomingHost === `localhost:${port}`;
    const adminPath = String(req.url ?? '').split('?', 1)[0].startsWith('/admin');
    const headers = { ...req.headers, host };
    for (const name of ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-local-admin']) delete headers[name];
    if (localHost && adminPath) headers['x-local-admin'] = '1';
    const upstream = httpRequest({ hostname: '127.0.0.1', port: gateway.port, path: req.url, method: req.method, headers }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(503); res.end(); });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  });
  await new Promise((resolve, reject) => {
    frontend.once('error', reject);
    frontend.listen(port, '127.0.0.1', resolve);
  });
  if (!publicUrl) {
    const executable = path.join(root, 'local-bin', 'cloudflared.exe');
    if (!existsSync(executable)) throw new Error('Missing local-bin/cloudflared.exe. Run Setup-Local.ps1 first.');
    const emptyConfig = path.join(stateDir, 'cloudflared.yml');
    await writeFile(emptyConfig, '# Separate local quick tunnel configuration\n');
    console.log('Establishing a secure HTTPS connection...');
    tunnel = spawn(executable, ['tunnel', '--config', emptyConfig, '--url', `http://127.0.0.1:${port}`, '--protocol', 'http2', '--no-autoupdate'], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    publicUrl = await new Promise((resolve, reject) => {
      let buffer = '';
      const timeout = setTimeout(() => reject(new Error('Cloudflare did not return a URL within 45 seconds. See .local-data/tunnel.log.')), 45_000);
      const onOutput = data => {
        const chunk = data.toString();
        void appendFile(path.join(stateDir, 'tunnel.log'), chunk).catch(() => {});
        buffer = (buffer + chunk).slice(-16_384);
        const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) { clearTimeout(timeout); resolve(match[0]); }
      };
      tunnel.stdout.on('data', onOutput);
      tunnel.stderr.on('data', onOutput);
      tunnel.once('error', error => { clearTimeout(timeout); reject(error); });
      tunnel.once('exit', code => { clearTimeout(timeout); reject(new Error(`Cloudflare exited (${code}). See .local-data/tunnel.log.`)); });
    });
    tunnel.once('exit', () => {
      if (!closing) { console.error('HTTPS tunnel disconnected. Please restart UmiBridge.'); void close(1); }
    });
  }
  gateway = await startGateway({ port: 0, publicUrl, connectionSecret: secret, configDir: path.join(stateDir, 'profile') });
  gateway.closed.then(() => {
    if (!closing) { console.error('UmiBridge backend stopped. Please restart UmiBridge.'); void close(1); }
  });
  const endpoint = new URL('/mcp', publicUrl).href;
  const connectionText = [
    'UmiBridge · Sakura Console | ChatGPT MCP Bridge', '',
    `Server URL: ${endpoint}`,
    'Authentication: OAuth',
    'Client registration: Dynamic (DCR); leave client ID and secret blank', '',
    `Connection code (enter it on the UmiBridge authorization page): ${secret}`,
    `Local dashboard: http://127.0.0.1:${port}/admin`,
    'The dashboard is accessible only from this computer, not through the public tunnel.',
    'Never share your connection code in a chat.',
    'Keep this terminal running. Press Ctrl+C to stop.',
    'Cloudflare Quick Tunnel URLs may change after restart; update your ChatGPT connection.',
    '', '--- Tiếng Việt ---',
    `URL máy chủ: ${endpoint}`,
    'Xác thực: OAuth, đăng ký máy khách tự động (DCR).',
    `Mã kết nối (nhập tại trang xác thực UmiBridge): ${secret}`,
    `Trang quản trị trên máy: http://127.0.0.1:${port}/admin`,
    'Trang quản trị chỉ truy cập từ máy này, không qua tunnel công khai.',
    'Không chia sẻ mã kết nối trong cuộc trò chuyện.',
    'Giữ cửa sổ này mở. Nhấn Ctrl+C để dừng.',
    'Link Quick Tunnel có thể thay đổi khi khởi động lại; hãy cập nhật kết nối ChatGPT.',
  ].join('\\r\\n');
  await writeFile(path.join(stateDir, 'CONNECT.txt'), connectionText, { mode: 0o600 });
  await writeFile(stateFile, JSON.stringify({ pid: process.pid, tunnelPid: tunnel?.pid, port, publicUrl, endpoint, startedAt: new Date().toISOString() }, null, 2));
  ownsState = true;
  console.log('\n' + connectionText);
  console.log('\nSetup guide (English and Vietnamese): README.md');
} catch (error) {
  console.error(`Unable to start UmiBridge: ${error.message}`);
  await close(1);
}
