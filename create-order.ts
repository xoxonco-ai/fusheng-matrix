// 浮生矩陣 — 建立 NT$199 訂單 Edge Function（GoMyPay 萬事達金流版）
// 前端（已登入會員）送來：命盤摘要 + 出生資料 + 佐證(選填) + 力道
// → 建立 orders 訂單 → 回傳金流付款表單參數 → 前端自動送出表單前往付款頁
//
// 金流判斷：
//   已設定 GOMYPAY_CUSTOMER_ID → 走 GoMyPay（GOMYPAY_MODE=prod 正式 / 其他值走測試環境）
//   未設定                     → 走綠界 ECPay 測試環境（方便還沒申請 GoMyPay 前先測流程）
//
// 需要的 Secrets（Edge Functions → Secrets）：
//   GOMYPAY_CUSTOMER_ID   商店代號（GoMyPay 後台取得）
//   GOMYPAY_STR_CHECK     交易驗證密碼（GoMyPay 後台設定的那組）
//   GOMYPAY_STORE_ID      店家代號（若後台有此欄位；用於回傳驗證，沒有可不設）
//   GOMYPAY_MODE          prod = 正式環境；未設或其他值 = 測試環境
//   SITE_URL              預設 https://xoxonco-ai.github.io/fusheng-matrix

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

/* ===== 綠界 CheckMacValue（備援測試用） ===== */
function dotNetUrlEncode(s: string): string {
  return encodeURIComponent(s).replace(/'/g, "%27").replace(/~/g, "%7e").replace(/%20/g, "+");
}
async function checkMacValue(params: Record<string, string>, hashKey: string, hashIV: string): Promise<string> {
  const keys = Object.keys(params).filter((k) => k !== "CheckMacValue")
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
  const raw = `HashKey=${hashKey}&` + keys.map((k) => `${k}=${params[k]}`).join("&") + `&HashIV=${hashIV}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dotNetUrlEncode(raw).toLowerCase()));
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
    const SITE_URL = (Deno.env.get("SITE_URL") || "https://xoxonco-ai.github.io/fusheng-matrix").replace(/\/$/, "");

    // ---- 驗證登入會員 ----
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "請先登入會員再購買" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "登入已過期，請重新登入" }, 401);
    const user = userData.user;

    // ---- 讀取購買內容 ----
    const { summary, birth, evidence, intensity, product } = await req.json();
    const isCouple = product === "couple";
    if (!summary || !birth) return json({ error: "缺少命盤資料，請先完成排盤" }, 400);
    if (isCouple) {
      if (!birth.p1?.birth_date || !birth.p2?.birth_date) return json({ error: "缺少兩人的出生資料，請先完成合盤" }, 400);
    } else if (!birth.birth_date) return json({ error: "缺少命盤資料，請先完成排盤" }, 400);

    const AMOUNT = isCouple ? 399 : 199;
    const ITEM = isCouple ? "浮生矩陣 合盤報告（同頻版＋碰撞版）" : "浮生矩陣 萬字報告（劇本版＋破局版）";
    const buyerName = isCouple ? (birth.p1?.name || "客戶") : (birth.name || "客戶");

    // ---- 建立訂單 ----
    const tradeNo = ("FS" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase().slice(0, 20);
    const { data: order, error: insErr } = await admin.from("orders").insert({
      user_id: user.id,
      trade_no: tradeNo,
      amount: AMOUNT,
      status: "pending",
      product: isCouple ? "couple" : "solo",
      intensity: intensity || "犀利",
      evidence: (evidence || "").trim() || null,
      summary,
      birth,
    }).select().single();
    if (insErr) return json({ error: "建立訂單失敗：" + insErr.message }, 500);

    /* ================= GoMyPay 萬事達金流 ================= */
    const GMP_ID = Deno.env.get("GOMYPAY_CUSTOMER_ID");
    if (GMP_ID) {
      const IS_PROD = (Deno.env.get("GOMYPAY_MODE") || "").toLowerCase() === "prod";
      const ACTION = IS_PROD
        ? "https://n.gomypay.asia/ShuntClass.aspx"
        : "https://n.gomypay.asia/TestShuntClass.aspx";
      const params: Record<string, string> = {
        Send_Type: "0",              // 信用卡
        Pay_Mode_No: "2",            // 支付模式
        CustomerId: GMP_ID,
        Order_No: tradeNo,
        Amount: String(AMOUNT),
        TransCode: "00",             // 授權
        TransMode: "1",              // 一般交易
        Installment: "0",            // 不分期
        Buyer_Name: buyerName.slice(0, 20),
        Buyer_Mail: user.email || "",
        Buyer_Memo: ITEM,
        Return_url: `${SUPABASE_URL}/functions/v1/gomypay-notify?return=1`, // 付款完成後瀏覽器導回（會再轉回網站）
        Callback_Url: `${SUPABASE_URL}/functions/v1/gomypay-notify`,        // 背景通知
      };
      return json({ action: ACTION, params, order_id: order.id, provider: "gomypay", stage: !IS_PROD });
    }

    /* ================= 備援：綠界測試環境 ================= */
    const MERCHANT_ID = Deno.env.get("ECPAY_MERCHANT_ID") || "2000132";
    const HASH_KEY = Deno.env.get("ECPAY_HASH_KEY") || "5294y06JbISpM5x9";
    const HASH_IV = Deno.env.get("ECPAY_HASH_IV") || "v77hoKGq4kWxNNIS";
    const params: Record<string, string> = {
      MerchantID: MERCHANT_ID,
      MerchantTradeNo: tradeNo,
      MerchantTradeDate: tradeDateTaipei(),
      PaymentType: "aio",
      TotalAmount: String(AMOUNT),
      TradeDesc: "FushengMatrix Full Report",
      ItemName: ITEM,
      ReturnURL: `${SUPABASE_URL}/functions/v1/ecpay-notify`,
      ClientBackURL: `${SITE_URL}/report.html?from=pay`,
      ChoosePayment: "Credit",
      EncryptType: "1",
      CustomField1: order.id,
    };
    params.CheckMacValue = await checkMacValue(params, HASH_KEY, HASH_IV);
    return json({
      action: "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
      params, order_id: order.id, provider: "ecpay", stage: true,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
