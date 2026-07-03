// 浮生矩陣 — 綠界付款結果通知（Webhook）Edge Function
// 綠界付款成功後，伺服器對伺服器 POST 到這裡：
//   1. 驗證 CheckMacValue（確認真的是綠界發的、金額沒被改）
//   2. 訂單標記已付款 → 自動建立個案（掛在客戶帳號下）
//   3. 觸發 generate-report 生成「劇本版」與「破局版」兩份萬字（背景執行）
//   4. 回應綠界「1|OK」
//
// ⚠️ 部署後務必到 Edge Functions → ecpay-notify → 設定，關閉「Verify JWT」
//    （綠界的伺服器不會帶登入憑證，不關的話收不到通知）

import { createClient } from "npm:@supabase/supabase-js@2";

function dotNetUrlEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/'/g, "%27")
    .replace(/~/g, "%7e")
    .replace(/%20/g, "+");
}
async function checkMacValue(params: Record<string, string>, hashKey: string, hashIV: string): Promise<string> {
  const keys = Object.keys(params)
    .filter((k) => k !== "CheckMacValue")
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
  const raw = `HashKey=${hashKey}&` + keys.map((k) => `${k}=${params[k]}`).join("&") + `&HashIV=${hashIV}`;
  const encoded = dotNetUrlEncode(raw).toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(encoded));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

const OK = () => new Response("1|OK", { headers: { "content-type": "text/plain" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const HASH_KEY = Deno.env.get("ECPAY_HASH_KEY") || "5294y06JbISpM5x9";
  const HASH_IV = Deno.env.get("ECPAY_HASH_IV") || "v77hoKGq4kWxNNIS";
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // ---- 讀取綠界回傳（form-urlencoded）----
    const form = await req.formData();
    const p: Record<string, string> = {};
    for (const [k, v] of form.entries()) p[k] = String(v);

    // ---- 驗證 CheckMacValue ----
    const mac = await checkMacValue(p, HASH_KEY, HASH_IV);
    if (!p.CheckMacValue || mac !== p.CheckMacValue.toUpperCase()) {
      console.error("CheckMacValue 驗證失敗", p.MerchantTradeNo);
      return new Response("0|CheckMacValue Error", { status: 400 });
    }

    // ---- 找訂單 ----
    const tradeNo = p.MerchantTradeNo || "";
    const { data: order } = await admin.from("orders").select("*").eq("trade_no", tradeNo).maybeSingle();
    if (!order) { console.error("找不到訂單", tradeNo); return OK(); }

    // 重複通知（綠界會重送）→ 直接回 OK
    if (order.status !== "pending") return OK();

    // ---- 付款結果 ----
    if (p.RtnCode !== "1") {
      await admin.from("orders").update({ error: `付款未成功 RtnCode=${p.RtnCode} ${p.RtnMsg || ""}` }).eq("id", order.id);
      return OK();
    }
    // 金額核對
    if (String(p.TradeAmt) !== String(order.amount)) {
      await admin.from("orders").update({ status: "failed", error: `金額不符 TradeAmt=${p.TradeAmt}` }).eq("id", order.id);
      return OK();
    }

    // ---- 標記已付款、建立個案 ----
    const b = order.birth || {};
    const { data: kase, error: caseErr } = await admin
      .from("cases")
      .insert({
        client_id: order.user_id,
        name: b.name || "我的命盤",
        gender: b.gender || null,
        birth_date: b.birth_date || null,
        birth_time: b.birth_time || null,
        birth_place: b.birth_place || null,
        lon: b.lon ?? null, lat: b.lat ?? null, tz: b.tz ?? null,
        unknown_time: !!b.unknown_time,
        chart: order.evidence ? { evidence: order.evidence } : null,
        created_by: order.user_id,
      })
      .select()
      .single();
    if (caseErr || !kase) {
      await admin.from("orders").update({ status: "failed", error: "建立個案失敗：" + (caseErr?.message || "") }).eq("id", order.id);
      return OK();
    }
    await admin.from("orders").update({ status: "generating", paid_at: new Date().toISOString(), case_id: kase.id }).eq("id", order.id);

    // ---- 背景觸發兩版萬字生成（劇本版 + 破局版）----
    const invoke = (version: string) =>
      fetch(`${SUPABASE_URL}/functions/v1/generate-report`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-key": SERVICE_KEY },
        body: JSON.stringify({ order_id: order.id, version }),
      }).catch((e) => console.error("觸發生成失敗", version, e));

    // 先回應綠界，生成在背景繼續跑（job 建立當下就已開始執行）
    const job = Promise.allSettled([invoke("script"), invoke("breakthrough")]);
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil?.(job);

    return OK();
  } catch (e) {
    console.error("ecpay-notify 錯誤", e);
    // 回 200 避免綠界瘋狂重送；錯誤已記 log
    return OK();
  }
});
