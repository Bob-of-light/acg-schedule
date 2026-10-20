import { useState } from 'react';
import type { Work, WorkStatus, WorksData } from '../types/index.ts';
import { STATUS_OPTIONS } from '../types/index.ts';
import { CloseIcon, SaveIcon } from './icons';

interface WorkFormDialogProps {
  work: Work | null;
  data: WorksData;
  editable: boolean;
  onCancel: () => void;
  onSave: (work: Work) => Promise<void>;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId() {
  return `w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export default function WorkFormDialog({
  work,
  data,
  editable,
  onCancel,
  onSave,
}: WorkFormDialogProps) {
  const isNew = work === null;
  const [draft, setDraft] = useState<Work>(
    () =>
      work
        ? structuredClone(work)
        : ({ id: newId(), title: '', type: data.types?.[0] ?? '', note: '' } as Work),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const [newType, setNewType] = useState('');
  const [newPlatform, setNewPlatform] = useState('');
  const [newTag, setNewTag] = useState('');

  const patch = (changes: Partial<Work>) => setDraft((d) => ({ ...d, ...changes }));

  const toggleTag = (tag: string) =>
    setDraft((d) => {
      const tags = d.tags ?? [];
      return { ...d, tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] };
    });

  const addType = () => {
    const name = newType.trim();
    if (!name) return;
    patch({ type: name });
    setHint(`已設為類型「${name}」`);
    setNewType('');
  };

  const addPlatform = () => {
    const name = newPlatform.trim();
    if (!name) return;
    patch({ platform: name });
    setHint(`已設為平台「${name}」`);
    setNewPlatform('');
  };

  const addTag = () => {
    const name = newTag.trim();
    if (!name) return;
    if (!draft.tags?.includes(name)) {
      setDraft((d) => ({ ...d, tags: [...(d.tags ?? []), name] }));
    }
    setHint(`已加入標籤「${name}」`);
    setNewTag('');
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      setError('請填寫標題');
      return;
    }
    if (!draft.type.trim()) {
      setError('請選擇或輸入類型');
      return;
    }
    if (!draft.note.trim()) {
      setError('請寫點說明，之後才不會忘記');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const cleaned: Work = {
        ...draft,
        title: draft.title.trim(),
        titleOriginal: draft.titleOriginal?.trim() || undefined,
        type: draft.type.trim(),
        platform: draft.platform?.trim() || undefined,
        series: draft.series?.trim() || undefined,
        status: draft.status,
        tags: (draft.tags ?? []).filter(Boolean),
        note: draft.note.replace(/\n{3,}/g, '\n\n').trim(),
        url: draft.url?.trim() || undefined,
        cover: draft.cover?.trim() || undefined,
        updatedAt: today(),
      };
      await onSave(cleaned);
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
      setBusy(false);
    }
  };

  const input =
    'w-full bg-raised border border-line rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-sky-500';
  const label = 'block text-xs font-medium text-muted mb-1';

  const seriesOptions = [
    ...new Set([
      ...(data.works.map((w) => w.series).filter(Boolean) as string[]),
      ...(draft.series ? [draft.series] : []),
    ]),
  ].sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  const tagOptions = [
    ...new Set([...(data.tags ?? []), ...(draft.tags ?? [])]),
  ].sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  const platformOptions = [
    ...new Set([
      ...(data.platforms ?? []),
      ...(draft.platform ? [draft.platform] : []),
    ]),
  ].sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => !busy && onCancel()} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? '新增作品' : `修改 ${work?.title}`}
        className="relative w-full sm:max-w-2xl max-h-[94vh] sm:max-h-[88vh] flex flex-col
                   bg-panel border border-line rounded-t-2xl sm:rounded-2xl shadow-xl"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line shrink-0">
          <h3 className="flex-1 text-base font-semibold truncate">
            {isNew ? '新增作品' : '修改作品'}
          </h3>
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
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="w-title">
                標題 <span className="text-red-500">*</span>
              </label>
              <input
                id="w-title"
                className={input}
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </div>
            <div>
              <label className={label} htmlFor="w-titleOriginal">日文名稱</label>
              <input
                id="w-titleOriginal"
                className={input}
                placeholder="例：進撃の巨人"
                value={draft.titleOriginal ?? ''}
                onChange={(e) => patch({ titleOriginal: e.target.value })}
              />
            </div>
          </div>

          <div>
            <span className={label}>
              類型 <span className="text-red-500">*</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(data.types ?? []).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => patch({ type })}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    draft.type === type
                      ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                      : 'border-line text-muted hover:text-current'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              <input
                className={`${input} flex-1`}
                placeholder="新增類型，例如：音樂遊戲"
                value={newType}
                maxLength={12}
                onChange={(e) => setNewType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addType();
                  }
                }}
              />
              <button
                type="button"
                onClick={addType}
                disabled={!newType.trim()}
                className="shrink-0 px-3 rounded-md text-sm border border-line
                           hover:bg-neutral-100 dark:hover:bg-neutral-700
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                設定
              </button>
            </div>
          </div>

          <div>
            <span className={label}>平台／主機</span>
            <div className="flex flex-wrap gap-1.5">
              {platformOptions.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => patch({ platform: draft.platform === platform ? undefined : platform })}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    draft.platform === platform
                      ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                      : 'border-line text-muted hover:text-current'
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              <input
                className={`${input} flex-1`}
                placeholder="輸入平台，例如：PS5"
                value={newPlatform}
                maxLength={20}
                onChange={(e) => setNewPlatform(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPlatform();
                  }
                }}
              />
              <button
                type="button"
                onClick={addPlatform}
                disabled={!newPlatform.trim()}
                className="shrink-0 px-3 rounded-md text-sm border border-line
                           hover:bg-neutral-100 dark:hover:bg-neutral-700
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                設定
              </button>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="w-series">系列（選填，填了索引會多一層）</label>
            <input
              id="w-series"
              className={input}
              list="series-options"
              placeholder="例：進擊的巨人"
              value={draft.series ?? ''}
              onChange={(e) => patch({ series: e.target.value })}
            />
            <datalist id="series-options">
              {seriesOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <span className={label}>狀態（可留空）</span>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    patch({ status: draft.status === opt.value ? undefined : (opt.value as WorkStatus) })
                  }
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    draft.status === opt.value
                      ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                      : 'border-line text-muted hover:text-current'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={label}>標籤</span>
            <div className="flex flex-wrap gap-1.5">
              {tagOptions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    draft.tags?.includes(tag)
                      ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                      : 'border-line text-muted hover:text-current'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              <input
                className={`${input} flex-1`}
                placeholder="新增標籤，例如：熱血"
                value={newTag}
                maxLength={16}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button
                type="button"
                onClick={addTag}
                disabled={!newTag.trim()}
                className="shrink-0 px-3 rounded-md text-sm border border-line
                           hover:bg-neutral-100 dark:hover:bg-neutral-700
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                加入
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="w-url">網址</label>
              <input
                id="w-url"
                className={input}
                placeholder="https://…"
                value={draft.url ?? ''}
                onChange={(e) => patch({ url: e.target.value })}
              />
            </div>
            <div>
              <label className={label} htmlFor="w-cover">封面圖片網址</label>
              <input
                id="w-cover"
                className={input}
                placeholder="https://…jpg"
                value={draft.cover ?? ''}
                onChange={(e) => patch({ cover: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="w-note">
              說明 <span className="text-red-500">*</span>（寫下你想記住的，空一行代表分段）
            </label>
            <textarea
              id="w-note"
              rows={8}
              className={`${input} leading-relaxed resize-y`}
              placeholder="例：老闆說這裡有初代限定版，記一下免得下次找不到。"
              value={draft.note ?? ''}
              onChange={(e) => patch({ note: e.target.value })}
            />
          </div>

          {draft.cover && (
            <div className="flex items-start gap-3">
              <img
                src={draft.cover}
                alt=""
                className="h-24 w-16 object-cover rounded border border-line"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.visibility = 'hidden';
                }}
              />
              <p className="text-xs text-muted self-center">封面預覽（網址無法讀取時會空白）</p>
            </div>
          )}

          {hint && <p className="text-xs text-emerald-700 dark:text-emerald-400">{hint}</p>}
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {!editable && (
            <p className="text-xs text-red-600 dark:text-red-400">
              目前為唯讀模式（沒有後端），儲存不會生效。請在本機執行 dev.bat 或 start.bat。
            </p>
          )}
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
            onClick={handleSave}
            disabled={busy || !editable}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm bg-sky-700 text-white
                       hover:bg-sky-800 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <SaveIcon className="w-4 h-4" />
            {busy ? '儲存中...' : isNew ? '新增作品' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
