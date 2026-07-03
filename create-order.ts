// 浮生矩陣 — 建立 NT$199 訂單（綠界 ECPay）Edge Function
// 前端（已登入會員）送來：命盤摘要 + 出生資料 + 佐證(選填) + 力道
// → 建立 orders 訂單 → 回傳綠界付款表單參數（含 CheckMacValue）
// → 前端自動送出表單，把客戶帶去綠界付款頁
//
// 需要的 Secrets（Edge Functions → Secrets）：
//   ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV   （正式金鑰；未設定時用綠界測試環境）
//   ECPAY_MODE = stage 或 prod                            （預設 stage 測試環境）
//   SITE_URL（預設 https://xoxonco-ai.github.io/fusheng-matrix）

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

// ===== 綠界 CheckMacValue（EncryptType=1, SHA256）=====
// .NET 風格 URL encode：空白→+；' 與 ~ 需編碼；- _ . ! * ( ) 保留
function dotNetUrlEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/'/g, "%27")
    .replace(/~/g, "%7e")
    .replace(/%20/g, "+");
}
export async function checkMacValue(params: Record<string, string>, hashKey: string, hashIV: string): Promise<string> {
  const keys = Object.keys(params)
    .filter((k) => k !== "CheckMacValue")
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
  const raw = `HashKey=${hashKey}&` + keys.map((k) => `${k}=${params[k]}`).join("&") + `&HashIV=${hashIV}`;
  const encoded = dotNetUrlEncode(raw).toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(encoded));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function tradeDateTaipei(): string {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}/${p(t.getUTCMonth() + 1)}/${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MODE = (Deno.env.get("ECPAY_MODE") || "stage").toLowerCase();
    const IS_PROD = MODE === "prod";
    // 未設定正式金鑰時，使用綠界官方「測試環境」商店（可走完整流程但不會真的扣款）
    const MERCHANT_ID = Deno.env.get("ECPAY_MERCHANT_ID") || "2000132";
    const HASH_KEY = Deno.env.get("ECPAY_HASH_KEY") || "5294y06JbISpM5x9";
    const HASH_IV = Deno.env.get("ECPAY_HASH_IV") || "v77hoKGq4kWxNNIS";
    const SITE_URL = (Deno.env.get("SITE_URL") || "https://xoxonco-ai.github.io/fusheng-matrix").replace(/\/$/, "");
    const ACTION = IS_PROD
      ? "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5"
      : "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";

    // ---- 驗證登入會員 ----
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "請先登入會員再購買" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "登入已過期，請重新登入" }, 401);
    const user = userData.user;

    // ---- 讀取購買內容 ----
    const { summary, birth, evidence, intensity } = await req.json();
    if (!summary || !birth || !birth.birth_date) return json({ error: "缺少命盤資料，請先完成排盤" }, 400);

    // ---- 建立訂單 ----
    const tradeNo = ("FS" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase().slice(0, 20);
    const { data: order, error: insErr } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        trade_no: tradeNo,
        amount: 199,
        status: "pending",
        intensity: intensity || "犀利",
        evidence: (evidence || "").trim() || null,
        summary,
        birth,
      })
      .select()
      .single();
    if (insErr) return json({ error: "建立訂單失敗：" + insErr.message }, 500);

    // ---- 組綠界付款參數 ----
    const params: Record<string, string> = {
      MerchantID: MERCHANT_ID,
      MerchantTradeNo: tradeNo,
      MerchantTradeDate: tradeDateTaipei(),
      PaymentType: "aio",
      TotalAmount: "199",
      TradeDesc: "FushengMatrix Full Report",
      ItemName: "浮生矩陣 萬字報告（劇本版＋破局版）",
      ReturnURL: `${SUPABASE_URL}/functions/v1/ecpay-notify`,
      ClientBackURL: `${SITE_URL}/report.html?from=pay`,
      ChoosePayment: Deno.env.get("ECPAY_CHOOSE_PAYMENT") || "Credit",
      EncryptType: "1",
      CustomField1: order.id,
    };
    params.CheckMacValue = await checkMacValue(params, HASH_KEY, HASH_IV);

    return json({ action: ACTION, params, order_id: order.id, stage: !IS_PROD });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
