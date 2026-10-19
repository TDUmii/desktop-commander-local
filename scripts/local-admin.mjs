import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname } from 'node:path';

const MAX_ENTRIES = 500;
const MAX_TEXT = 500;
const sensitiveKey = /^(content|data|input|password|secret|token|authorization|cookie)$/i;
const home = homedir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const homePattern = home ? new RegExp(home, 'ig') : null;

function safeString(value) {
  const text = String(value).replace(homePattern ?? /$^/, '~');
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
}

function safeArguments(value, key, depth = 0) {
  if (key && sensitiveKey.test(key)) return '[ẩn vì riêng tư]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return safeString(value);
  if (depth >= 3) return '[đã rút gọn]';
  if (Array.isArray(value)) return value.slice(0, 20).map(item => safeArguments(item, key, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([name, item]) => [name, safeArguments(item, name, depth + 1)]));
  }
  return String(value);
}

function recordFor(toolName, args, result, duration) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    toolName: safeString(toolName),
    arguments: safeArguments(args),
    status: result?.isError ? 'error' : 'ok',
    contentItems: Array.isArray(result?.content) ? result.content.length : 0,
    durationMs: Math.max(0, Math.round(duration)),
  };
}

export async function createRequestHistory(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
  let entries = [];
  try {
    const lines = (await readFile(filePath, 'utf8')).split(/\r?\n/).filter(Boolean);
    entries = lines.slice(-MAX_ENTRIES).flatMap(line => {
      try {
        const item = JSON.parse(line);
        return item?.id && item?.timestamp && item?.toolName ? [item] : [];
      } catch {
        return [];
      }
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let writes = Promise.resolve();
  const enqueue = task => {
    writes = writes.then(task, task);
    return writes;
  };
  return {
    add(toolName, args, result, duration) {
      const entry = recordFor(toolName, args, result, duration);
      entries = [...entries, entry].slice(-MAX_ENTRIES);
      return enqueue(() => appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8'));
    },
    list(limit = 200) {
      const safeLimit = Math.min(Math.max(Number(limit) || 0, 0), MAX_ENTRIES);
      return entries.slice(-safeLimit).reverse();
    },
    stats() {
      const tools = new Set(entries.map(entry => entry.toolName));
      return { total: entries.length, tools: tools.size, latest: entries.at(-1)?.timestamp ?? null };
    },
    clear() {
      entries = [];
      return enqueue(() => writeFile(filePath, '', 'utf8'));
    },
  };
}

export function renderAdminPage() {
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Desktop Commander Local - lịch sử request</title>
  <style>
    :root{color-scheme:dark;--bg:#0e1116;--panel:#171c24;--panel-2:#202733;--line:#303947;--text:#edf2f7;--muted:#9aa7b5;--accent:#70a7ff;--ok:#64d19a;--err:#ff8d8d}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% -20%,#223454 0,transparent 45%),var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
    main{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:42px 0 56px}.top{display:flex;gap:24px;align-items:flex-start;justify-content:space-between;margin-bottom:28px}.eyebrow{color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}h1{font-size:clamp(28px,4vw,44px);letter-spacing:-.03em;line-height:1.1;margin:8px 0 10px}p{margin:0;color:var(--muted)}.badge{white-space:nowrap;border:1px solid #3a5f8e;border-radius:999px;padding:8px 12px;color:#c7dcff;font-size:13px;background:#16263c}
    .toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:22px 0}.button{border:1px solid var(--line);border-radius:10px;background:var(--panel-2);color:var(--text);padding:10px 14px;font:inherit;cursor:pointer}.button:hover{border-color:#5b78a1}.button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.button.danger{color:#ffd0d0;border-color:#71484d}.updated{color:var(--muted);font-size:13px;margin-left:auto}
    .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}.stat{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}.stat strong{display:block;font-size:26px;letter-spacing:-.03em}.stat span{color:var(--muted);font-size:13px}
    .table-wrap{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:auto}table{width:100%;border-collapse:collapse;min-width:760px}th,td{text-align:left;padding:13px 15px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-size:12px;font-weight:650;text-transform:uppercase;letter-spacing:.06em}tbody tr:last-child td{border-bottom:0}.time{white-space:nowrap;color:var(--muted);font-size:13px}.tool{font-weight:650}.args{color:#cbd5e1;max-width:470px;white-space:pre-wrap;word-break:break-word;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}.status{font-size:12px;font-weight:700}.status.ok{color:var(--ok)}.status.error{color:var(--err)}.empty{text-align:center;padding:54px 18px;color:var(--muted)}.error-box{display:none;color:#ffd0d0;border:1px solid #71484d;border-radius:10px;padding:12px;margin-bottom:16px;background:#291a1d}.error-box.show{display:block}
    @media(max-width:680px){main{width:min(100% - 20px,1180px);padding-top:25px}.top{display:block}.badge{display:inline-block;margin-top:18px}.stats{grid-template-columns:1fr}.updated{margin-left:0;width:100%}}
  </style>
</head>
<body>
  <main>
    <div class="top"><div><div class="eyebrow">Quản trị local</div><h1>Lịch sử request</h1><p>Các request MCP gần đây được gửi qua Desktop Commander Local.</p></div><div class="badge">Chỉ mở trên máy này</div></div>
    <div class="toolbar"><button class="button" id="refresh" type="button">Tải lại</button><button class="button danger" id="clear" type="button">Xóa lịch sử</button><span class="updated" id="updated">Đang tải...</span></div>
    <div class="error-box" id="error" role="alert"></div>
    <section class="stats" aria-label="Tổng quan"><div class="stat"><strong id="total">0</strong><span>Tổng request đã lưu</span></div><div class="stat"><strong id="tools">0</strong><span>Số công cụ đã dùng</span></div><div class="stat"><strong id="latest">-</strong><span>Request gần nhất</span></div></section>
    <div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Công cụ</th><th>Tham số đã rút gọn</th><th>Kết quả</th></tr></thead><tbody id="rows"><tr><td colspan="4" class="empty">Chưa có request nào.</td></tr></tbody></table></div>
  </main>
  <script>
    const $=id=>document.getElementById(id);
    const formatTime=value=>value?new Date(value).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'medium'}):'-';
    const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function render(data){
      $('total').textContent=data.stats.total;$('tools').textContent=data.stats.tools;$('latest').textContent=formatTime(data.stats.latest);
      $('updated').textContent='Cập nhật '+new Date().toLocaleTimeString('vi-VN');
      $('rows').innerHTML=data.requests.length?data.requests.map(item=>'<tr><td class="time">'+escapeHtml(formatTime(item.timestamp))+'</td><td class="tool">'+escapeHtml(item.toolName)+'</td><td class="args">'+escapeHtml(JSON.stringify(item.arguments,null,2))+'</td><td><span class="status '+escapeHtml(item.status)+'">'+(item.status==='ok'?'Thành công':'Lỗi')+'</span><br><span class="time">'+escapeHtml(item.durationMs+' ms · '+item.contentItems+' mục')+'</span></td></tr>').join(''):'<tr><td colspan="4" class="empty">Chưa có request nào. Hãy gửi một request từ ChatGPT web rồi tải lại.</td></tr>';
    }
    async function load(){try{const response=await fetch('/admin/api/requests',{cache:'no-store'});if(!response.ok)throw new Error('Không thể đọc lịch sử local ('+response.status+').');render(await response.json());$('error').classList.remove('show')}catch(error){$('error').textContent=error.message;$('error').classList.add('show')}}
    $('refresh').addEventListener('click',load);$('clear').addEventListener('click',async()=>{if(!confirm('Xóa lịch sử request local?'))return;const response=await fetch('/admin/api/clear',{method:'POST'});if(!response.ok){$('error').textContent='Không thể xóa lịch sử.';$('error').classList.add('show');return}await load()});load();
  </script>
</body>
</html>`;
}
