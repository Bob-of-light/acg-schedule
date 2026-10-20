import type { IndexView, Work, WorkStatus, WorksData } from '../types/index.ts';
import { STATUS_LABEL, STATUS_OPTIONS } from '../types/index.ts';
import { buildIndex } from '../utils/buildIndex';
import IndexTree from './IndexTree';
import { SearchIcon } from './icons';

interface SidebarProps {
  data: WorksData;
  view: IndexView;
  onViewChange: (view: IndexView) => void;
  keyword: string;
  onKeywordChange: (value: string) => void;
  status: WorkStatus | null;
  onStatusChange: (status: WorkStatus | null) => void;
  selectedId: string | null;
  onSelect: (workId: string) => void;
  editable: boolean;
  onCreate: () => void;
  onImport: () => void;
  onExport: () => void;
}

export default function Sidebar({
  data,
  view,
  onViewChange,
  keyword,
  onKeywordChange,
  status,
  onStatusChange,
  selectedId,
  onSelect,
  editable,
  onCreate,
  onImport,
  onExport,
}: SidebarProps) {
  const tree = buildIndex(data, { view, keyword, status });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-line space-y-2 shrink-0">
        <button
          type="button"
          onClick={onCreate}
          disabled={!editable}
          title={editable ? '新增一部作品' : '唯讀模式：本機開啟 dev.bat 才能新增'}
          className="w-full py-2 rounded-md text-sm font-medium bg-sky-700 text-white
                     hover:bg-sky-800 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
        >
          ＋ 新增作品
        </button>

        <div className="flex p-0.5 rounded-lg bg-neutral-200/60 dark:bg-neutral-800/70">
          {(
            [
              ['type', '依類型'],
              ['tag', '依標籤'],
            ] as [IndexView, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onViewChange(value)}
              className={`flex-1 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                view === value ? 'bg-raised shadow-sm font-medium' : 'text-muted hover:text-current'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onStatusChange(null)}
            className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
              status === null
                ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                : 'border-line text-muted hover:text-current'
            }`}
          >
            全部
          </button>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusChange(status === opt.value ? null : opt.value)}
              className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                status === opt.value
                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                  : 'border-line text-muted hover:text-current'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="搜尋標題、說明、標籤…"
            className="w-full bg-raised border border-line rounded-md pl-8 pr-2 py-1.5 text-sm
                       placeholder:text-muted focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {tree.roots.length === 0 ? (
          <p className="p-4 text-sm text-muted">
            {keyword || status ? '沒有符合的作品' : '還沒有作品，按上面的「＋ 新增作品」開始吧'}
          </p>
        ) : (
          <IndexTree nodes={tree.roots} selectedId={selectedId} onSelect={onSelect} />
        )}
      </div>

      <div className="px-3 py-2 border-t border-line shrink-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted">共 {tree.total} 部作品</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onImport}
              className="text-[11px] text-muted hover:text-current hover:underline"
              title="從 CSV 匯入作品"
            >
              匯入 CSV
            </button>
            <button
              type="button"
              onClick={onExport}
              className="text-[11px] text-muted hover:text-current hover:underline"
              title="匯出成 CSV 備份"
            >
              匯出
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
