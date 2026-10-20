import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from './open-browser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const DATA_FILE = path.join(DATA_DIR, 'works.json');
// 備份放在 public/ 外面，避免被 Vite 一起打包部署
const BACKUP_DIR = path.join(ROOT, 'data');
const BACKUP_FILE = path.join(BACKUP_DIR, 'works.backup.json');
const DIST_DIR = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 3001);

/**
 * GitHub Pages 的部署路徑，必須和 vite.config.ts 的 base 一致。
 * 本機伺服器會自動把這個前綴剝掉，所以 http://localhost:3001/
 * 和 https://<user>.github.io/acg-schedule/ 都能正常運作。
 */
const BASE = process.env.BASE_PATH ?? '/acg-schedule/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readData() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

/** 把作品用到的類型／平台／標籤補進主清單，避免索引漏掉 */
function mergeLists(data) {
  const types = [...(data.types ?? [])];
  const platforms = [...(data.platforms ?? [])];
  const tags = [...(data.tags ?? [])];

  for (const work of data.works ?? []) {
    if (work.type && !types.includes(work.type)) types.push(work.type);
    if (work.platform && !platforms.includes(work.platform)) platforms.push(work.platform);
    for (const tag of work.tags ?? []) {
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
  }

  return { ...data, types, platforms, tags };
}

async function writeData(next) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const current = await fs.readFile(DATA_FILE, 'utf8');
  await fs.writeFile(BACKUP_FILE, current, 'utf8');

  const payload = {
    ...mergeLists(next),
    version: next.version ?? 1,
    updatedAt: new Date().toISOString(),
  };
  delete payload.allowEmpty;

  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, DATA_FILE);

  await fs.writeFile(
    path.join(DIST_DIR, 'data', 'works.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  ).catch(() => {});

  console.log(`[acg] 已儲存 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  return payload;
}

function validateData(data) {
  if (!data || typeof data !== 'object') return '資料格式錯誤';
  if (!Array.isArray(data.works)) return 'works 必須是陣列';
  if (data.types !== undefined && !Array.isArray(data.types)) return 'types 必須是陣列';
  if (data.platforms !== undefined && !Array.isArray(data.platforms)) {
    return 'platforms 必須是陣列';
  }
  if (data.tags !== undefined && !Array.isArray(data.tags)) return 'tags 必須是陣列';

  const ids = new Set();
  for (const work of data.works) {
    if (!work || typeof work !== 'object') return '作品資料格式錯誤';
    if (typeof work.id !== 'string' || !work.id) return '作品缺少 id';
    if (ids.has(work.id)) return `作品 id 重複：${work.id}`;
    ids.add(work.id);
    if (typeof work.title !== 'string' || !work.title) return `作品 ${work.id} 缺少標題`;
    if (typeof work.type !== 'string' || !work.type) return `作品 ${work.title} 缺少類型`;
    if (work.tags !== undefined && !Array.isArray(work.tags)) {
      return `作品 ${work.title} 的 tags 必須是陣列`;
    }
  }
  return null;
}

function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('資料過大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveStatic(req, res) {
  if (!fsSync.existsSync(DIST_DIR)) {
    sendJson(res, 404, {
      error: '找不到 dist 資料夾，請先執行 npm run build（或用 dev.bat 開發模式）',
    });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  // 剝掉 GitHub Pages 的 base 前綴，讓本機也能用同一份 build
  if (BASE !== '/' && pathname.startsWith(BASE)) {
    pathname = '/' + pathname.slice(BASE.length);
  } else if (BASE !== '/' && pathname === BASE.slice(0, -1)) {
    pathname = '/';
  }

  let filePath = path.join(DIST_DIR, pathname);

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  if (!fsSync.existsSync(filePath) || fsSync.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const stat = await fs.stat(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
    });
    fsSync.createReadStream(filePath).pipe(res);
  } catch {
    sendJson(res, 404, { error: '檔案不存在' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, editable: true });
    return;
  }

  if (url.pathname === '/api/works' && req.method === 'GET') {
    try {
      sendJson(res, 200, { data: await readData(), editable: true });
    } catch (err) {
      sendJson(res, 500, { error: `讀取資料失敗：${err.message}` });
    }
    return;
  }

  if (url.pathname === '/api/works' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      const invalid = validateData(parsed);
      if (invalid) {
        sendJson(res, 400, { error: invalid });
        return;
      }

      // 安全網：防止誤把資料清空
      const current = await readData();
      if (
        Array.isArray(current.works) &&
        current.works.length > 0 &&
        parsed.works.length === 0 &&
        parsed.allowEmpty !== true
      ) {
        sendJson(res, 422, {
          error:
            `拒絕寫入：目前有 ${current.works.length} 部作品，新資料是空的。` +
            `如果真的要把全部清空，請明確加上 allowEmpty: true。`,
        });
        return;
      }

      const saved = await writeData(parsed);
      sendJson(res, 200, { data: saved, editable: true });
    } catch (err) {
      sendJson(res, 400, { error: `儲存失敗：${err.message}` });
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: '不支援的方法' });
    return;
  }

  await serveStatic(req, res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`[acg] 連接埠 ${PORT} 已經被占用。`);
    console.error('');
    console.error('  可能是 dev.bat / start.bat 已經開著了。');
    console.error('  請先關掉那個黑色的終端機視窗，再重新執行。');
    console.error('');
    console.error(`  或者指定其他連接埠： set PORT=3002 && npm start`);
    console.error('');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`[acg] API 伺服器啟動： ${url}`);
  openBrowser(url);
});
