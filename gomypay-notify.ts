// 浮生矩陣 — GoMyPay（萬事達金流）付款結果通知 Edge Function
// 兩種進入方式（同一支函式）：
//   1. Callback_Url 背景通知（伺服器對伺服器 POST）→ 驗證 → 標記付款 → 觸發自動生成 → 回 "OK"
//   2. Return_url?return=1 瀏覽器導回（付款完成頁）→ 同樣處理（冪等）→ 302 轉回網站報告頁
//
// 回傳驗證：str_check = md5(result + e_orderno + Store_Id + e_money + OrderID + 交易驗證密碼)
//
// ⚠️ 部署後務必到 Edge Functions → gomypay-notify → 設定，關閉「Verify JWT」
//
// Secrets：GOMYPAY_STR_CHECK（交易驗證密碼，必要）、GOMYPAY_STORE_ID（店家代號，建議設）、SITE_URL

import { createClient } from "npm:@supabase/supabase-js@2";
import { crypto as stdCrypto } from "jsr:@std/crypto@1/crypto";

async function md5hex(s: string): Promise<string> {
  const d = await stdCrypto.subtle.digest("MD5", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SITE_URL = (Deno.env.get("SITE_URL") || "https://xoxonco-ai.github.io/fusheng-matrix").replace(/\/$/, "");
  const STR_CHECK = Deno.env.get("GOMYPAY_STR_CHECK") || "";
  const STORE_ID = Deno.env.get("GOMYPAY_STORE_ID") || "";
  const CUSTOMER_ID = Deno.env.get("GOMYPAY_CUSTOMER_ID") || "";
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const url = new URL(req.url);
  const isReturn = url.searchParams.get("return") === "1";
  const backToSite = () =>
    new Response(null, { status: 302, headers: { Location: `${SITE_URL}/report.html?from=pay` } });
  const ok = () => (isReturn ? backToSite() : new Response("OK", { headers: { "content-type": "text/plain" } }));

  try {
    // ---- 讀取回傳參數（POST form 或 GET query 都支援）----
    const p: Record<string, string> = {};
    url.searchParams.forEach((v, k) => (p[k] = v));
    if (req.method === "POST") {
      try {
        const form = await req.formData();
        for (const [k, v] of form.entries()) p[k] = String(v);
      } catch (_) { /* 沒有 body 就用 query */ }
    }

    const tradeNo = p.e_orderno || p.Order_No || "";
    if (!tradeNo) return ok();

    // ---- 找訂單（冪等：背景通知與導回都會進來）----
    const { data: order } = await admin.from("orders").select("*").eq("trade_no", tradeNo).maybeSingle();
    if (!order) { console.error("找不到訂單", tradeNo); return ok(); }
    if (order.status !== "pending") return ok(); // 已處理過

    // ---- 付款結果 ----
    if (String(p.result) !== "1") {
      await admin.from("orders").update({ error: `付款未成功 result=${p.result} ${p.ret_msg || ""}` }).eq("id", order.id);
      return ok();
    }

    // ---- 驗證 str_check（嘗試多個 Store_Id 候選值，避免後台欄位命名差異）----
    if (STR_CHECK) {
      const candidates = [...new Set([STORE_ID, CUSTOMER_ID, ""])];
      let valid = false;
      for (const sid of candidates) {
        const mac = await md5hex(`${p.result}${p.e_orderno || ""}${sid}${p.e_money || ""}${p.OrderID || ""}${STR_CHECK}`);
        if (mac.toLowerCase() === String(p.str_check || "").toLowerCase()) { valid = true; break; }
      }
      if (!valid) {
        console.error("str_check 驗證失敗", tradeNo, p.str_check);
        await admin.from("orders").update({ error: "str_check 驗證失敗（請確認 GOMYPAY_STORE_ID / GOMYPAY_STR_CHECK 設定）" }).eq("id", order.id);
        return ok();
      }
    } else {
      console.warn("未設定 GOMYPAY_STR_CHECK，跳過驗證（僅限測試）", tradeNo);
    }

    // ---- 金額核對 ----
    if (p.e_money && String(parseInt(p.e_money, 10)) !== String(order.amount)) {
      await admin.from("orders").update({ status: "failed", error: `金額不符 e_money=${p.e_money}` }).eq("id", order.id);
      return ok();
    }

    // ---- 標記已付款、建立個案（單人盤 / 合盤）----
    const b = order.birth || {};
    const isCouple = order.product === "couple";
    const p1 = isCouple ? (b.p1 || {}) : b;
    const caseName = isCouple
      ? `${(b.p1 && b.p1.name) || "甲"} ✕ ${(b.p2 && b.p2.name) || "乙"}｜合盤`
      : (b.name || "我的命盤");
    const chartMeta: Record<string, unknown> = {};
    if (order.evidence) chartMeta.evidence = order.evidence;
    if (isCouple) chartMeta.couple = { relation: b.relation || "", p2: b.p2 || {} };
    const { data: kase, error: caseErr } = await admin.from("cases").insert({
      client_id: order.user_id,
      name: caseName,
      gender: p1.gender || null,
      birth_date: p1.birth_date || null,
      birth_time: p1.birth_time || null,
      birth_place: p1.birth_place || null,
      lon: p1.lon ?? null, lat: p1.lat ?? null, tz: p1.tz ?? null,
      unknown_time: !!p1.unknown_time,
      chart: Object.keys(chartMeta).length ? chartMeta : null,
      created_by: order.user_id,
    }).select().single();
    if (caseErr || !kase) {
      await admin.from("orders").update({ status: "failed", error: "建立個案失敗：" + (caseErr?.message || "") }).eq("id", order.id);
      return ok();
    }
    await admin.from("orders").update({
      status: "generating", paid_at: new Date().toISOString(), case_id: kase.id,
    }).eq("id", order.id);

    // ---- 背景觸發兩版萬字生成 ----
    const invoke = (version: string) =>
      fetch(`${SUPABASE_URL}/functions/v1/generate-report`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-key": SERVICE_KEY },
        body: JSON.stringify({ order_id: order.id, version }),
      }).catch((e) => console.error("觸發生成失敗", version, e));

    const versions = isCouple ? ["sync", "clash"] : ["script", "breakthrough"];
    const job = Promise.allSettled(versions.map(invoke));
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil?.(job);

    return ok();
  } catch (e) {
    console.error("gomypay-notify 錯誤", e);
    return ok();
  }
});
