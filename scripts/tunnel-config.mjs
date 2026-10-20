import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** A persistent tunnel is opt-in. Missing configuration keeps the existing Quick Tunnel. */
export async function readTunnelConfig(stateDir, port) {
  let config;
  try { config = JSON.parse(await readFile(join(stateDir, 'tunnel-config.json'), 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return { provider: 'cloudflare' };
    throw new Error('Invalid tunnel configuration. Run Setup-Stable-Connection.cmd again.');
  }
  if (config?.provider !== 'devtunnel' || !/^[a-z0-9][a-z0-9.-]{2,99}$/.test(config.tunnelId ?? '') || config.port !== port) {
    throw new Error('Tunnel configuration does not match this port. Run Setup-Stable-Connection.cmd again.');
  }
  if (config.publicUrl !== undefined) {
    let url;
    try { url = new URL(config.publicUrl); } catch { /* Validated below. */ }
    if (!url || url.protocol !== 'https:' || !url.hostname.endsWith('.devtunnels.ms') || url.hostname.includes('-inspect.') ||
        url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.port) {
      throw new Error('Invalid stable tunnel origin. Run Setup-Stable-Connection.cmd again.');
    }
    config.publicUrl = url.origin;
  }
  return config;
}

/** Read the actual forwarding URL; a custom tunnel ID is not necessarily its hostname. */
export function tunnelUrlFromOutput(output, provider, port) {
  if (provider === 'cloudflare') return output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  const line = output.split(/\r?\n/).find(value => value.includes(`Hosting port ${port} at `)) ??
    output.match(new RegExp(`Hosting port:\\s*${port}\\s*\\r?\\nConnect via browser:([^\\r\\n]*)`))?.[1];
  if (!line) return;
  for (const match of line.matchAll(/https:\/\/[a-z0-9.-]+(?::\d+)?\/?/g)) {
    const url = new URL(match[0]);
    if (!url.port && url.hostname.endsWith('.devtunnels.ms') && !url.hostname.includes('-inspect.')) return url.origin;
  }
}
