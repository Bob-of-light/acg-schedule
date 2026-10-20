import type { WorksData } from '../types/index.ts';

interface WorksResponse {
  data: WorksData;
  editable: boolean;
}

const BASE = import.meta.env.BASE_URL ?? '/';

/** 線上寫入 API（Vercel）。本機開發時為空字串，代表用本機 Node 後端。 */
export const WRITE_API: string = (import.meta.env.VITE_WRITE_API_URL ?? '').replace(/\/+$/, '');

export const PIN_STORAGE_KEY = 'acg-pin';

export function loadPin(): string {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function savePin(pin: string) {
  try {
    if (pin) localStorage.setItem(PIN_STORAGE_KEY, pin);
    else localStorage.removeItem(PIN_STORAGE_KEY);
  } catch {
    // 無痕模式會失敗，不影響其他功能
  }
}

export async function loadWorks(): Promise<WorksResponse> {
  // 1. 本機 Node 後端
  try {
    const res = await fetch('/api/works', { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as WorksResponse;
      if (json?.data) return json;
    }
  } catch {
    // 沒有本機後端，繼續往下
  }

  // 2. 線上寫入 API 是否可用
  let onlineWritable = false;
  if (WRITE_API) {
    try {
      const res = await fetch(`${WRITE_API}/api/data`, { method: 'GET' });
      const json = await res.json().catch(() => null);
      onlineWritable = Boolean(json?.online);
    } catch {
      onlineWritable = false;
    }
  }

  // 3. 靜態檔（GitHub Pages 上線的最新版本）
  const res = await fetch(`${BASE}data/works.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error('找不到作品資料');
  const data = (await res.json()) as WorksData;

  return { data, editable: onlineWritable };
}

export async function saveWorks(data: WorksData, message?: string): Promise<WorksData> {
  if (WRITE_API) return saveRemote(data, message);
  return saveLocal(data);
}

async function saveLocal(data: WorksData): Promise<WorksData> {
  const res = await fetch('/api/works', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? '儲存失敗');
  return (json as WorksResponse).data;
}

async function saveRemote(data: WorksData, message?: string): Promise<WorksData> {
  const text = JSON.stringify(data, null, 2) + '\n';
  const bytes = new TextEncoder().encode(text);

  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const contentBase64 = btoa(binary);

  const res = await fetch(`${WRITE_API}/api/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pin': loadPin() },
    body: JSON.stringify({
      data,
      contentBase64,
      message: message || `更新收藏簿（${data.works.length} 部作品）`,
    }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error ?? '儲存失敗');
  }
  return data;
}

/** 驗證 PIN 是否正確（絕對不寫入任何資料） */
export async function verifyPin(pin: string): Promise<boolean> {
  const res = await fetch(`${WRITE_API}/api/data?dryRun=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
    body: JSON.stringify({ dryRun: true }),
  }).catch(() => null);

  if (!res) return false;
  return res.status === 200;
}
