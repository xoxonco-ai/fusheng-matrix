// 浮生矩陣 — AI 生成報告 Edge Function（v2：真正萬字・白話・強佐證）
//
// 兩種呼叫方式：
//   A. 付費自動生成（ecpay-notify 內部觸發）：
//      header 帶 x-internal-key = service role key，body { order_id, version }
//      → 讀訂單 → 分三段生成約萬字 → 直接寫入 reports（發布＋解鎖）→ 更新訂單狀態
//   B. 管理後台手動生成（admin.html）：
//      body { summary, name, version, evidence, intensity }（需管理員登入）
//      → 回傳 { excerpt, full } 給後台填入編輯框
//
// ⚠️ 部署後到 Edge Functions → generate-report → 設定，關閉「Verify JWT」
//    （內部觸發不帶使用者 JWT；管理員身分改由程式內自行驗證，更安全）
//
// Secrets：ANTHROPIC_API_KEY（必要）

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

const MODEL = "claude-sonnet-4-6";

/* ============================================================
   語氣與規則（白話・佐證・準確感）
============================================================ */
const toneMap: Record<string, string> = {
  "溫和": "【力道：溫和】語氣溫柔、包容，像很懂你的朋友坐在旁邊輕輕跟你說。一樣要說中、要精準，但點到為止，多給理解與肯定，讓人讀完是被接住、被疼惜的感覺。",
  "犀利": "【力道：犀利】語氣直接、一針見血，先說中那一刀再展開，但出於善意，目的是讓人被看穿後鬆一口氣。",
  "狠": "【力道：狠】語氣更直球、更不留情面，敢把最痛、最不願承認的真相講白，逼他正視——但絕不是羞辱，是『狠在點上、暖在底層』，結尾仍要把人接住。",
};

function buildSystem(intensity: string): string {
  const tone = toneMap[intensity] || toneMap["犀利"];
  return (
    "你是「浮生矩陣」的命理解讀作者，融合八字、紫微斗數、西洋占星、人類圖四套系統，" +
    "並借鏡榮格（陰影/原型）、坎伯（英雄旅程）、弗蘭克（意義）等視角。\n" +
    "\n【讀者設定】讀的人完全不懂命理。他不在乎術語，只在乎「你講的是不是我」。\n" +
    "\n【白話鐵律——最高優先】\n" +
    "①整篇用日常口語寫，像一個很懂命理、但講話很白的朋友在旁邊跟他聊。短句、可以斷句、可以反問。\n" +
    "②任何術語（日主、四化、宮位、閘門、通道、上升、十神…）第一次出現時，必須立刻用一句白話翻譯，" +
    "格式例：『你的日主是壬水——講白了，你的出廠設定是一條大河：平常看起來平靜，其實底下水流又急又深。』\n" +
    "③術語只當「證據出處」輕輕帶過，白話的人話才是主體。禁止教科書腔、學術腔、文謅謅。\n" +
    "\n【準確感策略——讓他一路打勾】\n" +
    "①每一章至少埋 3 句「可打勾」的具體生活情境，用『你是不是常常…』『別人眼中的你…』『你有沒有發現，每次…』這類句式，" +
    "寫到具體的場景（深夜、訊息已讀、開會、吵架後、領薪日…），讓他邊讀邊在心裡打勾。\n" +
    "②每一個論斷都要扣回具體命盤特徵，但用括號輕巧標註出處即可，例：（依據：你的月亮在天蠍——白話說，你的情緒習慣往深處藏）。\n" +
    "③嚴禁巴納姆式套話（『你外表堅強內心柔軟』這種對誰都成立的話）、嚴禁模稜兩可與兩面討好。寧可講窄講深，不要講寬講淺。\n" +
    "\n【必含的可驗證佐證】\n" +
    "①「關卡年」：把命盤摘要提供的年份寫成可被打勾的句子：『你在西元__年前後（約__歲），應該經歷過一段低谷、變動或重大抉擇』（抓前後一兩年，不要講死）。挑 2~3 個最關鍵的。\n" +
    "②「父母線索」：用摘要裡的印星/財星/父母宮，寫一段他與父母的關係與性格議題（例：與母親情感疏離、從小扛著父親的期待）。只談關係與議題，嚴禁編造姓氏、名字、具體事件。\n" +
    "③「日常線索」：從五行偏枯、月亮星座、人類圖類型推 2~3 個他大概率有的生活慣性（例：休息時也停不下來、答應別人的事快到期限才做、一個人獨處才能充電）。\n" +
    "這些段落的目的是讓他覺得「你怎麼會知道」。\n" +
    "\n【誠實邊界】只根據提供的命盤摘要推論，不杜撰未提供的數據；不算生死、不斷病症、不給醫療/投資/法律指示；" +
    "命盤講的是「傾向與結構」，語氣要讓人感到方向感，而不是宿命論。\n" +
    "\n【最重要的任務｜痛點】整份報告圍繞一件事：找出這個人『最痛、最反覆卡住、最不願意承認』的那一個核心痛點，" +
    "開場就直接講出來、講到他心頭一震，之後每一章都從不同角度回到這個痛點，不要平均分配、不要面面俱到。\n" +
    "大量用第二人稱「你」。多用『你以為…其實…』點破他以為是個性、其實是防衛機制的地方。\n\n" + tone
  );
}

