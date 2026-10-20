import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useWorks } from './hooks/useWorks';
import type { IndexView, Work, WorkStatus } from './types';
import Header from './components/Header';
import ImportDialog from './components/ImportDialog';
import PinDialog from './components/PinDialog';
import Sidebar from './components/Sidebar';
import WorkDetail from './components/WorkDetail';
import WorkFormDialog from './components/WorkFormDialog';
import { downloadCsv, worksToCsv } from './utils/csv';

export default function App() {
  const { data, editable, editMode, loading, error, unlock, updateWork, addWork, addWorks, deleteWork } =
    useWorks();
  const { resolved, setPreference } = useTheme();

  const [view, setView] = useState<IndexView>('type');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<WorkStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Work | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [askingPin, setAskingPin] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && data.works.length > 0) setSelectedId(data.works[0].id);
  }, [data.works, selectedId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const selected = useMemo(
    () => data.works.find((w) => w.id === selectedId) ?? null,
    [data.works, selectedId],
  );

  const handleSelect = (workId: string) => {
    setSelectedId(workId);
    setSidebarOpen(false);
  };

  const guardEditable = (action: () => void) => {
    if (editMode === 'unlocked' || editMode === 'offline') {
      action();
      return;
    }
    setAskingPin(true);
  };

  const handleSaveWork = useCallback(
    async (work: Work) => {
      const isNew = !data.works.some((w) => w.id === work.id);
      if (isNew) await addWork(work);
      else await updateWork(work);
      setSelectedId(work.id);
      setToast(isNew ? `已新增「${work.title}」` : '已儲存');
    },
    [addWork, data.works, updateWork],
  );

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    if (!window.confirm(`確定要刪除「${selected.title}」嗎？這個動作無法復原。`)) return;
    try {
      await deleteWork(selected);
      setSelectedId(null);
      setToast(`已刪除「${selected.title}」`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : '刪除失敗');
    }
  }, [deleteWork, selected]);

  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`ACG收藏簿_${today}.csv`, worksToCsv(data.works));
    setToast(`已匯出 ${data.works.length} 部作品`);
  };

  return (
    <div className="bg-app h-full flex flex-col">
      <Header
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        editMode={editMode}
        resolved={resolved}
        onChangeTheme={setPreference}
        onRequestPin={() => setAskingPin(true)}
      />

      <div className="flex-1 flex min-h-0 relative">
        <aside
          className={`shrink-0 border-r border-line bg-panel lg:w-1/5 lg:min-w-56 lg:max-w-80
                      absolute inset-y-0 left-0 z-30 w-[85%] max-w-xs lg:relative
                      ${sidebarOpen ? 'block' : 'hidden'} lg:block`}
        >
          {loading ? (
            <p className="p-4 text-sm text-muted">載入中...</p>
          ) : (
            <Sidebar
              data={data}
              view={view}
              onViewChange={setView}
              keyword={keyword}
              onKeywordChange={setKeyword}
              status={status}
              onStatusChange={setStatus}
              selectedId={selectedId}
              onSelect={handleSelect}
              editable={editable}
              onCreate={() => guardEditable(() => setCreating(true))}
              onImport={() => guardEditable(() => setImporting(true))}
              onExport={handleExport}
            />
          )}
        </aside>

        {sidebarOpen && (
          <div
            className="absolute inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        <main className="flex-1 min-w-0 overflow-y-auto">
          {error && (
            <p className="p-4 text-sm text-red-600 dark:text-red-400">載入失敗：{error}</p>
          )}
          {!error && selected && (
            <WorkDetail
              work={selected}
              editable={editable}
              onEdit={() => guardEditable(() => setEditing(selected))}
              onDelete={() => guardEditable(handleDelete)}
            />
          )}
          {!error && !selected && !loading && (
            <div className="h-full flex items-center justify-center p-8">
              <p className="text-sm text-muted text-center">
                左邊選一部作品，這裡就會顯示詳細介紹。
              </p>
            </div>
          )}
        </main>
      </div>

      {(creating || editing) && (
        <WorkFormDialog
          work={editing}
          data={data}
          editable={editable}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={async (work) => {
            await handleSaveWork(work);
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {importing && (
        <ImportDialog
          existingTitles={data.works.map((w) => w.title)}
          onCancel={() => setImporting(false)}
          onImport={async (works) => {
            await addWorks(works);
            setImporting(false);
            setToast(`已匯入 ${works.length} 部作品`);
          }}
        />
      )}

      {askingPin && (
        <PinDialog
          online={editMode === 'locked'}
          onUnlock={() => {
            unlock();
            setAskingPin(false);
            setToast('已解鎖，可以編輯了');
          }}
          onCancel={() => setAskingPin(false)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg max-w-[90vw]
                     text-center bg-neutral-900 text-neutral-50 text-sm shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
        >
          {toast}
        </div>
      )}
    </div>
  );
}