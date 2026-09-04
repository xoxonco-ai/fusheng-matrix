# MuAPI 媒體生成整合（Open Generative AI）

把 [Open Generative AI](https://github.com/Anil-matcha/Open-Generative-AI) 的媒體引擎
[MuAPI](https://muapi.ai)（200+ 圖像／影片模型：Flux、Nano Banana、Kling、Seedance、Veo…）
接進浮生矩陣後端，用來生成報告配圖、社群圖卡等素材。

## 檔案

| 檔案 | 說明 |
|------|------|
| `muapi.ts` | MuAPI client 模組（Deno）：文字生圖、圖生圖、文字生影片、圖生影片、查餘額 |
| `generate-media.ts` | Supabase Edge Function：HTTP 入口，驗證登入會員後呼叫 `muapi.ts` |

## Secrets（Supabase → Edge Functions → Secrets）

```
MUAPI_KEY=<你的 MuAPI 金鑰>          # 必填，於 https://muapi.ai 取得
MUAPI_BASE_URL=https://api.muapi.ai  # 可選，覆寫端點
```

（`generate-media.ts` 另需既有的 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 來驗證會員登入。）

> ⚠️ 金鑰只放在 Secret，不寫進程式或前端。部署此函式時關閉「Verify JWT」（函式內自行驗證登入）。

## 部署

```bash
supabase functions deploy generate-media --no-verify-jwt
```

## 呼叫（需帶會員的 access token）

```js
const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-media`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    type: "image",          // "image" | "video"
    prompt: "溫暖光線的療癒場景，柔和漸層",
    aspect_ratio: "1:1",    // 可選
    // model: "flux-dev",   // 可選，覆寫預設模型
    // image_url: "...",    // 提供時 image→圖生圖 / video→圖生影片
    // duration: 5,         // video 可選
  }),
});
const { url, outputs, status, request_id } = await res.json();
// url = MuAPI 託管的輸出資產連結
```

查餘額：`body: { "action": "balance" }`。

## 預設模型

| 任務 | 預設端點 |
|------|----------|
| 文字 → 圖 | `flux-dev` |
| 圖 → 圖（編輯） | `nano-banana` |
| 文字 → 影片 | `seedance-lite-t2v` |
| 圖 → 影片 | `wan2.1-image-to-video` |

可用 `model` 傳入任一 MuAPI 端點覆寫（如 `kling-v2.5-turbo-pro-t2v`、`veo3-fast-text-to-video`）。

## 協定摘要

| 動作 | 請求 |
|------|------|
| 送出 | `POST https://api.muapi.ai/api/v1/{model}`，header `x-api-key` → `{ request_id }` |
| 輪詢 | `GET /api/v1/predictions/{request_id}/result` → `{ status, outputs[] }` |
| 餘額 | `GET /api/v1/account/balance` → `{ balance }` |

模組自動輪詢至 `completed`（影片預設最長約 30 分鐘），並容忍輪詢期間的暫時性網路錯誤；
終端失敗或逾時丟出 `MuapiError`。
