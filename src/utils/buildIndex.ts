import type { IndexBranch, IndexNode, IndexTree, IndexView, Work, WorksData } from '../types/index.ts';

/** 空白字元與全形空白，讓搜尋「 初代 」也能命中「初代」 */
function normalize(text: string): string {
  return text.replace(/[\s　]+/g, '').toLowerCase();
}

/** 全文比對：標題、日文名、系列、說明、標籤、平台、類型 */
export function matchWork(work: Work, keyword: string): boolean {
  const k = normalize(keyword);
  if (!k) return true;

  const haystack = [
    work.title,
    work.titleOriginal,
    work.series,
    work.type,
    work.platform,
    work.note,
    ...(work.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ');

  return normalize(haystack).includes(k);
}

export interface FilterOptions {
  view: IndexView;
  keyword?: string;
  /** 只顯示這個狀態；null = 全部 */
  status?: string | null;
}

function statusOk(work: Work, status?: string | null): boolean {
  if (!status) return true;
  return (work.status ?? '') === status;
}

/** 遞迴累加數量，並移除底下完全沒有作品的分支 */
function prune(nodes: IndexNode[]): IndexNode[] {
  const result: IndexNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'work') {
      result.push(node);
      continue;
    }
    const children = prune(node.children);
    if (children.length === 0) continue;
    const count = children.reduce((sum, child) => sum + child.count, 0);
    result.push({ ...node, count, children });
  }
  return result;
}

function childBranch(parent: IndexBranch, name: string): IndexBranch {
  const found = parent.children.find(
    (c): c is IndexBranch => c.kind === 'branch' && c.name === name,
  );
  if (found) return found;
  const created: IndexBranch = { kind: 'branch', name, count: 0, children: [] };
  parent.children.push(created);
  return created;
}

/**
 * 建立索引樹
 *
 * 依類型視角：類型 > 系列 > 作品
 * 依標籤視角：標籤 > 系列 > 作品
 *
 * 系列是選填欄位，沒填的作品會直接掛在第一層下面。
 */
export function buildIndex(data: WorksData, options: FilterOptions): IndexTree {
  const { view, keyword = '', status = null } = options;

  const works = data.works.filter((w) => statusOk(w, status) && matchWork(w, keyword));

  // 依類型
  if (view === 'type') {
    const roots: IndexBranch[] = [];
    const typeNames = [
      ...(data.types ?? []),
      ...works.map((w) => w.type).filter(Boolean),
    ];
    for (const name of [...new Set(typeNames)]) {
      roots.push({ kind: 'branch', name, count: 0, children: [] });
    }

    for (const root of roots) {
      for (const work of works) {
        if (work.type !== root.name) continue;
        if (work.series) {
          const seriesNode = childBranch(root, work.series);
          seriesNode.children.push({ kind: 'work', work, count: 1 });
        } else {
          root.children.push({ kind: 'work', work, count: 1 });
        }
      }
    }

    return { view, roots: prune(roots) as IndexBranch[], total: works.length };
  }

  // 依標籤
  const roots: IndexBranch[] = [];
  const tagNames = [
    ...(data.tags ?? []),
    ...works.flatMap((w) => w.tags ?? []).filter(Boolean),
  ];
  for (const name of [...new Set(tagNames)]) {
    roots.push({ kind: 'branch', name, count: 0, children: [] });
  }

  for (const root of roots) {
    for (const work of works) {
      if (!work.tags?.includes(root.name)) continue;
      if (work.series) {
        const seriesNode = childBranch(root, work.series);
        seriesNode.children.push({ kind: 'work', work, count: 1 });
      } else {
        root.children.push({ kind: 'work', work, count: 1 });
      }
    }
  }

  // 沒有任何標籤的作品，放到「未分類」節點下避免被藏起來
  const untagged = works.filter((w) => !w.tags || w.tags.length === 0);
  if (untagged.length > 0) {
    const node: IndexBranch = { kind: 'branch', name: '未標籤', count: 0, children: [] };
    for (const work of untagged) {
      if (work.series) {
        const seriesNode = childBranch(node, work.series);
        seriesNode.children.push({ kind: 'work', work, count: 1 });
      } else {
        node.children.push({ kind: 'work', work, count: 1 });
      }
    }
    roots.push(node);
  }

  return { view, roots: prune(roots) as IndexBranch[], total: works.length };
}

/** 樹裡是否包含這部作品（用於高亮） */
export function containsWork(branch: IndexBranch, workId: string | null): boolean {
  if (!workId) return false;
  return branch.children.some((c) =>
    c.kind === 'work' ? c.work.id === workId : containsWork(c, workId),
  );
}
