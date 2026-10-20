# ACG 收藏簿（ACG_schedule）

一個記錄「我有哪些遊戲沒打完、哪些動畫沒看」的私人收藏簿。

**定位是「收藏筆記」而不是「待辦清單」** —— 目標是記下來不要忘記，
所以刻意不做進度條、不做評分、不做完成率統計，不製造「還有好多沒清完」的壓迫感。

## 怎麼開始

| 檔案 | 用途 |
| --- | --- |
| `dev.bat` | **開發模式**：邊改邊看，開 http://localhost:5173/acg-schedule/ |
| `build.bat` | 只負責建置 |
| `start.bat` | 建置 + 啟動本機伺服器，開 http://localhost:3001/acg-schedule/ |
| `upload.bat` | 建置 → commit → 推上 GitHub → 自動部署 |

第一次使用請先執行一次：

```
npm install
```

> 只用到 Node.js 內建模組，沒有安裝任何額外程式。

## 介面

```
🔍 搜尋標題、說明、標籤、系列…
[依類型][依標籤]
[全部][想看][在看][完成][棄坑]
─────────────────────────────
▾ 動畫 (31)
  ▾ 進擊的巨人          ← 系列（選填，填了才會有這一層）
      第1季
      第2季
    葬送的芙莉蓮        ← 沒填系列 → 直接是作品
▸ 電玩 (48)
  ▸ 薩爾達系列
      王國之淚
─────────────────────────────
共 86 部          匯入 CSV  匯出
```

- 兩個視角：**依類型** / **依標籤**
- **搜尋會連「說明」內容一起搜** —— 記了「初代限定」，半年後搜「初代」找得到
- 沒有作品的分類、標籤、系列**自動不顯示**
- 每個分支顯示作品數量，點作品名右邊顯示詳情

## 每部作品可以填什麼

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| 標題 | ✅ | |
| 類型 | ✅ | 動畫／電玩／漫畫／小說…可自由新增 |
| 說明 | ✅ | **主要欄位**，自由敘述，寫下你想記住的 |
| 日文名稱 | | |
| 平台／主機 | | Steam、PS5、Netflix…可自由新增 |
| 系列 | | 選填，填了索引樹會多一層 |
| 狀態 | | 選填：想看／在看／完成／棄坑 |
| 標籤 | | 可自由新增 |
| 網址 | | |
| 封面網址 | | 只貼網址，不上傳檔案 |

## CSV 匯入／匯出

**匯入**：左下角「匯入 CSV」→ 選檔 → 自動對應欄位 → 預覽 → 匯入

支援欄位：`標題 / 日文名 / 類型 / 平台 / 系列 / 狀態 / 標籤 / 說明 / 網址 / 封面`

- 標頭會自動辨識（中英文皆可），也可以手動指定對應
- **標題重複預設跳過**，可勾選改成照樣新增
- 編碼：UTF-8 為主，偵測到 Big5（Excel 另存的舊格式）也能讀
- 標籤用 `|` 分隔，避免和說明裡的逗號衝突
- 匯出檔會帶 BOM，Excel 開啟不會亂碼

## 資料放在哪

**所有作品內容都在 `public/data/works.json`，這是唯一的事實來源。**

- 在網頁上按「修改／新增」→ 儲存，後端會直接寫回這個檔案
- 舊內容自動備份成 `public/data/works.backup.json`
- 手動編輯也可以，改完存檔後重新整理網頁即可

## 資料格式

```jsonc
{
  "version": 1,
  "types": ["動畫", "電玩", "漫畫", "小說"],
  "platforms": ["Netflix", "Steam"],
  "tags": ["熱血", "2026"],
  "works": [
    {
      "id": "w-aoj-1",
      "title": "進擊的巨人 第1季",         // *
      "titleOriginal": "進撃の巨人",
      "type": "動畫",                        // *
      "platform": "Netflix",
      "series": "進擊的巨人",                 // 選填
      "status": "done",                      // 選填
      "tags": ["熱血", "必看"],
      "note": "比前三季更殘酷…",               // *
      "url": "https://…",
      "cover": "https://…jpg",
      "updatedAt": "2026-10-20"
    }
  ]
}
```

`types` / `platforms` / `tags` 三個主清單在存檔時會自動補上作品用到的項目。

## 部署到 GitHub Pages

網址：<https://bob-of-light.github.io/acg-schedule/>

`vite.config.ts` 的 `base` 與 `server/server.mjs` 的 `BASE` 必須一致，
改倉庫名稱時兩個地方都要跟著改。

**更新線上網站：執行 `upload.bat`**

它會依序做四件事：建置檢查 → 儲存本機變更 → `fetch` + `rebase` 拉回線上最新內容
→ `push`。推送後 GitHub Actions 會自動重新部署，等 1～2 分鐘。

> `upload.bat` 會先 `rebase` 再推，所以**你在網頁上編輯過的作品也會自動帶回本機**，
> 不會互相衝突。

**上線後要設定的環境變數**（在 Vercel 專案 → Settings → Environment Variables）：

| 名稱 | 內容 |
| --- | --- |
| `GITHUB_TOKEN` | GitHub fine-grained token，權限只要單一倉庫的 Contents: Read and write |
| `GITHUB_REPO` | `Bob-of-light/acg-schedule` |
| `WRITE_PIN` | 你自己決定的一組數字，這是在網頁上輸入的密碼 |
| `ALLOWED_ORIGIN` | `https://bob-of-light.github.io` |

再到 GitHub 倉庫 **Settings → Secrets and variables → Actions → Variables** 新增：

```
VITE_WRITE_API_URL = https://<你的 Vercel 專案網址>
```

設定步驟詳見 `docs/online-editing.md`（與 RYOKO 專案共用同一套流程）。

**線上版本可以編輯嗎**

預設是唯讀。設定好上面的 Vercel 後端後，頁首會出現 🔒 按鈕，
輸入密碼就能在手機上直接新增／修改作品，約 1 分鐘後線上自動更新。

## 安全說明

- GitHub token 只存在 Vercel 的加密環境變數裡，**不會**進前端程式碼
- 寫入路徑有限制（只能寫 `public/data/works.json`）
- 伺服器端有防護：資料是空的不准寫入，避免誤把整份清單清掉
- 每次寫入產生 GitHub commit，資料異動都有紀錄可以回退
- `WRITE_PIN` 存在瀏覽器 localStorage，換裝置要重新輸入

## 想放棄線上編輯

把 GitHub 的 `VITE_WRITE_API_URL` 變數刪掉再重新部署，就會回到唯讀模式。
Vercel 專案也可以直接刪掉，GitHub Pages 的網站不受影響。
