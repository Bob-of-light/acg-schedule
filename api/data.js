/**
 * GET  → 回報線上寫入功能是否可用（前端用來決定要不要顯示編輯鈕）
 * POST → 覆蓋 public/data/works.json，產生一個 GitHub commit
 */
import {
  applyCors,
  checkPin,
  configReady,
  fail,
  getFile,
  putFile,
  assertAllowedPath,
  MAX_BODY_BYTES,
  REPO,
} from './_shared.js';

const DATA_PATH = 'public/data/works.json';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method === 'GET') {
    return res.status(200).json({
      online: configReady(),
      repo: REPO,
      editable: configReady(),
    });
  }

  if (req.method !== 'POST') {
    return fail(res, 405, '不支援的方法');
  }

  if (!configReady()) {
    return fail(res, 503, '伺服器尚未完成設定（缺少環境變數）');
  }

  const pinError = checkPin(req);
  if (pinError) return fail(res, 401, pinError);

  // 只驗證密碼、不寫入任何資料（前端按下編輯鈕時會呼叫）
  if (req.query?.dryRun === '1' || req.body?.dryRun === true) {
    return res.status(200).json({ ok: true, verified: true, written: false });
  }

  const raw = JSON.stringify(req.body ?? {});
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return fail(res, 413, '資料太大，超過限制');
  }

  const { data, message } = req.body ?? {};
  if (!data || typeof data !== 'object' || !Array.isArray(data.works)) {
    return fail(res, 400, '資料格式不正確');
  }
  for (const work of data.works) {
    if (!work?.id) return fail(res, 400, '有作品缺少 id');
    if (!work?.title) return fail(res, 400, '有作品缺少標題');
    if (!work?.type) return fail(res, 400, '有作品缺少類型');
  }

  try {
    assertAllowedPath(DATA_PATH);

    // 安全網：防止誤把資料清空
    const existing = await getFile(DATA_PATH);
    if (existing?.content) {
      try {
        const current = JSON.parse(Buffer.from(existing.content, 'base64').toString('utf8'));
        if (
          Array.isArray(current.works) &&
          current.works.length > 0 &&
          data.works.length === 0 &&
          req.body?.allowEmpty !== true
        ) {
          return fail(
            res,
            422,
            `拒絕寫入：目前有 ${current.works.length} 部作品，新資料是空的。` +
              `如果真的要把全部清空，請明確加上 allowEmpty: true。`,
          );
        }
      } catch {
        // 舊檔格式異常就略過這道檢查
      }
    }

    // 前端帶 base64 時優先採用，避免 JSON 重編碼造成中文亂碼
    const content =
      req.body.contentBase64 ??
      Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64');

    if (existing?.sha && req.body.baseSha && req.body.baseSha !== existing.sha) {
      return fail(res, 409, '資料已經被其他裝置改過了，請重新整理頁面後再試');
    }

    const result = await putFile(
      DATA_PATH,
      content,
      message || `更新收藏簿（${data.works.length} 部作品）`,
      existing?.sha,
    );

    return res.status(200).json({
      ok: true,
      sha: result.content?.sha,
      commitUrl: result.commit?.html_url,
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}
