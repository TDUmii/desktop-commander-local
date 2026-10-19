import express from 'express';
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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const randomToken = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest();
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isLoopback = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
const sameResource = (a, b) => String(a).replace(/\/$/, '') === String(b).replace(/\/$/, '');
const contentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

/** One ChatGPT-only local process, exposed through an authenticated MCP endpoint. */
export async function startGateway({ port = 8767, publicUrl, connectionSecret, configDir } = {}) {
  if (typeof connectionSecret !== 'string' || connectionSecret.length < 24) {
    throw new Error('connectionSecret must contain at least 24 characters.');
  }
  if (!configDir) throw new Error('An isolated configDir is required.');
  const issuer = new URL(publicUrl);
  if ((issuer.protocol !== 'https:' && !(issuer.protocol === 'http:' && isLoopback(issuer.hostname))) ||
      issuer.username || issuer.password || issuer.search || issuer.hash || issuer.pathname !== '/') {
    throw new Error('publicUrl must be an HTTPS origin (HTTP loopback is allowed for local tests).');
  }
  const resource = new URL('/mcp', issuer);
  const secretHash = digest(connectionSecret);
  connectionSecret = undefined;
  const requestHistory = await createRequestHistory(resolve(configDir, '..', 'request-history.jsonl'));
  const chatLinks = await createChatLinksStore(resolve(configDir, '..', 'chat-links.json'));
  // ponytail: single-user gateway; bounded in-memory grants reset when the gateway stops.
  const clients = new Map(), pending = new Map(), codes = new Map(), access = new Map(), refresh = new Map();
  const stores = [clients, pending, codes, access, refresh];
  const sweep = () => {
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
  const issueTokens = (clientId, scopes) => {
    requireCapacity(access); requireCapacity(refresh);
    const accessToken = randomToken(), refreshToken = scopes.includes('offline_access') ? randomToken() : undefined;
    access.set(accessToken, { clientId, scopes, refreshToken, expiresAt: Date.now() + 15 * 60_000 });
    if (refreshToken) refresh.set(refreshToken, { clientId, scopes, accessToken, expiresAt: Date.now() + 12 * 60 * 60_000 });
    return { access_token: accessToken, token_type: 'Bearer', expires_in: 900, refresh_token: refreshToken, scope: scopes.join(' ') };
  };
  const revoke = (store, key) => {
    const grant = store.get(key);
    if (!grant) return;
    access.delete(grant.accessToken ?? key);
    refresh.delete(grant.refreshToken ?? key);
  };
  const consentPage = (id, request, message = '') => `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kết nối máy local</title><style>body{font:17px/1.6 system-ui;background:#f3f5f7;color:#17202a;padding:36px 20px}main{max-width:540px;margin:auto;background:white;border:1px solid #d6dde3;border-radius:18px;padding:30px}h1{font-size:26px;line-height:1.3}label,input,button{display:block;width:100%;box-sizing:border-box}input,button{font:inherit;padding:12px;border-radius:8px;border:1px solid #8d9ba7}button{margin-top:18px;background:#155bcc;color:white;cursor:pointer}small{overflow-wrap:anywhere;color:#475867}.error{color:#a71919}</style><main><h1>Kết nối với máy của bạn</h1><p><strong>${escapeHtml(request.client.client_name || 'Ứng dụng MCP')}</strong> muốn đọc, sửa tệp và chạy lệnh trên máy này.</p><p>Chỉ cho phép khi bạn vừa chủ động thêm kết nối này.</p><small>Địa chỉ nhận kết nối: ${escapeHtml(request.params.redirectUri)}</small>${message ? `<p class="error" role="alert">${escapeHtml(message)}</p>` : ''}<form method="post" action="/consent"><input type="hidden" name="requestId" value="${id}"><p><label for="secret">Mã kết nối hiển thị trong tool local</label><input id="secret" name="secret" type="password" autocomplete="off" required autofocus maxlength="256"></p><button type="submit">Cho phép kết nối</button></form></main></html>`;
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
        clients.set(registered.client_id, { client: registered, expiresAt: Date.now() + 24 * 60 * 60_000 });
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
      return issueTokens(client.client_id, grant.scopes);
    },
    async exchangeRefreshToken(client, token, scopes, requestedResource) {
      const grant = grantFor(refresh, token, client);
      checkResource(requestedResource);
      if (scopes?.some(scope => !grant.scopes.includes(scope))) throw new InvalidScopeError('Cannot extend granted scopes.');
      const effectiveScopes = checkScopes(scopes ?? grant.scopes);
      revoke(refresh, token);
      return issueTokens(client.client_id, effectiveScopes);
    },
    async verifyAccessToken(token) {
      sweep();
      const grant = access.get(token);
      if (!grant) throw new InvalidTokenError('Invalid or expired access token.');
      return { token, clientId: grant.clientId, scopes: grant.scopes, expiresAt: Math.floor(grant.expiresAt / 1000), resource };
    },
    async revokeToken(client, request) {
      for (const store of [access, refresh]) if (store.get(request.token)?.clientId === client.client_id) revoke(store, request.token);
    }
  };

  const backendTransport = new StdioClientTransport({
    command: process.execPath, args: [resolve(ROOT, 'scripts/chatgpt-backend.mjs')], cwd: ROOT, stderr: 'pipe',
    env: { CHATGPT_LOCAL_ONLY: '1', CHATGPT_LOCAL_CONFIG_DIR: resolve(configDir) }
  });
  // The backend may include file contents in diagnostics. Never relay them to public responses or gateway logs.
  backendTransport.stderr?.resume();
  const backend = new Client({ name: 'desktop-commander-local-web', version: '1.0.0' });
  let backendAlive = true, closing = false, httpServer, closePromise;
  let resolveClosed;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const connections = new Set();
  const close = () => closePromise ??= (async () => {
    closing = true; backendAlive = false;
    for (const store of stores) store.clear();
    await Promise.allSettled([...connections].map(server => server.close()));
    if (httpServer) await new Promise(resolve => { httpServer.close(resolve); httpServer.closeAllConnections(); });
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
    app.use((req, res, next) => {
      const boundPort = httpServer?.address()?.port ?? port;
      if (![issuer.host, `127.0.0.1:${boundPort}`, `localhost:${boundPort}`].includes(req.headers.host)) return res.sendStatus(403);
      res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': contentSecurityPolicy });
      if (!backendAlive) return res.status(503).json({ error: 'backend_unavailable' });
      next();
    });
    app.get('/health', (_req, res) => res.json({ ok: true }));
    const localAdmin = (req, res, next) => {
      const directLoopback = issuer.protocol === 'http:' && isLoopback(req.hostname);
      if (req.headers['x-local-admin'] !== '1' && !directLoopback) return res.sendStatus(404);
      next();
    };
    app.get('/admin', localAdmin, (_req, res) => {
      res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
      res.type('html').send(renderAdminPage());
    });
    const startedAt = Date.now();
    app.get('/admin/api/requests', localAdmin, (_req, res) => res.json({
      stats: requestHistory.stats(), requests: requestHistory.list(),
      runtime: { startedAt: new Date(startedAt).toISOString(), uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), endpoint: resource.href, localOnly: true }
    }));
    app.get('/admin/api/chats', localAdmin, (_req, res) => res.json({ links: chatLinks.list() }));
    // This header is a browser CSRF barrier: a third-party page cannot set it without CORS preflight.
    const adminWrite = (req, res, next) => req.headers['x-dc-admin-action'] === '1' ? next() : res.sendStatus(403);
    app.post('/admin/api/chats', localAdmin, adminWrite, express.json({ limit: '2kb' }), async (req, res) => {
      try {
        if (!requestHistory.has(req.body?.requestId)) return res.status(404).json({ error: 'Request không còn trong lịch sử.' });
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
      if (!request || cookie !== request.csrf || (req.headers.origin && req.headers.origin !== issuer.origin)) return res.status(400).send('Yêu cầu hết hạn hoặc không hợp lệ. Vui lòng kết nối lại.');
      if (Date.now() - failedWindow > 15 * 60_000) { failedWindow = Date.now(); failedAttempts = 0; }
      if (failedAttempts >= 10 || request.attempts >= 5) return res.status(429).send('Đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
      const supplied = typeof req.body.secret === 'string' ? req.body.secret : '';
      if (!timingSafeEqual(secretHash, digest(supplied))) {
        failedAttempts++; request.attempts++;
        res.status(401);
        return sendConsent(res, req.body.requestId, request, 'Mã kết nối chưa đúng.');
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
    app.use(mcpAuthRouter({ provider, issuerUrl: issuer, resourceServerUrl: resource, scopesSupported: ['desktop', 'offline_access'], resourceName: 'Desktop Commander Local', clientRegistrationOptions: { clientSecretExpirySeconds: 24 * 60 * 60 } }));
    app.use('/mcp', requireBearerAuth({ verifier: provider, requiredScopes: ['desktop'], expectedResource: resource, resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource) }));
    app.post('/mcp', express.json({ limit: '2mb' }), async (req, res) => {
      const server = new Server({ name: 'desktop-commander-chatgpt-local', version: '1.0.0' }, { capabilities: { tools: {}, ...(capabilities.resources ? { resources: {} } : {}) }, instructions: backend.getInstructions?.() });
      const options = { timeout: 120_000 };
      server.setRequestHandler(ListToolsRequestSchema, request => backend.listTools(request.params, options));
      server.setRequestHandler(CallToolRequestSchema, async request => {
        const startedAt = performance.now();
        try {
          const result = await backend.callTool(request.params, undefined, options);
          await requestHistory.add(request.params.name, request.params.arguments, result, performance.now() - startedAt);
          return result;
        } catch (error) {
          await requestHistory.add(request.params.name, request.params.arguments, { isError: true, content: [] }, performance.now() - startedAt);
          throw error;
        }
      });
      if (capabilities.resources) {
        server.setRequestHandler(ListResourcesRequestSchema, request => backend.listResources(request.params, options));
        server.setRequestHandler(ReadResourceRequestSchema, request => backend.readResource(request.params, options));
        server.setRequestHandler(ListResourceTemplatesRequestSchema, request => backend.listResourceTemplates(request.params, options));
      }
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      connections.add(server);
      res.on('close', () => { connections.delete(server); void server.close(); });
      try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
      catch { if (!res.headersSent) res.status(503).json({ error: 'mcp_unavailable' }); }
    });
    app.all('/mcp', (_req, res) => res.set('Allow', 'POST').sendStatus(405));
    app.use((_error, _req, res, _next) => { if (!res.headersSent) res.status(400).json({ error: 'invalid_request' }); });
    httpServer = await new Promise((resolve, reject) => {
      const server = app.listen(port, '127.0.0.1', () => resolve(server));
      server.on('error', reject);
    });
    if (!backendAlive) { await close(); throw new Error('Desktop Commander backend disconnected.'); }
    return { port: httpServer.address().port, publicUrl: issuer.href, url: resource.href, backendPid: backendTransport.pid, close, closed };
  } catch (error) { await close(); throw error; }
}
