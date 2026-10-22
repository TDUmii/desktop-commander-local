import express from 'express';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { InvalidClientMetadataError, InvalidGrantError, InvalidScopeError, InvalidTargetError, InvalidTokenError, TooManyRequestsError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListResourceTemplatesRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createRequestHistory, createChatLinksStore, renderAdminPage } from './local-admin.mjs';
import { createSkillLibrary, RECOMMENDED_SKILLS } from './skill-library.mjs';
import { createOAuthState } from './oauth-state.mjs';
import { createDeviceRegistry } from './device-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const randomToken = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest();
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isLoopback = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
const sameResource = (a, b) => String(a).replace(/\/$/, '') === String(b).replace(/\/$/, '');
const contentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

const deviceToolDefinitions = [
  { name: 'list_devices', description: 'List linked Windows agents and their online status.', properties: {}, required: [] },
  { name: 'get_device_status', description: 'Get status and capabilities for one linked Windows agent.', properties: { device_id: { type: 'string', description: 'Linked device ID.' } }, required: ['device_id'] },
  { name: 'get_job_status', description: 'Get the status and result of a remote device job.', properties: { job_id: { type: 'string', description: 'Remote job ID.' } }, required: ['job_id'] },
  { name: 'run_on_device', operation: 'run_command', description: 'Run a PowerShell command on a linked Windows device and return its real stdout, stderr and exit code.', properties: { device_id: { type: 'string' }, command: { type: 'string' }, cwd: { type: 'string' }, timeout_ms: { type: 'integer', minimum: 1000, maximum: 120000 } }, required: ['device_id', 'command'] },
  { name: 'read_file_on_device', operation: 'read_file', description: 'Read a text file from a linked Windows device.', properties: { device_id: { type: 'string' }, path: { type: 'string' }, offset: { type: 'integer', minimum: 0 }, length: { type: 'integer', minimum: 1, maximum: 10000 } }, required: ['device_id', 'path'] },
  { name: 'write_file_on_device', operation: 'write_file', description: 'Create or overwrite a text file on a linked Windows device.', properties: { device_id: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' }, mode: { type: 'string', enum: ['rewrite', 'append'] } }, required: ['device_id', 'path', 'content'] },
  { name: 'edit_block_on_device', operation: 'edit_block', description: 'Replace one matching text block on a linked Windows device.', properties: { device_id: { type: 'string' }, path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' } }, required: ['device_id', 'path', 'old_string', 'new_string'] },
  { name: 'list_directory_on_device', operation: 'list_directory', description: 'List a directory on a linked Windows device.', properties: { device_id: { type: 'string' }, path: { type: 'string' }, max_entries: { type: 'integer', minimum: 1, maximum: 1000 } }, required: ['device_id', 'path'] },
  { name: 'create_directory_on_device', operation: 'create_directory', description: 'Create a directory on a linked Windows device.', properties: { device_id: { type: 'string' }, path: { type: 'string' } }, required: ['device_id', 'path'] },
  { name: 'move_file_on_device', operation: 'move_file', description: 'Move or rename a file on a linked Windows device.', properties: { device_id: { type: 'string' }, source: { type: 'string' }, destination: { type: 'string' } }, required: ['device_id', 'source', 'destination'] },
  { name: 'get_file_info_on_device', operation: 'get_file_info', description: 'Get metadata for a file or directory on a linked Windows device.', properties: { device_id: { type: 'string' }, path: { type: 'string' } }, required: ['device_id', 'path'] },
  { name: 'search_files_on_device', operation: 'search_files', description: 'Search text in files on a linked Windows device.', properties: { device_id: { type: 'string' }, path: { type: 'string' }, query: { type: 'string' }, file_pattern: { type: 'string' }, max_results: { type: 'integer', minimum: 1, maximum: 500 } }, required: ['device_id', 'path', 'query'] },
];
const deviceToolSpecs = deviceToolDefinitions.map(spec => {
  const { operation, properties, required, ...metadata } = spec;
  return {
    ...metadata,
    annotations: { readOnlyHint: !operation || ['read_file', 'list_directory', 'get_file_info', 'search_files'].includes(operation), destructiveHint: Boolean(operation && !['read_file', 'list_directory', 'get_file_info', 'search_files'].includes(operation)), idempotentHint: !operation || ['read_file', 'list_directory', 'get_file_info', 'search_files', 'get_file_info'].includes(operation), openWorldHint: operation === 'run_command' },
    inputSchema: { type: 'object', additionalProperties: false, properties, required },
  };
});
const deviceToolsByName = new Map(deviceToolDefinitions.map(tool => [tool.name, tool]));

/** One local process shared by authorized MCP clients through an authenticated endpoint. */
export async function startGateway({ port = 8767, publicUrl, connectionSecret, configDir, geminiPairingSecret } = {}) {
  if (typeof connectionSecret !== 'string' || connectionSecret.length < 24) {
    throw new Error('connectionSecret must contain at least 24 characters.');
  }
  if (!configDir) throw new Error('An isolated configDir is required.');
  if (geminiPairingSecret !== undefined && (typeof geminiPairingSecret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(geminiPairingSecret))) {
    throw new Error('geminiPairingSecret must contain 32 random bytes encoded as base64url.');
  }
  const issuer = new URL(publicUrl);
  if ((issuer.protocol !== 'https:' && !(issuer.protocol === 'http:' && isLoopback(issuer.hostname))) ||
      issuer.username || issuer.password || issuer.search || issuer.hash || issuer.pathname !== '/') {
    throw new Error('publicUrl must be an HTTPS origin (HTTP loopback is allowed for local tests).');
  }
  const resource = new URL('/mcp', issuer);
  const secretHash = digest(connectionSecret);
  const geminiPairingPath = geminiPairingSecret ? `/gemini/${geminiPairingSecret}/mcp` : undefined;
  const pairedRequests = new WeakSet();
  const requestHistory = await createRequestHistory(resolve(configDir, '..', 'request-history.jsonl'), { secretValues: [connectionSecret, geminiPairingSecret] });
  connectionSecret = undefined;
  geminiPairingSecret = undefined;
  const chatLinks = await createChatLinksStore(resolve(configDir, '..', 'chat-links.json'));
  const deviceRegistry = await createDeviceRegistry({ stateDir: resolve(configDir, '..') });
  const skillLibrary = createSkillLibrary({ stateDir: resolve(configDir, '..'), projectDir: ROOT });
  const oauthState = createOAuthState(resolve(configDir, '..', 'oauth-state.json'), issuer.href);
  const { clients, access, refresh } = oauthState;
  const pending = new Map(), codes = new Map();
  const stores = [clients, pending, codes, access, refresh];
  const sweep = () => {
    oauthState.assertHealthy();
    for (const store of stores) for (const [key, value] of store) if (value.expiresAt <= Date.now()) store.delete(key);
  };
  const requireCapacity = store => {
    sweep();
    if (store.size >= 1000) throw new TooManyRequestsError('Too many active requests.');
  };
  const checkResource = requested => {
    if (requested && !sameResource(requested, resource)) throw new InvalidTargetError('Unknown resource.');
  };
  const checkScopes = scopes => {
    if (scopes?.some(scope => !['desktop', 'offline_access'].includes(scope))) throw new InvalidScopeError('Unknown scope.');
    return ['desktop', ...(scopes?.includes('offline_access') ? ['offline_access'] : [])];
  };
  const grantFor = (store, key, client) => {
    sweep();
    const grant = store.get(key);
    if (!grant || grant.clientId !== client.client_id) throw new InvalidGrantError('Invalid or expired grant.');
    return grant;
  };
  const issueTokens = (client, scopes, allowRefresh = client.grant_types?.includes('refresh_token') || scopes.includes('offline_access')) => {
    requireCapacity(access); requireCapacity(refresh);
    const clientId = client.client_id;
    const accessToken = randomToken(), refreshToken = allowRefresh ? randomToken() : undefined;
    access.set(accessToken, { clientId, scopes, refreshToken, expiresAt: Date.now() + 15 * 60_000 });
    if (refreshToken) refresh.set(refreshToken, { clientId, scopes, accessToken, expiresAt: Date.now() + 30 * 24 * 60 * 60_000 });
    clients.get(clientId).expiresAt = Date.now() + 365 * 24 * 60 * 60_000;
    oauthState.save();
    return { access_token: accessToken, token_type: 'Bearer', expires_in: 900, refresh_token: refreshToken, scope: scopes.join(' ') };
  };
  const revoke = (store, key) => {
    const grant = store.get(key);
    if (!grant) return;
    access.delete(grant.accessToken ?? key);
    refresh.delete(grant.refreshToken ?? key);
  };
  const consentPage = (id, request, message = '') => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect to UmiBridge</title><style>body{font:17px/1.6 system-ui;background:#f3f5f7;color:#17202a;padding:36px 20px}main{max-width:540px;margin:auto;background:white;border:1px solid #d6dde3;border-radius:18px;padding:30px}h1{font-size:26px;line-height:1.3}label,input,button{display:block;width:100%;box-sizing:border-box}input,button{font:inherit;padding:12px;border-radius:8px;border:1px solid #8d9ba7}button{margin-top:18px;background:#155bcc;color:white;cursor:pointer}small{overflow-wrap:anywhere;color:#475867}.error{color:#a71919}</style><main><h1>Connect to your computer</h1><p lang="vi">Kết nối với máy tính của bạn</p><p><strong>${escapeHtml(request.client.client_name || 'MCP application')}</strong> wants to read or modify files and execute commands on this computer.</p><p lang="vi">Ứng dụng này yêu cầu quyền đọc, sửa tệp và chạy lệnh trên máy tính của bạn.</p><p>Only authorize this connection if you initiated it yourself.</p><p lang="vi">Chỉ cấp quyền nếu chính bạn đã chủ động thêm kết nối này.</p><small>OAuth redirect URL / Địa chỉ chuyển hướng: ${escapeHtml(request.params.redirectUri)}</small>${message ? `<p class="error" role="alert">${escapeHtml(message)}</p>` : ''}<form method="post" action="/consent"><input type="hidden" name="requestId" value="${id}"><p><label for="secret">Connection code from the UmiBridge terminal (mã kết nối trong cửa sổ UmiBridge)</label><input id="secret" name="secret" type="password" autocomplete="off" required autofocus maxlength="256"></p><button type="submit">Authorize connection / Cho phép kết nối</button></form></main></html>`;
  const sendConsent = (res, id, request, message) => {
    // Chromium also applies form-action to the final redirect after a form POST.
    const callbackOrigin = new URL(request.params.redirectUri).origin;
    res.set('Content-Security-Policy', contentSecurityPolicy.replace("form-action 'self'", `form-action 'self' ${callbackOrigin}`));
    res.type('html').send(consentPage(id, request, message));
  };

  const provider = {
    clientsStore: {
      getClient(clientId) { sweep(); return clients.get(clientId)?.client; },
      registerClient(client) {
        if (!client.redirect_uris?.length || client.redirect_uris.length > 10) throw new InvalidClientMetadataError('Invalid redirect URIs.');
        for (const uri of client.redirect_uris) {
          const url = new URL(uri);
          if ((url.protocol !== 'https:' && !(isLoopback(issuer.hostname) && url.protocol === 'http:' && isLoopback(url.hostname))) || url.hash || url.username || url.password) {
            throw new InvalidClientMetadataError('Redirect URIs must use HTTPS.');
          }
        }
        requireCapacity(clients);
        const registered = { ...client, client_id: randomToken(), client_id_issued_at: Math.floor(Date.now() / 1000) };
        clients.set(registered.client_id, { client: registered, expiresAt: Date.now() + 365 * 24 * 60 * 60_000 });
        oauthState.save();
        return registered;
      }
    },
    async authorize(client, params, res) {
      checkResource(params.resource); params.scopes = checkScopes(params.scopes);
      requireCapacity(pending);
      const id = randomToken(), csrf = randomToken();
      const request = { client, params, csrf, attempts: 0, expiresAt: Date.now() + 5 * 60_000 };
      pending.set(id, request);
      res.cookie('dc_authorize', csrf, { httpOnly: true, secure: issuer.protocol === 'https:', sameSite: 'lax', maxAge: 5 * 60_000, path: '/consent' });
      sendConsent(res, id, request);
    },
    async challengeForAuthorizationCode(client, code) { return grantFor(codes, code, client).codeChallenge; },
    async exchangeAuthorizationCode(client, code, _verifier, redirectUri, requestedResource) {
      const grant = grantFor(codes, code, client);
      codes.delete(code); // Consume before issuing; replay and redirect failures cannot reuse it.
      if (redirectUri !== grant.redirectUri) throw new InvalidGrantError('Redirect URI does not match.');
      checkResource(requestedResource);
      return issueTokens(client, grant.scopes);
    },
    async exchangeRefreshToken(client, token, scopes, requestedResource) {
      const grant = grantFor(refresh, token, client);
      checkResource(requestedResource);
      if (scopes?.some(scope => !grant.scopes.includes(scope))) throw new InvalidScopeError('Cannot extend granted scopes.');
      const effectiveScopes = [...new Set(scopes ?? grant.scopes)];
      if (!effectiveScopes.includes('desktop')) throw new InvalidScopeError('The desktop scope is required.');
      revoke(refresh, token);
      return issueTokens(client, effectiveScopes, true);
    },
    async verifyAccessToken(token) {
      sweep();
      const grant = access.get(token);
      if (!grant) throw new InvalidTokenError('Invalid or expired access token.');
      return { token, clientId: grant.clientId, scopes: grant.scopes, expiresAt: Math.floor(grant.expiresAt / 1000), resource };
    },
    async revokeToken(client, request) {
      for (const store of [access, refresh]) if (store.get(request.token)?.clientId === client.client_id) revoke(store, request.token);
      oauthState.save();
    }
  };

  const backendTransport = new StdioClientTransport({
    command: process.execPath, args: [resolve(ROOT, 'scripts/chatgpt-backend.mjs')], cwd: ROOT, stderr: 'pipe',
    env: { CHATGPT_LOCAL_ONLY: '1', CHATGPT_LOCAL_CONFIG_DIR: resolve(configDir) }
  });
  // The backend may include file contents in diagnostics. Never relay them to public responses or gateway logs.
  backendTransport.stderr?.resume();
  const backend = new Client({ name: 'umibridge-local-web', version: '0.1.0-beta.6' });
  let backendAlive = true, closing = false, httpServer, closePromise;
  let resolveClosed;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const connections = new Set();
  const close = () => closePromise ??= (async () => {
    closing = true; backendAlive = false;
    for (const store of stores) store.clear();
    await Promise.allSettled([...connections].map(server => server.close()));
    if (httpServer) await new Promise(resolve => { httpServer.close(resolve); httpServer.closeAllConnections(); });
    await deviceRegistry.close().catch(() => {});
    await backend.close().catch(() => {});
    resolveClosed();
  })();
  backend.onclose = () => { backendAlive = false; if (!closing) void close(); };
  backend.onerror = () => { backendAlive = false; if (!closing) void close(); };
  try {
    await backend.connect(backendTransport, { timeout: 30_000 });
    // Ensure the upstream is usable before exposing any HTTP endpoint.
    await backend.listTools({}, { timeout: 30_000 });
    const capabilities = backend.getServerCapabilities() ?? {};
    const app = express();
    app.disable('x-powered-by');
    if (process.env.UMIBRIDGE_MCP_DIAGNOSTICS === '1') app.use((req, res, next) => {
      const path = req.path;
      if (path === '/mcp' || path.startsWith('/mcp/') || path === '/gemini' || path.startsWith('/gemini/')) {
        const route = path === '/mcp' || path.startsWith('/mcp/') ? 'mcp' : path === geminiPairingPath ? 'paired' : 'unknown-paired';
        res.once('finish', () => {
          const accept = String(req.headers.accept ?? '');
          const protocolVersion = String(req.headers['mcp-protocol-version'] ?? '');
          console.error('[umibridge-mcp]', JSON.stringify({
            httpMethod: ['GET', 'POST', 'DELETE', 'OPTIONS', 'HEAD', 'PUT', 'PATCH'].includes(req.method) ? req.method : 'other',
            route,
            rpcMethod: ['initialize', 'notifications/initialized', 'tools/list', 'tools/call'].includes(req.body?.method) ? req.body.method : 'other',
            statusCode: res.statusCode,
            acceptsJson: accept.includes('application/json'), acceptsSse: accept.includes('text/event-stream'),
            isJson: /^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] ?? '')),
            protocolVersion: /^\d{4}-\d{2}-\d{2}$/.test(protocolVersion) ? protocolVersion : 'other',
          }));
        });
      }
      next();
    });
    app.use((req, res, next) => {
      const boundPort = httpServer?.address()?.port ?? port;
      if (![issuer.host, `127.0.0.1:${boundPort}`, `localhost:${boundPort}`].includes(req.headers.host)) return res.sendStatus(403);
      res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': contentSecurityPolicy });
      if (!backendAlive) return res.status(503).json({ error: 'backend_unavailable' });
      next();
    });
    const agentKeyFrom = req => {
      const bearer = String(req.headers.authorization ?? '');
      return String(req.headers['x-umi-agent-key'] ?? '').trim() || (bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : '');
    };
    const agentError = (res, cause) => {
      const message = cause instanceof Error ? cause.message : String(cause);
      const status = /credential|unknown device|unknown job|revoked/i.test(message) ? 401 : 400;
      res.status(status).json({ error: message });
    };
    const resultValue = result => {
      const first = result?.content?.find(item => item?.type === 'text')?.text;
      if (typeof first !== 'string') return result ?? null;
      try { return JSON.parse(first); } catch { return first; }
    };
    const callDeviceTool = async (name, args = {}) => {
      const spec = deviceToolsByName.get(name);
      if (!spec) throw new Error(`Unknown device tool: ${name}`);
      if (name === 'list_devices') return { content: [{ type: 'text', text: JSON.stringify(deviceRegistry.listDevices(), null, 2) }] };
      if (name === 'get_device_status') return { content: [{ type: 'text', text: JSON.stringify(deviceRegistry.getDevice(args.device_id), null, 2) }] };
      if (name === 'get_job_status') return { content: [{ type: 'text', text: JSON.stringify(deviceRegistry.getJob(args.job_id), null, 2) }] };
      const { device_id: deviceId, ...operationArgs } = args;
      const job = await deviceRegistry.enqueue(deviceId, spec.operation, operationArgs);
      const waitMs = spec.operation === 'run_command'
        ? Math.min(Math.max(Number(operationArgs.timeout_ms) || 120_000, 1_000) + 5_000, 120_000)
        : 30_000;
      const completed = await deviceRegistry.waitForJob(job.jobId, waitMs);
      const device = deviceRegistry.getDevice(deviceId);
      if (!completed) {
        return { content: [{ type: 'text', text: JSON.stringify({ job_id: job.jobId, device_id: deviceId, hostname: device.hostname, status: 'running', timed_out: true }, null, 2) }] };
      }
      const envelope = { job_id: completed.job_id, device_id: deviceId, hostname: device.hostname, status: completed.status, result: resultValue(completed.result), error: completed.error };
      const content = [{ type: 'text', text: JSON.stringify(envelope, null, 2) }];
      return completed.status === 'failed' ? { isError: true, content } : { content };
    };
    const agentJson = express.json({ limit: '32kb' });
    app.post('/agent/pair', agentJson, async (req, res) => {
      try { res.json(await deviceRegistry.pair(req.body)); }
      catch (cause) { agentError(res, cause); }
    });
    app.post('/agent/poll', agentJson, async (req, res) => {
      try { res.json(await deviceRegistry.poll({ ...req.body, agentKey: agentKeyFrom(req) })); }
      catch (cause) { agentError(res, cause); }
    });
    app.post('/agent/result', agentJson, async (req, res) => {
      try { res.json(await deviceRegistry.result({ ...req.body, agentKey: agentKeyFrom(req) })); }
      catch (cause) { agentError(res, cause); }
    });
    app.post('/agent/heartbeat', agentJson, async (req, res) => {
      try { res.json(await deviceRegistry.heartbeat({ ...req.body, agentKey: agentKeyFrom(req) })); }
      catch (cause) { agentError(res, cause); }
    });
    app.get('/health', (_req, res) => res.json({ ok: true }));
    const localAdmin = (req, res, next) => {
      const directLoopback = issuer.protocol === 'http:' && isLoopback(req.hostname);
      if (req.headers['x-local-admin'] !== '1' && !directLoopback) return res.sendStatus(404);
      next();
    };
    app.get('/admin', localAdmin, (_req, res) => {
      res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
      res.type('html').send(renderAdminPage());
    });
    app.get('/admin/i18n.js', localAdmin, (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.type('application/javascript').send(readFileSync(new URL('./admin-i18n.js', import.meta.url), 'utf8'));
    });
    const startedAt = Date.now();
    app.get('/admin/api/requests', localAdmin, (_req, res) => res.json({
      stats: requestHistory.stats(), requests: requestHistory.list(),
      runtime: { startedAt: new Date(startedAt).toISOString(), uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), endpoint: resource.href, localOnly: true }
    }));
    app.get('/admin/api/chats', localAdmin, (_req, res) => res.json({ links: chatLinks.list() }));
    app.get('/admin/api/skills', localAdmin, async (_req, res) => {
      try { res.json({ skills: await skillLibrary.list(), recommended: RECOMMENDED_SKILLS }); }
      catch { res.status(500).json({ error: 'Unable to load local skills.' }); }
    });
    app.get('/admin/api/skills/:name', localAdmin, async (req, res) => {
      try {
        const skill = await skillLibrary.read(req.params.name);
        res.json(skill);
      } catch (error) { res.status(400).json({ error: error.message }); }
    });
    // This header is a browser CSRF barrier: a third-party page cannot set it without CORS preflight.
    const adminWrite = (req, res, next) => req.headers['x-dc-admin-action'] === '1' ? next() : res.sendStatus(403);
    app.get('/admin/api/devices', localAdmin, (_req, res) => res.json({ devices: deviceRegistry.listDevices(), jobs: deviceRegistry.listJobs({ limit: 100 }) }));
    app.post('/admin/api/devices/pairing', localAdmin, adminWrite, express.json({ limit: '2kb' }), async (req, res) => {
      try { res.json(await deviceRegistry.createPairing(req.body?.label)); }
      catch (cause) { res.status(400).json({ error: cause.message }); }
    });
    app.post('/admin/api/devices/:deviceId/revoke', localAdmin, adminWrite, async (req, res) => {
      try { res.json(await deviceRegistry.revokeDevice(req.params.deviceId)); }
      catch (cause) { res.status(400).json({ error: cause.message }); }
    });
    app.get('/admin/api/jobs/:jobId', localAdmin, (req, res) => {
      try { res.json(deviceRegistry.getJob(req.params.jobId)); }
      catch (cause) { res.status(404).json({ error: cause.message }); }
    });
    const skillJson = express.json({ limit: '2kb' });
    app.post('/admin/api/skills', localAdmin, adminWrite, skillJson, async (req, res) => {
      try { res.json({ ok: true, skill: await skillLibrary.add(req.body?.folder) }); }
      catch (error) { res.status(400).json({ error: error.message }); }
    });
    app.post('/admin/api/skills/enable', localAdmin, adminWrite, skillJson, async (req, res) => {
      try { res.json({ ok: true, skill: await skillLibrary.setEnabled(req.body?.name, req.body?.enabled) }); }
      catch (error) { res.status(400).json({ error: error.message }); }
    });
    app.post('/admin/api/skills/remove', localAdmin, adminWrite, skillJson, async (req, res) => {
      try { res.json({ ok: true, skill: await skillLibrary.remove(req.body?.name) }); }
      catch (error) { res.status(400).json({ error: error.message }); }
    });
    app.post('/admin/api/chats', localAdmin, adminWrite, express.json({ limit: '2kb' }), async (req, res) => {
      try {
        if (!requestHistory.has(req.body?.requestId)) return res.status(404).json({ error: 'Request is no longer in local history.' });
        const link = await chatLinks.set(req.body.requestId, req.body.chatUrl);
        res.json({ ok: true, link });
      } catch (error) { res.status(400).json({ error: error.message }); }
    });
    app.post('/admin/api/chats/unlink', localAdmin, adminWrite, express.json({ limit: '2kb' }), async (req, res) => {
      const requestId = req.body?.requestId;
      if (typeof requestId !== 'string' || requestId.length > 120) return res.sendStatus(400);
      await chatLinks.unlink(requestId);
      res.json({ ok: true });
    });
    app.post('/admin/api/clear', localAdmin, async (_req, res) => {
      await requestHistory.clear();
      await chatLinks.clear();
      res.json({ ok: true });
    });
    // Shared limit intentionally counts all tunnel requests together on this single-user server.
    let failedWindow = Date.now(), failedAttempts = 0;
    app.post('/consent', express.urlencoded({ extended: false, limit: '4kb' }), (req, res) => {
      sweep();
      const request = pending.get(req.body.requestId);
      const cookie = String(req.headers.cookie ?? '').split(';').map(v => v.trim()).find(v => v.startsWith('dc_authorize='))?.slice(13);
      if (!request || cookie !== request.csrf || (req.headers.origin && req.headers.origin !== issuer.origin)) return res.status(400).send('Invalid or expired authorization request. Please reconnect.');
      if (Date.now() - failedWindow > 15 * 60_000) { failedWindow = Date.now(); failedAttempts = 0; }
      if (failedAttempts >= 10 || request.attempts >= 5) return res.status(429).send('Too many incorrect attempts. Please retry after 15 minutes.');
      const supplied = typeof req.body.secret === 'string' ? req.body.secret : '';
      if (!timingSafeEqual(secretHash, digest(supplied))) {
        failedAttempts++; request.attempts++;
        res.status(401);
        return sendConsent(res, req.body.requestId, request, 'Incorrect connection code. / Mã kết nối chưa đúng.');
      }
      pending.delete(req.body.requestId);
      requireCapacity(codes);
      const code = randomToken();
      codes.set(code, { clientId: request.client.client_id, codeChallenge: request.params.codeChallenge, redirectUri: request.params.redirectUri, scopes: request.params.scopes, expiresAt: Date.now() + 60_000 });
      const redirect = new URL(request.params.redirectUri);
      redirect.searchParams.set('code', code);
      if (request.params.state !== undefined) redirect.searchParams.set('state', request.params.state);
      res.clearCookie('dc_authorize', { path: '/consent', httpOnly: true, secure: issuer.protocol === 'https:', sameSite: 'lax' });
      res.redirect(302, redirect.href);
    });
    app.use(mcpAuthRouter({ provider, issuerUrl: issuer, resourceServerUrl: resource, scopesSupported: ['desktop', 'offline_access'], resourceName: 'UmiBridge Sakura Console', clientRegistrationOptions: { clientSecretExpirySeconds: 0 } }));
    app.use('/mcp', requireBearerAuth({ verifier: provider, requiredScopes: ['desktop'], expectedResource: resource, resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource) }));
    const handleMcp = async (req, res) => {
      const server = new Server({ name: 'umibridge-sakura-console', version: '0.1.0-beta.12' }, { capabilities: { tools: {}, ...(capabilities.resources ? { resources: {} } : {}) }, instructions: backend.getInstructions?.() });
      const options = { timeout: 120_000 };
      server.setRequestHandler(ListToolsRequestSchema, async request => {
        const listed = await backend.listTools(request.params, options);
        return { ...listed, tools: [...(listed.tools ?? []), ...deviceToolSpecs] };
      });
      server.setRequestHandler(CallToolRequestSchema, async request => {
        const startedAt = performance.now();
        const clientName = pairedRequests.has(req) ? 'Gemini (paired URL)' : clients.get(req.auth?.clientId)?.client.client_name;
        try {
          const result = deviceToolsByName.has(request.params.name)
            ? await callDeviceTool(request.params.name, request.params.arguments ?? {})
            : await backend.callTool(request.params, undefined, options);
          await requestHistory.add(request.params.name, request.params.arguments, result, performance.now() - startedAt, clientName);
          return result;
        } catch (error) {
          await requestHistory.add(request.params.name, request.params.arguments, { isError: true, content: [] }, performance.now() - startedAt, clientName);
          throw error;
        }
      });
      if (capabilities.resources) {
        server.setRequestHandler(ListResourcesRequestSchema, request => backend.listResources(request.params, options));
        server.setRequestHandler(ReadResourceRequestSchema, request => backend.readResource(request.params, options));
        server.setRequestHandler(ListResourceTemplatesRequestSchema, request => backend.listResourceTemplates(request.params, options));
      }
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: !pairedRequests.has(req), keepAliveMs: 1000 });
      connections.add(server);
      res.on('close', () => { connections.delete(server); void server.close(); });
      try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
      catch { if (!res.headersSent) res.status(503).json({ error: 'mcp_unavailable' }); }
    };
    app.post('/mcp', express.json({ limit: '2mb' }), handleMcp);
    app.all('/mcp', (_req, res) => res.set('Allow', 'POST').sendStatus(405));
    if (geminiPairingPath) {
      // Browser MCP clients need CORS. Scope it to the credential-bearing route;
      // never enable cross-origin access to OAuth or the local dashboard.
      app.use((req, res, next) => {
        if (req.path !== geminiPairingPath) return next();
        const origin = req.headers.origin;
        if (!origin) return next();
        if (!['https://gemini.google.com', 'chrome-extension://kngiafgkdnlkgmefdafaibkibegkcaef'].includes(origin)) return res.sendStatus(403);
        res.set({ 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version' });
        if (req.method !== 'OPTIONS') return next();
        const headers = String(req.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
        if (!['GET', 'POST'].includes(req.headers['access-control-request-method']) || headers.some(value => !['content-type', 'mcp-protocol-version', 'mcp-session-id', 'accept', 'last-event-id'].includes(value))) return res.sendStatus(403);
        res.set({ 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Accept, Last-Event-ID' });
        res.sendStatus(204);
      });
      // The opt-in URL is a 256-bit capability. Never infer pairing from caller-provided metadata or headers.
      const requirePairing = (req, res, next) => {
        if (req.path !== geminiPairingPath) return res.sendStatus(404);
        pairedRequests.add(req);
        next();
      };
      app.post(geminiPairingPath, requirePairing, express.json({ limit: '2mb' }), handleMcp);
      app.get(geminiPairingPath, requirePairing, handleMcp);
      app.all(geminiPairingPath, requirePairing, (_req, res) => res.set('Allow', 'GET, POST').sendStatus(405));
    }
    app.use('/gemini', (_req, res) => res.sendStatus(404));
    app.use((_error, _req, res, _next) => { if (!res.headersSent) res.status(400).json({ error: 'invalid_request' }); });
    httpServer = await new Promise((resolve, reject) => {
      const server = app.listen(port, '127.0.0.1', () => resolve(server));
      server.on('error', reject);
    });
    if (!backendAlive) { await close(); throw new Error('UmiBridge backend disconnected.'); }
    return { port: httpServer.address().port, publicUrl: issuer.href, url: resource.href, backendPid: backendTransport.pid, close, closed };
  } catch (error) { await close(); throw error; }
}
