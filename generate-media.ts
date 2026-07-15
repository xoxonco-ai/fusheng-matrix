// 浮生矩陣 — AI 媒體生成 Edge Function（Open Generative AI 整合）
//
// 透過 MuAPI 生成圖片／影片，回傳託管輸出 URL（可用於報告配圖、社群圖卡）。
// 核心邏輯在 muapi.ts；本函式只負責 HTTP 入口、驗證與參數轉換。
//
// 呼叫方式（需登入會員，帶 Authorization: Bearer <supabase access token>）：
//   POST，body:
//     { "type": "image", "prompt": "...", "model"?, "image_url"?, "aspect_ratio"?, "seed"? }
//     { "type": "video", "prompt": "...", "model"?, "image_url"?, "duration"?, "aspect_ratio"? }
//     { "action": "balance" }   // 查詢餘額
//   回傳：{ ok: true, url, outputs, status, request_id }
//
// ⚠️ 此函式須關閉「Verify JWT」（自行驗證）。Secrets：MUAPI_KEY、SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY
// 可選 Secret：MUAPI_BASE_URL

import { createClient } from "npm:@supabase/supabase-js@2";
import { createMuapiClient, MuapiError } from "./muapi.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!Deno.env.get("MUAPI_KEY")) return json({ error: "後端尚未設定 MUAPI_KEY 密鑰" }, 500);

  // 驗證登入會員（避免匿名濫用付費 MuAPI 金鑰）
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "請先登入" }, 401);
  const { data: user } = await admin.auth.getUser(token);
  if (!user?.user) return json({ error: "登入已過期" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "缺少內容" }, 400); }

  const muapi = createMuapiClient();

  try {
    if (body.action === "balance") {
      return json({ ok: true, ...(await muapi.getBalance()) });
    }

    const type = String(body.type || "image").toLowerCase();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const imageUrl = typeof body.image_url === "string" ? body.image_url : undefined;

    if (type === "video") {
      if (!prompt && !imageUrl) return json({ error: "video 需要 prompt 或 image_url" }, 400);
      const result = await muapi.generateVideo({
        prompt: prompt || undefined,
        model: typeof body.model === "string" ? body.model : undefined,
        imageUrl,
        aspectRatio: typeof body.aspect_ratio === "string" ? body.aspect_ratio : undefined,
        duration: typeof body.duration === "number" ? body.duration : undefined,
      });
      return json({ ok: true, url: result.url, outputs: result.outputs, status: result.status, request_id: result.requestId });
    }

    // 預設：image
    if (!prompt) return json({ error: "image 需要 prompt" }, 400);
    const result = await muapi.generateImage({
      prompt,
      model: typeof body.model === "string" ? body.model : undefined,
      imageUrl,
      aspectRatio: typeof body.aspect_ratio === "string" ? body.aspect_ratio : undefined,
      seed: typeof body.seed === "number" ? body.seed : undefined,
    });
    return json({ ok: true, url: result.url, outputs: result.outputs, status: result.status, request_id: result.requestId });
  } catch (err) {
    const status = err instanceof MuapiError && err.status ? err.status : 502;
    return json({ error: err instanceof Error ? err.message : "生成失敗" }, status);
  }
});
