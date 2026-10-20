import type { Work, WorkStatus } from '../types/index.ts';
import { STATUS_LABEL, STATUS_OPTIONS } from '../types/index.ts';

/** CSV 匯入支援的欄位 */
export const CSV_FIELDS = [
  'title',
  'titleOriginal',
  'type',
  'platform',
  'series',
  'status',
  'tags',
  'note',
  'url',
  'cover',
] as const;

export type CsvField = (typeof CSV_FIELDS)[number];

export const CSV_FIELD_LABEL: Record<CsvField, string> = {
  title: '標題',
  titleOriginal: '日文名',
  type: '類型',
  platform: '平台',
  series: '系列',
  status: '狀態',
  tags: '標籤',
  note: '說明',
  url: '網址',
  cover: '封面',
};

/** 標頭文字 → 欄位的對應表（中英文都認） */
const HEADER_ALIASES: Record<CsvField, string[]> = {
  title: ['標題', '作品名', '作品', '名稱', '名字', 'title', 'name'],
  titleOriginal: ['日文名', '日文', '原名', '原題', '日文名稱', 'titleoriginal', 'jp', 'japanese'],
  type: ['類型', '種類', '類別', 'type', 'category', 'genre'],
  platform: ['平台', '主機', '平台/主機', '平台主機', 'platform', 'console', 'system'],
  series: ['系列', '系列作', '系列名', 'series'],
  status: ['狀態', '進度', 'status', 'state'],
  tags: ['標籤', '標籤(tags)', 'tags', 'tag', '關鍵字'],
  note: ['說明', '備註', '筆記', '心得', '介紹', 'note', 'notes', 'memo', 'description', 'comment'],
  url: ['網址', '連結', 'url', 'link', 'website'],
  cover: ['封面', '封面圖', '封面圖片', '圖片', 'cover', 'image', 'img'],
};

/** 依標頭文字猜欄位 */
export function guessField(header: string): CsvField | null {
  const h = header.trim().toLowerCase().replace(/\s+/g, '');
  if (!h) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [CsvField, string[]][]) {
    if (aliases.some((a) => a.toLowerCase().replace(/\s+/g, '') === h)) return field;
  }
  return null;
}

/** 狀態文字 → 內部代碼 */
function parseStatus(text: string): WorkStatus | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const byLabel = STATUS_OPTIONS.find((o) => o.label === t || o.value === t);
  if (byLabel) return byLabel.value;
  const loose: Record<string, WorkStatus> = {
    想: 'want',
    沒看: 'want',
    未看: 'want',
    未開始: 'want',
    看: 'playing',
    正在看: 'playing',
    在玩: 'playing',
    完成: 'done',
    看完了: 'done',
    看過: 'done',
    玩過: 'done',
    已完成: 'done',
    棄: 'dropped',
    棄坑: 'dropped',
    放棄: 'dropped',
    不看了: 'dropped',
  };
  for (const [key, value] of Object.entries(loose)) {
    if (t.includes(key)) return value;
  }
  return undefined;
}

/** 標籤字串 → 陣列（用 | ; 、 分隔） */
export function parseTags(text: string): string[] {
  return text
    .split(/[|;、]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * 解析 CSV 文字
 * 支援引號包住的欄位、欄位內的逗號與換行、雙引號跳脫（""）
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  // 去掉 BOM
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** 讀檔並判斷編碼（UTF-8 優先，失敗時試 Big5） */
export async function readCsvFile(file: File): Promise<{ text: string; encoding: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // UTF-8（允許 BOM）
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text, encoding: 'UTF-8' };
  } catch {
    // 繼續試 Big5
  }

  // Big5（Excel 另存的舊格式）
  try {
    const text = new TextDecoder('big5', { fatal: true }).decode(bytes);
    return { text, encoding: 'Big5' };
  } catch {
    // 真的壞了，最後用寬鬆的 UTF-8 解
  }

  return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'UTF-8（部分字元可能有誤）' };
}

export interface CsvImportResult {
  headers: string[];
  /** 標頭索引 → 欄位 */
  mapping: Record<number, CsvField | null>;
  /** 每一列的原始儲存格（位置對應 headers 的索引） */
  rows: string[][];
  total: number;
}

/** 解析 CSV 文字成可預覽的結構 */
export function analyzeCsv(text: string): CsvImportResult {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { headers: [], mapping: {}, rows: [], total: 0 };
  }

  const headers = table[0].map((h) => h.trim());
  const body = table.slice(1);

  const mapping: Record<number, CsvField | null> = {};
  const used = new Set<CsvField>();
  headers.forEach((header, idx) => {
    const guess = guessField(header);
    if (guess && !used.has(guess)) {
      mapping[idx] = guess;
      used.add(guess);
    } else {
      mapping[idx] = null;
    }
  });

  return { headers, mapping, rows: body, total: body.length };
}

/** 依欄位對應把一列原始儲存格轉成欄位值 */
export function rowToValues(
  cells: string[],
  mapping: Record<number, CsvField | null>,
): Partial<Record<CsvField, string>> {
  const values: Partial<Record<CsvField, string>> = {};
  cells.forEach((cell, idx) => {
    const field = mapping[idx];
    if (field) values[field] = (cell ?? '').trim();
  });
  return values;
}

/** 把匯入的資料列轉成 Work */
export function rowToWork(
  values: Partial<Record<CsvField, string>>,
  existingTitles: Set<string>,
): Work | null {
  const title = (values.title ?? '').trim();
  if (!title) return null;
  if (existingTitles.has(title)) return null;

  const type = (values.type ?? '').trim() || '未分類';

  return {
    id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    titleOriginal: (values.titleOriginal ?? '').trim() || undefined,
    type,
    platform: (values.platform ?? '').trim() || undefined,
    series: (values.series ?? '').trim() || undefined,
    status: parseStatus(values.status ?? ''),
    tags: parseTags(values.tags ?? ''),
    note: (values.note ?? '').trim() || '',
    url: (values.url ?? '').trim() || undefined,
    cover: (values.cover ?? '').trim() || undefined,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

/* ---------- 匯出 ---------- */

function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const EXPORT_HEADERS: [CsvField, string][] = [
  ['title', '標題'],
  ['titleOriginal', '日文名'],
  ['type', '類型'],
  ['platform', '平台'],
  ['series', '系列'],
  ['status', '狀態'],
  ['tags', '標籤'],
  ['note', '說明'],
  ['url', '網址'],
  ['cover', '封面'],
];

export function worksToCsv(works: Work[]): string {
  const lines = [EXPORT_HEADERS.map(([, label]) => escapeCsv(label)).join(',')];

  for (const w of works) {
    const row: Record<CsvField, string> = {
      title: w.title,
      titleOriginal: w.titleOriginal ?? '',
      type: w.type,
      platform: w.platform ?? '',
      series: w.series ?? '',
      status: w.status ? STATUS_LABEL[w.status] : '',
      tags: (w.tags ?? []).join('|'),
      note: w.note ?? '',
      url: w.url ?? '',
      cover: w.cover ?? '',
    };
    lines.push(EXPORT_HEADERS.map(([field]) => escapeCsv(row[field])).join(','));
  }

  // 加 BOM，Excel 開啟才不會亂碼
  return '\uFEFF' + lines.join('\r\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
