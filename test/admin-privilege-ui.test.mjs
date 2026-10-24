import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const markup = await readFile(new URL('../scripts/admin-dashboard.html', import.meta.url), 'utf8');
const script = markup.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
new vm.Script(script);

function dashboard() {
  const nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {
      disabled: true, textContent: '', attrs: {},
      setAttribute(key, value) { this.attrs[key] = value; },
      classList: {
        values: new Set(),
        toggle(name, active) { this.values[active ? 'add' : 'delete'](name); },
        contains(name) { return this.values.has(name); },
      }, addEventListener() {},
    });
    return nodes.get(id);
  };
  let next, now = 0, calls = 0;
  const context = {
    $: element, AbortSignal: { timeout() {} }, Date: { now: () => now },
    setTimeout() { return 1; }, clearTimeout() {},
    fetch: async () => { calls++; if (next instanceof Error) throw next; return next; },
  };
  vm.createContext(context);
  const start = script.indexOf('  const privilegeModel=');
  const end = script.indexOf("  $('createPairing').addEventListener", start);
  assert.ok(start > 0 && end > start, 'Privilege controller must be present');
  vm.runInContext(script.slice(start, end) + ';globalThis.controller={state:privilegeModel,loadPrivilege,changePrivilege};', context);
  return {
    ...context.controller, element,
    response(data) { next = { ok: true, json: async () => data }; },
    disconnect() { next = new Error('offline'); },
    advance(milliseconds) { now += milliseconds; },
    calls: () => calls,
  };
}
const normal = { mode: 'normal', elevated: false, installed: false, running: false, pending: false, capability: 'available' };
const admin = { ...normal, mode: 'admin', installed: true, elevated: true, running: true };

test('privilege Settings distinguishes actual rights from saved mode and fails closed when status is unavailable', async () => {
  const ui = dashboard();
  ui.response(normal); await ui.loadPrivilege();
  assert.equal(ui.element('privilegeNormal').disabled, true);
  assert.equal(ui.element('privilegeAdmin').disabled, false);
  ui.response({ ...normal, installed: true }); await ui.loadPrivilege();
  assert.equal(ui.element('privilegeCurrent').textContent, 'Quyền thường');
  assert.equal(ui.element('privilegeSaved').textContent, 'Administrator đã lưu');
  assert.equal(ui.element('privilegeAdmin').disabled, false);
  assert.equal(ui.element('privilegeNormal').disabled, false, 'A stopped saved task can still be disabled');
  ui.response({ ...normal, elevated: true }); await ui.loadPrivilege();
  assert.equal(ui.element('privilegeCurrent').textContent, 'Administrator', 'Actual gateway token is independent of saved task state');
  assert.equal(ui.element('privilegeNormal').disabled, true, 'The UI cannot downgrade an unmanaged elevated gateway');
  const before = ui.calls(); await ui.changePrivilege('normal'); assert.equal(ui.calls(), before);
  ui.response({ ...normal, capability: 'needs-admin-account' }); await ui.loadPrivilege();
  assert.equal(ui.element('privilegeAdmin').disabled, true);
  assert.match(ui.element('privilegeMessage').textContent, /tài khoản/);
  ui.response({ ...normal, mode: 'unavailable', capability: 'unavailable' }); await ui.loadPrivilege();
  assert.equal(ui.element('privilegeAdmin').disabled, true);
  assert.match(ui.element('privilegeMessage').textContent, /chưa khả dụng/);
  ui.disconnect(); await ui.loadPrivilege();
  assert.equal(ui.element('privilegeNormal').disabled, true);
  assert.equal(ui.element('privilegeCurrent').textContent, 'Chưa xác minh');
});

test('privilege change survives gateway restart, prevents duplicate requests and respects cancelled UAC', async () => {
  const ui = dashboard();
  ui.response(normal); await ui.loadPrivilege();
  ui.response({ pending: true }); await ui.changePrivilege('admin');
  assert.equal(ui.state.target, 'admin');
  assert.equal(ui.element('privilegeNormal').disabled, true);
  assert.equal(ui.element('privilegeAdmin').disabled, true);
  const before = ui.calls(); await ui.changePrivilege('admin'); assert.equal(ui.calls(), before);
  ui.disconnect(); await ui.loadPrivilege();
  assert.equal(ui.state.target, 'admin');
  assert.match(ui.element('privilegeMessage').textContent, /kết nối lại/);
  ui.response(admin); await ui.loadPrivilege();
  assert.equal(ui.state.target, null);
  assert.equal(ui.element('privilegeCurrent').textContent, 'Administrator');
  assert.equal(ui.element('privilegeNormal').disabled, false);
  ui.response({ pending: true }); await ui.changePrivilege('normal');
  ui.response({ ...admin, error: 'UAC_CANCELLED' }); await ui.loadPrivilege();
  assert.equal(ui.state.target, null);
  assert.match(ui.element('privilegeMessage').textContent, /hủy/);
  assert.equal(ui.element('privilegeCurrent').textContent, 'Administrator');
  ui.response(normal); await ui.changePrivilege('normal');
  assert.equal(ui.state.target, 'normal', 'An idempotent pending:false response still reconciles status');
  await ui.loadPrivilege();
  assert.equal(ui.state.target, null);
  assert.equal(ui.element('privilegeCurrent').textContent, 'Quyền thường');
});

test('lost acknowledgement reconciles status before another privilege request is allowed', async () => {
  const ui = dashboard();
  ui.response(normal); await ui.loadPrivilege();
  ui.disconnect(); await ui.changePrivilege('admin');
  assert.equal(ui.state.target, 'admin');
  assert.equal(ui.element('privilegeAdmin').disabled, true);
  ui.advance(240001); await ui.loadPrivilege();
  assert.equal(ui.state.target, null);
  assert.match(ui.element('privilegeMessage').textContent, /chưa kết nối/);
  assert.equal(ui.element('privilegeAdmin').disabled, true);
  ui.response(normal); await ui.loadPrivilege();
  assert.equal(ui.element('privilegeAdmin').disabled, false);
});

test('native installation hides transient integrity errors only while Windows reports it pending', async () => {
  const ui = dashboard();
  ui.response(normal); await ui.loadPrivilege();
  ui.response({ pending: true }); await ui.changePrivilege('admin');
  const copying = { ...normal, mode: 'unavailable', installed: true, capability: 'integrity-error', pending: true };
  ui.response(copying); await ui.loadPrivilege();
  assert.equal(ui.element('privilegeSaved').textContent, 'Đang chuyển...');
  assert.match(ui.element('privilegeMessage').textContent, /Windows xác nhận và chuyển chế độ/);
  assert.equal(ui.element('privilegeMessage').classList.contains('error'), false);
  assert.equal(ui.element('privilegeNormal').disabled, true);
  assert.equal(ui.element('privilegeAdmin').disabled, true);
  ui.response({ ...copying, pending: false }); await ui.loadPrivilege();
  assert.equal(ui.state.target, null, 'A finished failed installation must not keep waiting for success');
  assert.notEqual(ui.element('privilegeSaved').textContent, 'Đang chuyển...');
  assert.match(ui.element('privilegeMessage').textContent, /không toàn vẹn/);
  assert.equal(ui.element('privilegeMessage').classList.contains('error'), true);
  assert.equal(ui.element('privilegeNormal').disabled, true);
  assert.equal(ui.element('privilegeAdmin').disabled, true);
});