/* ============================================================
   章節規劃（兩版 × 各三段生成 ≈ 各一萬字）
============================================================ */
type Plan = { label: string; goal: string; chapters: string[]; splits: [number, number][] };
const PLANS: Record<string, Plan> = {
  script: {
    label: "劇本版",
    goal:
      "把四套系統『共同指向』的人生主線一針見血地點出來：這個人到底是用什麼結構在活。" +
      "開場第一段就給最準的一句總綱。",
    chapters: [
      "一、基礎命盤總覽——用白話把四套系統各自看到的他講一遍，然後指出四套同時指向的那件事。本章必須包含「這些年你應該經歷過」段落：關卡年 2~3 個＋父母線索＋2~3 個日常線索，全部寫成可打勾的句子",
      "二、人生羅盤——你的優勢（講到他敢承認自己厲害）、你的盲點（講到他臉熱）、給你的一句話",
      "三、劇本原型——他的核心人格結構，給這個原型取一個好記、有畫面的名字，並解釋這個原型的劇情通常怎麼展開",
      "四、運作方式——他怎麼思考、怎麼做決定、怎麼推動事情；哪個環節最順、哪個環節最容易當機",
      "五、三大人生場域——事業／關係／金錢：看似三個題目，其實是同一套底層機制的三個現場，逐一拆",
      "六、隱藏關卡——最容易被忽略、卻最會讓人生卡住的地方；他繞不過去時通常長什麼樣子",
      "七、思維工具箱——為他量身打造 3~4 個思考工具，每個都要具體到「明天遇到事就能拿出來用」，並說明為什麼這工具剛好剋他的結構",
      "八、軍團編制——把他的命盤翻成一套角色系統（主帥、軍師、先鋒、後勤…each 對應具體命盤特徵），讓抽象結構變成可以叫得出名字的隊友",
      "九、最終總結——一份濃縮的人生說明書：他是誰、他怎麼運作、他適合怎麼前進。收在溫暖而有力的一段話",
    ],
    splits: [[0, 2], [3, 5], [6, 8]],
  },
  breakthrough: {
    label: "破局版",
    goal:
      "專挑四套系統互相『矛盾、打架』之處，以及藏在盲區的自我欺騙，一刀切進核心。" +
      "開場直接戳破他最相信、卻最困住他的那個故事。",
    chapters: [
      "一、四張不同的臉——四套系統眼中的他，哪裡根本不是同一個人；每一張臉都要具體到生活場景。本章也要埋入關卡年與日常線索的可打勾句",
      "二、矛盾羅盤——哪些地方四套一致（那是底盤）、哪些地方正在打架（那是訊號）；最大的那組矛盾就是他反覆卡住的結構原因",
      "三、自我敘事拆解——他講給自己聽的那套故事：多少來自結構（真的）、多少來自盔甲（保護機制）；含父母線索：這套盔甲最早是為了應付誰",
      "四、劇本迴圈——從情緒→語言→行動→信念，一層一層往下拆他的慣性迴圈，每一層都給具體例句（他常說的話、常做的事）",
      "五、用錯版本的自己——事業／關係／金錢：他最常在哪個場合演錯角色、用錯力，各給一個典型場景重演",
      "六、思維病毒掃描——逐條點名那些聽起來合理、卻讓他繞圈的念頭（3~5 條），每條都寫出這個念頭的『偽裝』與『實際作用』",
      "七、軍團叛將——最讓他頭痛的那個內在角色：它怎麼搗亂、它其實想保護什麼、把它放回哪個位置就變戰力",
      "八、最終總結——真正困住他的核心模式一句話講清，下一步該校正什麼給出明確方向。狠在點上、暖在底層，最後把人接住",
    ],
    splits: [[0, 2], [3, 5], [6, 7]],
  },
};

/* ============================================================
   生成（分三段呼叫，串成完整萬字）
============================================================ */
async function callClaude(apiKey: string, system: string, prompt: string, maxTokens = 7000): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || "AI 服務回應錯誤");
  let text = (data?.content?.[0]?.text ?? "").trim();
  return text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
}

function evidenceBlock(evidence: string): string {
  const ev = (evidence || "").trim();
  if (!ev) return "";
  return (
    `\n\n【這個人自己說的、真實發生過的事（鐵證）】\n${ev}\n` +
    `→ 把這件事當成最有力的佐證：在報告中至少一次明確點名它，說清楚它如何精準對應命盤結構（哪個特徵推得出來），` +
    `讓他讀到時起雞皮疙瘩。但只用這一件事，不要再杜撰其他事件。\n`
  );
}

