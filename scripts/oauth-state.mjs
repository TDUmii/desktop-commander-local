import { chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OAuthClientInformationFullSchema } from '@modelcontextprotocol/sdk/shared/auth.js';

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const validScopes = scopes => Array.isArray(scopes) && scopes.includes('desktop') && scopes.length <= 2 && new Set(scopes).size === scopes.length && scopes.every(scope => ['desktop', 'offline_access'].includes(scope));

/** Only long-lived grants are saved. Consent requests and single-use codes never reach disk. */
export function createOAuthState(filePath, issuer) {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    const protection = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./protect-local-data.ps1', import.meta.url)), '-Path', directory], { windowsHide: true, encoding: 'utf8' });
    if (protection.status !== 0) throw new Error('Cannot protect local OAuth credentials.');
  } else chmodSync(directory, 0o700);
  const clients = new Map(), access = new Map(), refresh = new Map();
  const stores = { clients, access, refresh };
  if (existsSync(filePath)) {
    try {
      const text = readFileSync(filePath, 'utf8');
      if (text.length > 16 * 1024 * 1024) throw new Error('Oversized state');
      const state = JSON.parse(text);
      if (state?.version !== 1 || typeof state.issuer !== 'string') throw new Error('Invalid state');
      // A new Quick Tunnel origin must never accept a previous issuer's clients or tokens.
      if (state.issuer === issuer) {
        for (const [name, store] of Object.entries(stores)) {
          if (!Array.isArray(state[name]) || state[name].length > 1000) throw new Error('Invalid store');
          for (const entry of state[name]) {
            if (!Array.isArray(entry) || entry.length !== 2) throw new Error('Invalid entry');
            const [key, value] = entry;
            if (typeof key !== 'string' || !tokenPattern.test(key) || store.has(key) || !Number.isSafeInteger(value?.expiresAt)) throw new Error('Invalid grant');
            if (name === 'clients') {
              value.client = OAuthClientInformationFullSchema.parse(value.client);
              if (value.client.client_id !== key) throw new Error('Invalid client');
            } else {
              if (!tokenPattern.test(value.clientId) || !validScopes(value.scopes)) throw new Error('Invalid token grant');
              if (name === 'access' && value.refreshToken !== undefined && !tokenPattern.test(value.refreshToken)) throw new Error('Invalid refresh link');
              if (name === 'refresh' && !tokenPattern.test(value.accessToken)) throw new Error('Invalid access link');
            }
            if (value.expiresAt > Date.now()) store.set(key, value);
          }
        }
        for (const store of [access, refresh]) for (const grant of store.values()) if (!clients.has(grant.clientId)) throw new Error('Unknown client');
      }
    } catch {
      throw new Error('Invalid local OAuth state. Restore or remove the local oauth-state.json file, then reconnect.');
    }
  }
  let failed = false;
  const assertHealthy = () => { if (failed) throw new Error('Local OAuth credentials could not be saved. Restart the bridge after fixing local storage.'); };
  const save = () => {
    assertHealthy();
    const temporary = `${filePath}.${randomBytes(8).toString('hex')}.tmp`;
    let descriptor;
    try {
      // ponytail: one local user, at most 1,000 records per map; synchronous atomic snapshots avoid grant-write races.
      const snapshot = { version: 1, issuer, ...Object.fromEntries(Object.entries(stores).map(([name, store]) => [name, [...store]])) };
      descriptor = openSync(temporary, 'wx', 0o600);
      writeFileSync(descriptor, JSON.stringify(snapshot), 'utf8');
      fsyncSync(descriptor);
      closeSync(descriptor); descriptor = undefined;
      renameSync(temporary, filePath);
      if (process.platform !== 'win32') chmodSync(filePath, 0o600);
    } catch {
      failed = true;
      for (const store of Object.values(stores)) store.clear();
      throw new Error('Unable to save local OAuth credentials. Authorization has been stopped.');
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      try { unlinkSync(temporary); } catch { /* Successful rename already removed the temporary file. */ }
    }
  };
  return { ...stores, save, assertHealthy };
}
