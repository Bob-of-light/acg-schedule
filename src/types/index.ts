export type IndexView = 'type' | 'tag';

export type WorkStatus = 'want' | 'playing' | 'done' | 'dropped';

export interface Work {
  id: string;
  /** 作品名稱（必填） */
  title: string;
  /** 日文／原文名稱 */
  titleOriginal?: string;
  /** 類型（必填，例如 動畫、電玩、漫畫、小說） */
  type: string;
  /** 平台／主機（電玩用，例如 Steam、PS5、Switch） */
  platform?: string;
  /** 系列（選填，填了就在索引樹上多一層） */
  series?: string;
  /** 狀態（選填） */
  status?: WorkStatus;
  /** 標籤 */
  tags?: string[];
  /** 說明／備註（必填，主要欄位） */
  note: string;
  /** 相關網址 */
  url?: string;
  /** 封面圖片網址 */
  cover?: string;
  updatedAt?: string;
}

export interface WorksData {
  version: number;
  updatedAt?: string;
  /** 類型主清單，存檔時會自動補上作品用到但清單沒有的 */
  types?: string[];
  /** 平台主清單 */
  platforms?: string[];
  /** 標籤主清單 */
  tags?: string[];
  works: Work[];
}

export const STATUS_OPTIONS: { value: WorkStatus; label: string }[] = [
  { value: 'want', label: '想看' },
  { value: 'playing', label: '在看' },
  { value: 'done', label: '完成' },
  { value: 'dropped', label: '棄坑' },
];

export const STATUS_LABEL: Record<WorkStatus, string> = {
  want: '想看',
  playing: '在看',
  done: '完成',
  dropped: '棄坑',
};

/** 索引樹的葉節點（一部作品） */
export interface IndexLeaf {
  kind: 'work';
  work: Work;
  count: 1;
}

/** 索引樹的分支節點（類型／標籤／系列） */
export interface IndexBranch {
  kind: 'branch';
  name: string;
  count: number;
  children: IndexNode[];
}

export type IndexNode = IndexLeaf | IndexBranch;

export interface IndexTree {
  view: IndexView;
  roots: IndexBranch[];
  /** 符合條件的作品數 */
  total: number;
}
