import { useRef, useState } from 'react';
import type { Work } from '../types/index.ts';
import {
  analyzeCsv,
  CSV_FIELDS,
  CSV_FIELD_LABEL,
  downloadCsv,
  readCsvFile,
  rowToValues,
  rowToWork,
  type CsvField,
} from '../utils/csv';
import { CloseIcon, SaveIcon } from './icons';

interface ImportDialogProps {
  existingTitles: string[];
  onCancel: () => void;
  onImport: (works: Work[]) => Promise<void>;
}

export default function ImportDialog({ existingTitles, onCancel, onImport }: ImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<number, CsvField | null>>({});
  const [rows, setRows] = useState<string[][]>([]);
  const [encoding, setEncoding] = useState<string>('');
  const [skipDuplicate, setSkipDuplicate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setFileName(file.name);

    try {
      const { text, encoding: enc } = await readCsvFile(file);
      const result = analyzeCsv(text);
      if (result.total === 0) {
        setError('這個檔案看起來沒有資料列');
        return;
      }
      setHeaders(result.headers);
      setMapping(result.mapping);
      setRows(result.rows);
      setEncoding(enc);
    } catch (err) {
      setError(err instanceof Error ? err.message : '檔案讀取失敗');
    }
  };

  const preview = rows.slice(0, 5);

  const handleImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const existing = new Set(existingTitles);
      const works: Work[] = [];

      for (const row of rows) {
        const values = rowToValues(row, mapping);
        const work = rowToWork(values, skipDuplicate ? existing : new Set());
        if (work) {
          works.push(work);
          existing.add(work.title);
        }
      }

      if (works.length === 0) {
        setError(
          skipDuplicate
            ? '沒有可匯入的資料（標題都重複了，或沒有標題欄位）'
            : '沒有可匯入的資料（請確認有標題欄位）',
        );
        setBusy(false);
        return;
      }

      await onImport(works);
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入失敗');
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      '標題,日文名,類型,平台,系列,狀態,標籤,說明,網址,封面',
      '進擊的巨人 第1季,進撃の巨人,動畫,Netflix,進擊的巨人,完成,熱血|必看,比前三季更殘酷,https://…,',
    ].join('\r\n');
    downloadCsv('收藏簿_範本.csv', '\uFEFF' + template);
  };

  const select =
    'w-full bg-raised border border-line rounded-md px-2 py-1 text-xs focus:outline-none focus:border-sky-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => !busy && onCancel()} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="匯入 CSV"
        className="relative w-full sm:max-w-3xl max-h-[92vh] flex flex-col bg-panel
                   border border-line rounded-t-2xl sm:rounded-2xl shadow-xl"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line shrink-0">
          <h3 className="flex-1 text-base font-semibold">匯入 CSV</h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-1.5 rounded-md text-muted hover:text-current disabled:opacity-40"
            aria-label="關閉"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="px-3 py-1.5 rounded-md text-sm bg-sky-700 text-white hover:bg-sky-800
                         transition-colors disabled:opacity-45"
            >
              選擇 CSV 檔
            </button>
            {fileName && (
              <span className="text-xs text-muted">
                {fileName}
                {encoding ? `（${encoding}）` : ''}
              </span>
            )}
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-xs text-muted hover:text-current hover:underline ml-auto"
            >
              下載範本
            </button>
          </div>

          {headers.length > 0 && (
            <>
              <div className="space-y-2">
                <p className="text-xs text-muted leading-relaxed">
                  確認每個欄位要匯入到哪裡。標題是必填的；標籤用 <code className="px-1">|</code> 分隔。
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {headers.map((header, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span
                        className="flex-1 min-w-0 truncate text-xs px-2 py-1 rounded-md
                                   bg-neutral-100 dark:bg-neutral-800 text-muted"
                        title={header}
                      >
                        {header || `（第 ${idx + 1} 欄）`}
                      </span>
                      <select
                        className={select}
                        value={mapping[idx] ?? ''}
                        onChange={(e) =>
                          setMapping((m) => ({
                            ...m,
                            [idx]: (e.target.value || null) as CsvField | null,
                          }))
                        }
                      >
                        <option value="">略過</option>
                        {CSV_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {CSV_FIELD_LABEL[field]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">預覽（前 5 筆）</p>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-100 dark:bg-neutral-800">
                      <tr>
                        {headers.map((header, idx) => (
                          <th key={idx} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                            {header || `第 ${idx + 1} 欄`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, r) => (
                        <tr key={r} className="border-t border-line">
                          {headers.map((_, c) => (
                            <td
                              key={c}
                              className="px-2 py-1.5 whitespace-nowrap max-w-[16rem] truncate"
                              title={row[c] ?? ''}
                            >
                              {row[c] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipDuplicate}
                  onChange={(e) => setSkipDuplicate(e.target.checked)}
                  className="w-4 h-4 accent-sky-600"
                />
                跳過標題已存在的作品
              </label>
            </>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-line shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3.5 py-2 rounded-md text-sm border border-line hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={busy || rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm bg-sky-700 text-white
                       hover:bg-sky-800 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <SaveIcon className="w-4 h-4" />
            {busy ? '匯入中...' : `匯入 ${rows.length} 筆`}
          </button>
        </div>
      </div>
    </div>
  );
}
