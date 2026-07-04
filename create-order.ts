// 浮生矩陣 — 建立訂單 Edge Function（GoMyPay 萬事達金流・單一金流版）
//
// 兩種模式：
//   A. 一般客戶付費：建立訂單 → 回傳 GoMyPay 付款表單參數 → 前端自動送出前往付款頁
//      （單人盤 NT$199 / 合盤 NT$399；未設定 GOMYPAY_CUSTOMER_ID 時回覆「金流開通中」）
//   B. 管理員免費生成（body.free = true，需管理員登入）：
//      跳過付款 → 直接建立個案 → 觸發 AI 生成 → 報告進管理員帳號（後台可再指派給客戶）
//
// Secrets：
//   GOMYPAY_CUSTOMER_ID   商店代號
//   GOMYPAY_STR_CHECK     交易驗證密碼
//   GOMYPAY_STORE_ID      店家代號（有就設）
//   GOMYPAY_MODE          prod = 正式；未設 = GoMyPay 測試環境
//   SITE_URL              預設 https://xoxonco-ai.github.io/fusheng-matrix

import { createClient } from "npm:@supabase/supabase-js@2";

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

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ---- 驗證登入會員 ----
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "請先登入會員再購買" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "登入已過期，請重新登入" }, 401);
    const user = userData.user;

    // ---- 讀取內容 ----
    const { summary, birth, evidence, intensity, product, free } = await req.json();
    const isCouple = product === "couple";
    if (!summary || !birth) return json({ error: "缺少命盤資料，請先完成排盤" }, 400);
    if (isCouple) {
      if (!birth.p1?.birth_date || !birth.p2?.birth_date) return json({ error: "缺少兩人的出生資料，請先完成合盤" }, 400);
    } else if (!birth.birth_date) return json({ error: "缺少命盤資料，請先完成排盤" }, 400);

    const AMOUNT = isCouple ? 399 : 199;
    const ITEM = isCouple ? "浮生矩陣 合盤報告（同頻版＋碰撞版）" : "浮生矩陣 萬字報告（劇本版＋破局版）";
    const buyerName = isCouple ? (birth.p1?.name || "客戶") : (birth.name || "客戶");

    /* ============ 模式 B：管理員免費生成 ============ */
    if (free === true) {
      const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!prof || prof.role !== "admin") return json({ error: "僅限管理員使用" }, 403);

      const tradeNo = ("FR" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase().slice(0, 20);
      const { data: order, error: insErr } = await admin.from("orders").insert({
        user_id: user.id, trade_no: tradeNo, amount: 0, status: "generating",
        product: isCouple ? "couple" : "solo",
        intensity: intensity || "犀利",
        evidence: (evidence || "").trim() || null,
        summary, birth, paid_at: new Date().toISOString(),
      }).select().single();
      if (insErr) return json({ error: "建立失敗：" + insErr.message }, 500);

      // 建立個案（與付款流程同邏輯）
      const b = birth;
      const p1 = isCouple ? (b.p1 || {}) : b;
      const caseName = isCouple
        ? `${(b.p1 && b.p1.name) || "甲"} ✕ ${(b.p2 && b.p2.name) || "乙"}｜合盤`
        : (b.name || "我的命盤");
      const chartMeta: Record<string, unknown> = {};
      if (order.evidence) chartMeta.evidence = order.evidence;
      if (isCouple) chartMeta.couple = { relation: b.relation || "", p2: b.p2 || {} };
      const { data: kase, error: caseErr } = await admin.from("cases").insert({
        client_id: user.id, name: caseName,
        gender: p1.gender || null, birth_date: p1.birth_date || null, birth_time: p1.birth_time || null,
        birth_place: p1.birth_place || null, lon: p1.lon ?? null, lat: p1.lat ?? null, tz: p1.tz ?? null,
        unknown_time: !!p1.unknown_time,
        chart: Object.keys(chartMeta).length ? chartMeta : null,
        created_by: user.id,
      }).select().single();
      if (caseErr || !kase) {
        await admin.from("orders").update({ status: "failed", error: "建立個案失敗：" + (caseErr?.message || "") }).eq("id", order.id);
        return json({ error: "建立個案失敗" }, 500);
      }
      await admin.from("orders").update({ case_id: kase.id }).eq("id", order.id);

      // 只觸發第一版第一段；後續段落與第二版由 generate-report 自行接力
      const firstVersion = isCouple ? "sync" : "script";
      const job = fetch(`${SUPABASE_URL}/functions/v1/generate-report`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-key": SERVICE_KEY },
        body: JSON.stringify({ order_id: order.id, version: firstVersion, part: 0 }),
      }).catch((e) => console.error("觸發生成失敗", e));
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil?.(job);
      await new Promise((r) => setTimeout(r, 1500)); // 確保請求已送出

      return json({ free: true, ok: true, order_id: order.id, case_id: kase.id });
    }

    /* ============ 模式 A：GoMyPay 付費 ============ */
    const GMP_ID = Deno.env.get("GOMYPAY_CUSTOMER_ID");
    if (!GMP_ID) return json({ error: "線上付款開通中，暫時無法購買。請私訊 Instagram/Facebook @floating_matrix，我們手動為你服務。" }, 503);

    const tradeNo = ("FS" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase().slice(0, 20);
    const { data: order, error: insErr } = await admin.from("orders").insert({
      user_id: user.id, trade_no: tradeNo, amount: AMOUNT, status: "pending",
      product: isCouple ? "couple" : "solo",
      intensity: intensity || "犀利",
      evidence: (evidence || "").trim() || null,
      summary, birth,
    }).select().single();
    if (insErr) return json({ error: "建立訂單失敗：" + insErr.message }, 500);

    const IS_PROD = (Deno.env.get("GOMYPAY_MODE") || "").toLowerCase() === "prod";
    const ACTION = IS_PROD
      ? "https://n.gomypay.asia/ShuntClass.aspx"
      : "https://n.gomypay.asia/TestShuntClass.aspx";
    const params: Record<string, string> = {
      Send_Type: "0",
      Pay_Mode_No: "2",
      CustomerId: GMP_ID,
      Order_No: tradeNo,
      Amount: String(AMOUNT),
      TransCode: "00",
      TransMode: "1",
      Installment: "0",
      Buyer_Name: buyerName.slice(0, 20),
      Buyer_Mail: user.email || "",
      Buyer_Memo: ITEM,
      Return_url: `${SUPABASE_URL}/functions/v1/gomypay-notify?return=1`,
      Callback_Url: `${SUPABASE_URL}/functions/v1/gomypay-notify`,
    };
    return json({ action: ACTION, params, order_id: order.id, provider: "gomypay", stage: !IS_PROD });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
