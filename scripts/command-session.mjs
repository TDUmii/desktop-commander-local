import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const MAX_OUTPUT = 100_000;
const payload = (stderr, extra = {}) => ({ exit_code: 1, timed_out: false, stdout: '', stderr, ...extra });

// MCP stdio clients filter these out. Windows PowerShell otherwise starts with
// PATHEXT=.CPL and can silently skip native commands, including explicit .exe.
function windowsEnvironment() {
  const env = { ...process.env };
  const fallback = (name, value) => {
    const key = Object.keys(env).find(key => key.toLowerCase() === name.toLowerCase()) ?? name;
    if (!env[key]) env[key] = value;
  };
  const windows = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  fallback('ComSpec', join(windows, 'System32', 'cmd.exe'));
  fallback('PATHEXT', '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC');
  return env;
}

/** One prewarmed hidden PowerShell host, shared by successive command requests. */
export function createCommandSession({ cwd = process.cwd() } = {}) {
  let worker, startup, active, closePromise, sequence = 0, closed = false;
  let queue = Promise.resolve();
  const closures = new WeakMap();
  const track = child => {
    closures.set(child, new Promise(resolve => child.once('close', resolve)));
    return child;
  };

  const stop = async child => {
    if (!child) return;
    if (child.exitCode === null && !child.signalCode && process.platform === 'win32') {
      await new Promise(resolve => {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('error', () => { child.kill(); resolve(); });
        killer.once('close', resolve);
      });
    } else if (child.exitCode === null && !child.signalCode) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    }
    await closures.get(child);
  };

  const start = async () => {
    if (closed) throw new Error('The command session is closed.');
    if (worker) return startup;
    if (process.platform !== 'win32') return;
    const child = track(spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./command-worker.ps1', import.meta.url)), '-ParentPid', String(process.pid)], { cwd, env: windowsEnvironment(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }));
    worker = child;
    child.stderr.resume();
    child.stdin.on('error', () => {});
    startup = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { void stop(child); reject(new Error('Background PowerShell startup timed out.')); }, 60_000);
      const lines = createInterface({ input: child.stdout });
      lines.on('line', line => {
        let message;
        try { message = JSON.parse(line); } catch { return; }
        if (message.ready) { clearTimeout(timer); resolve(); return; }
        if (active?.child === child && message.id === active.id) {
          active.finish({ exit_code: Number.isInteger(message.exit_code) ? message.exit_code : 1, timed_out: Boolean(message.timed_out), stdout: String(message.stdout ?? '').slice(0, MAX_OUTPUT), stderr: String(message.stderr ?? '').slice(0, MAX_OUTPUT) });
        }
      });
      const ended = message => {
        clearTimeout(timer);
        if (worker === child) { worker = null; startup = null; }
        reject(new Error(message));
        if (active?.child === child) active.finish(payload(message));
        lines.close();
      };
      child.once('error', () => ended('Unable to start background PowerShell.'));
      child.once('close', () => ended('The background PowerShell session ended.'));
    });
    return startup;
  };

  const execute = async (command, directory, timeoutMs) => {
    if (closed) return payload('The command session is closed.');
    try { await start(); } catch (error) { return payload(error.message); }
    if (closed) return payload('The command session is closed.');
    if (process.platform !== 'win32') return runPosix(command, directory, timeoutMs);
    const child = worker;
    if (!child) return payload('The background PowerShell session is unavailable.');
    return new Promise(resolve => {
      const id = ++sequence;
      let done = false;
      const finish = value => {
        if (done) return;
        done = true; clearTimeout(timer);
        if (active?.id === id) active = null;
        resolve(value);
      };
      const timer = setTimeout(() => {
        // Return on time even when taskkill stalls; retire the old worker first.
        if (worker === child) { worker = null; startup = null; }
        finish(payload('Command timed out; cleanup requested.', { exit_code: null, timed_out: true }));
        void stop(child).catch(() => {});
      }, timeoutMs);
      active = { child, id, finish };
      child.stdin.write(JSON.stringify({ id, command, cwd: directory }) + '\n', error => { if (error) finish(payload('Unable to send the command to background PowerShell.')); });
    });
  };

  const runPosix = (command, directory, timeoutMs) => new Promise(resolve => {
    const child = track(spawn('/bin/sh', ['-lc', command], { cwd: directory, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }));
    let stdout = '', stderr = '', timedOut = false;
    child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(0, MAX_OUTPUT); });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(0, MAX_OUTPUT); });
    const timer = setTimeout(() => { timedOut = true; void stop(child); }, timeoutMs);
    active = { child, finish: value => resolve(value) };
    child.once('error', () => { clearTimeout(timer); active = null; resolve(payload('Unable to run command.')); });
    child.once('close', code => { clearTimeout(timer); active = null; resolve({ exit_code: code, timed_out: timedOut, stdout, stderr }); });
  });

  return {
    start,
    run(command, directory = cwd, timeoutMs = 120_000) {
      const task = () => execute(command, directory, Math.min(Math.max(Number(timeoutMs) || 120_000, 1), 120_000));
      const result = queue.then(task, task);
      queue = result.catch(() => {});
      return result;
    },
    close() {
      if (closePromise) return closePromise;
      closed = true;
      closePromise = (async () => {
        const pending = active;
        active = null;
        await stop(worker ?? pending?.child);
        pending?.finish(payload('The command session was closed.'));
        await queue;
      })();
      return closePromise;
    },
  };
}
