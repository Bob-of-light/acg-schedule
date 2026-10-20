import type { Work } from '../types/index.ts';
import { STATUS_LABEL } from '../types/index.ts';
import { ExternalIcon, PencilIcon, TrashIcon } from './icons';

interface WorkDetailProps {
  work: Work;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function WorkDetail({ work, editable, onEdit, onDelete }: WorkDetailProps) {
  const paragraphs = (work.note ?? '').split(/\n{2,}/).filter(Boolean);

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-7">
      <header className="space-y-3">
        <div className="flex items-start gap-4">
          {work.cover ? (
            <img
              src={work.cover}
              alt=""
              className="hidden sm:block w-32 h-44 object-cover rounded-lg border border-line shrink-0"
            />
          ) : null}

          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">{work.title}</h2>
            {work.titleOriginal && work.titleOriginal !== work.title && (
              <p className="text-sm text-muted">{work.titleOriginal}</p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded-full text-xs bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                {work.type}
              </span>
              {work.platform && (
                <span className="px-2 py-0.5 rounded-full text-xs border border-line text-muted">
                  {work.platform}
                </span>
              )}
              {work.series && (
                <span className="px-2 py-0.5 rounded-full text-xs border border-line text-muted">
                  系列：{work.series}
                </span>
              )}
              {work.status && (
                <span className="px-2 py-0.5 rounded-full text-xs border border-line text-muted">
                  {STATUS_LABEL[work.status]}
                </span>
              )}
              {(work.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-xs border border-line text-muted"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onEdit}
            disabled={!editable}
            title={editable ? '修改這部作品' : '唯讀模式：本機開啟 dev.bat 才能編輯'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-line
                       hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors
                       disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <PencilIcon className="w-4 h-4" />
            修改
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={!editable}
            title={editable ? '刪除這部作品' : '唯讀模式：本機開啟 dev.bat 才能刪除'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-line
                       text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40
                       transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <TrashIcon className="w-4 h-4" />
            刪除
          </button>
        </div>
      </header>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-wide text-muted">說明</h3>
        {paragraphs.length ? (
          <div className="space-y-3 text-sm sm:text-[15px] leading-relaxed">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-wrap">
                {p}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">還沒有寫說明，可以按「修改」補上。</p>
        )}
      </section>

      {work.url && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold tracking-wide text-muted">相關連結</h3>
          <a
            href={work.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm accent hover:underline break-all"
          >
            {work.url} <ExternalIcon />
          </a>
        </section>
      )}

      {work.updatedAt && (
        <p className="text-[11px] text-muted pt-1">最後更新：{work.updatedAt}</p>
      )}
    </article>
  );
}