async function generateFull(
  apiKey: string,
  args: { summary: string; version: string; evidence?: string; intensity?: string },
): Promise<{ excerpt: string; full: string }> {
  const plan = PLANS[args.version === "breakthrough" ? "breakthrough" : "script"];
  const system = buildSystem(args.intensity || "犀利");
  const evb = evidenceBlock(args.evidence || "");
  const chapterList = (s: [number, number]) =>
    plan.chapters.slice(s[0], s[1] + 1).map((c) => "・" + c).join("\n");

  let excerpt = "";
  let full = "";

  for (let i = 0; i < plan.splits.length; i++) {
    const isFirst = i === 0;
    const isLast = i === plan.splits.length - 1;
    let prompt = `【此人命盤資料】\n${args.summary}${evb}\n\n`;

    if (isFirst) {
      prompt +=
        `【任務】撰寫「${plan.label}」報告（完整版約一萬字，分三次寫，這是第一次）。\n${plan.goal}\n\n` +
        `這一次只寫以下章節（每章約 1000~1300 字，用 markdown 小標題）：\n${chapterList(plan.splits[i])}\n\n` +
        `請嚴格依下列格式輸出（不要 JSON、不要程式碼圍欄、不要多餘說明）：\n\n` +
        `===千字精華===\n（約 500~700 字：開場一句最準的總綱＋四套系統各一小段＋一段綜合。` +
        `要白話、要有打勾句，結尾留鉤子讓人想看完整版，但不要寫「請購買」之類的話）\n\n` +
        `===報告開始===\n（接著寫上面指定的章節）`;
    } else {
      const tail = full.length > 3000 ? full.slice(-3000) : full;
      prompt +=
        `【任務】你正在撰寫「${plan.label}」報告（約一萬字，分三次寫，這是第 ${i + 1} 次）。\n` +
        `以下是前文的結尾（供銜接語氣與避免重複，不要重寫這些內容）：\n…${tail}\n\n` +
        `請無縫接著寫以下章節（每章約 1000~1300 字，markdown 小標題，開頭不要再放總標題或開場白）：\n${chapterList(plan.splits[i])}\n` +
        (isLast
          ? `\n**這是最後一段：務必把「最終總結」完整寫完、好好收尾，絕對不能截斷。**`
          : `\n寫完指定章節就停，不要提前寫後面的章節。`);
    }

    const text = await callClaude(apiKey, system, prompt);

    if (isFirst) {
      const TAG_E = "===千字精華===";
      const TAG_F = "===報告開始===";
      const iF = text.indexOf(TAG_F);
      if (iF >= 0) {
        const iE = text.indexOf(TAG_E);
        excerpt = text.slice(iE >= 0 ? iE + TAG_E.length : 0, iF).trim();
        full = text.slice(iF + TAG_F.length).trim();
      } else {
        full = text.replace(TAG_E, "").trim();
      }
    } else {
      full += "\n\n" + text;
    }
  }
  return { excerpt, full };
}

/* ============================================================
   HTTP 入口
============================================================ */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "後端尚未設定 ANTHROPIC_API_KEY 密鑰" }, 500);
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "缺少內容" }, 400); }

  /* ---------- 模式 A：付費訂單自動生成（內部觸發） ---------- */
  if (body.order_id) {
    if (req.headers.get("x-internal-key") !== SERVICE_KEY) return json({ error: "未授權" }, 401);
    const version = body.version === "breakthrough" ? "breakthrough" : "script";
    const { data: order } = await admin.from("orders").select("*").eq("id", body.order_id).maybeSingle();
    if (!order) return json({ error: "找不到訂單" }, 404);
    if (!order.case_id) return json({ error: "訂單尚未建立個案" }, 400);

    try {
      const { excerpt, full } = await generateFull(apiKey, {
        summary: order.summary,
        version,
        evidence: order.evidence || "",
        intensity: order.intensity || "犀利",
      });

      // 寫入報告：直接發布＋解鎖（客戶已付費）
      const { data: existing } = await admin.from("reports").select("id").eq("case_id", order.case_id).eq("version", version).maybeSingle();
      const payload = { case_id: order.case_id, version, excerpt, full_content: full, published: true, full_unlocked: true };
      if (existing) await admin.from("reports").update(payload).eq("id", existing.id);
      else await admin.from("reports").insert(payload);

      // 兩版都完成 → 訂單標記 done
      const { data: reps } = await admin.from("reports").select("version").eq("case_id", order.case_id).eq("published", true);
      const vs = new Set((reps || []).map((r: { version: string }) => r.version));
      if (vs.has("script") && vs.has("breakthrough")) {
        await admin.from("orders").update({ status: "done" }).eq("id", order.id);
      }
      return json({ ok: true, version });
    } catch (e) {
      await admin.from("orders").update({ status: "failed", error: `${version} 生成失敗：${String(e)}` }).eq("id", order.id);
      return json({ error: String(e) }, 500);
    }
  }

  /* ---------- 模式 B：管理後台手動生成 ---------- */
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "請先登入" }, 401);
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user) return json({ error: "登入已過期" }, 401);
  const { data: prof } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (!prof || prof.role !== "admin") return json({ error: "僅限管理員使用" }, 403);

  const { summary, name, version, evidence, intensity } = body as Record<string, string>;
  if (!summary) return json({ error: "缺少命盤摘要 summary" }, 400);
  try {
    const { excerpt, full } = await generateFull(apiKey, { summary, version, evidence, intensity });
    return json({ excerpt, full, name, version });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
