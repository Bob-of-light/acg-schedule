import { useCallback, useEffect, useState } from 'react';
import { loadWorks, saveWorks, WRITE_API } from '../api/works';
import type { Work, WorksData } from '../types/index.ts';

const EMPTY: WorksData = { version: 1, types: [], platforms: [], tags: [], works: [] };

export type EditMode = 'offline' | 'locked' | 'unlocked';

/** 把作品用到的分類／平台／標籤補進主清單 */
function mergeLists(data: WorksData): WorksData {
  const types = [...(data.types ?? [])];
  const platforms = [...(data.platforms ?? [])];
  const tags = [...(data.tags ?? [])];

  for (const work of data.works) {
    if (work.type && !types.includes(work.type)) types.push(work.type);
    if (work.platform && !platforms.includes(work.platform)) platforms.push(work.platform);
    for (const tag of work.tags ?? []) {
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
  }

  return { ...data, types, platforms, tags };
}

export function useWorks() {
  const [data, setData] = useState<WorksData>(EMPTY);
  const [editable, setEditable] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>('offline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadWorks()
      .then((res) => {
        if (cancelled) return;
        setData(mergeLists(res.data));
        setEditable(res.editable);
        setEditMode(res.editable && WRITE_API ? 'locked' : res.editable ? 'unlocked' : 'offline');
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = useCallback(() => {
    setEditMode('unlocked');
    setEditable(true);
  }, []);

  const persist = useCallback(async (next: WorksData, message?: string) => {
    const merged = mergeLists(next);
    const saved = await saveWorks(merged, message);
    setData(mergeLists(saved));
    return saved;
  }, []);

  const updateWork = useCallback(
    async (work: Work, message?: string) => {
      const next: WorksData = {
        ...data,
        works: data.works.map((w) => (w.id === work.id ? work : w)),
      };
      return persist(next, message ?? `修改「${work.title}」`);
    },
    [data, persist],
  );

  const addWork = useCallback(
    async (work: Work, message?: string) => {
      if (data.works.some((w) => w.id === work.id)) {
        throw new Error(`作品 id 重複：${work.id}`);
      }
      const next: WorksData = { ...data, works: [...data.works, work] };
      return persist(next, message ?? `新增「${work.title}」`);
    },
    [data, persist],
  );

  const addWorks = useCallback(
    async (works: Work[], message?: string) => {
      const next: WorksData = { ...data, works: [...data.works, ...works] };
      return persist(next, message ?? `匯入 ${works.length} 部作品`);
    },
    [data, persist],
  );

  const deleteWork = useCallback(
    async (work: Work) => {
      const next: WorksData = {
        ...data,
        works: data.works.filter((w) => w.id !== work.id),
      };
      return persist(next, `刪除「${work.title}」`);
    },
    [data, persist],
  );

  return {
    data,
    editable,
    editMode,
    loading,
    error,
    unlock,
    updateWork,
    addWork,
    addWorks,
    deleteWork,
  };
}
