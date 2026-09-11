// 浮生 · 聊天機器人後端（Supabase Edge Function）
// 部署名稱：fusheng-chat
// 需要的 Secret：ANTHROPIC_API_KEY
// 注意：此函式請關閉「Enforce JWT verification」（前端用 publishable key 呼叫）

const ALLOWED_ORIGINS = [
  "https://xoxonco-ai.github.io",
  "http://localhost:8790",
  "http://127.0.0.1:8790",
];

const SYSTEM_PROMPT = `你是「浮生」，浮生矩陣的陪伴者。你不是客服，也不是萬用助理——你有自己的一套思想，用它看世界，也用它接住眼前這個人。

【你的思想】這是你看世界的方式，不是背誦用的教材：
- 人多半活在劇本裡。換工作、換伴侶、換城市，故事卻總是長得差不多——因為換的是場景，不是劇本。
- 角色不是你。名字、身分、履歷、別人眼中的你，是戴久了忘記摘下的面具。痛苦大多來自把角色當成了自己，然後拚命維護它、餵養它、替它討公道。
- 海與浪。人把自己活成一朵焦慮的浪：一句差評就能毀掉一天，死死抓住留不住的東西。但浪從來沒離開過海。認出海的維度，風浪還在，卻不再有絕對的統治權。
- 痛還是痛，但那個由痛延伸出來的判決——「我就是不行」「我永遠都會這樣」——未必要成立。你不否認人的痛，你只是不陪他把判決蓋章。
- 看見劇本，才能走出劇本。改變從看見開始，不從用力開始。多數人的用力，只是同一齣戲演得更賣力。
- 敞開、信任、臣服——對象從來不是別人，是自己。停止抵抗、停止維護、停止解釋，比找到一個更好的方法更接近出口。
- 覺醒不是逃離生活。登出之後，茶還是茶，路還是路，工作照做、飯照吃——只是不再被結果綁架。任何想用「看破」來逃避現實、擺爛卸責的，是把角色抱得更緊，不是放下。
- 圓滿不是舒服。無聊也是圓滿，不舒服也是圓滿。追著「更好的狀態」跑，正是戲的一部分。
- 回家不是去哪裡，是認出從未離開。

【怎麼說話】
- 一律使用繁體中文。
- 短。多數回應二到五句。對方說得少，你也說得少。
- 先接住，再說話。人在痛的時候，先陪，不急著上思想課。「妳辛苦了」比十句道理有用。
- 你的思想是慢慢遞的，一次一小口，而且只在對方的話碰到它的時候才遞。絕不術語轟炸，絕不整段輸出世界觀。
- 你敢直說。溫柔不等於順著說，看到對方在同一個地方繞第三圈，可以輕輕點破：「妳發現嗎，這跟妳上次說的是同一齣戲。」但直話永遠帶著暖意，不帶優越感。
- 永遠不用「那是幻、所以不重要」打發人的痛。幻不是「不痛」的意思，是「痛不必定義你」的意思。
- 有幽默感。可以笑，可以自嘲，不必時時深刻。
- 可以在自然的時機引一句經文（心經、道德經、壇經）或生活化的比喻，一次最多一句，不強加。
- 對方若只是閒聊，就好好閒聊。日常本身就是道場，不必把每句話都導向心靈成長。

【界線】
- 你不算命、不預測未來、不斷言對方的命盤。若對方想排盤，可以自然提到網站上有免費排盤，但不推銷。
- 你不做醫療或心理診斷，不開藥方。涉及身心科、藥物問題，溫柔建議尋求專業。
- 不談論與陪伴無關的危險內容（武器、駭客、犯罪方法等），溫和拒絕並拉回對方身上。

【危機時】
若對方透露想傷害自己或結束生命，或處於立即危險：
- 不驚慌、不說教、不留他一個人。先表達你在，且他願意說出來很重要。
- 溫柔而明確地提供台灣的求助資源：安心專線 1925（24小時）、生命線 1995、張老師 1980；若有立即危險請打 119 或 110。
- 鼓勵他聯繫身邊信任的人，並詢問現在身邊有沒有人可以陪著。`;

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const okOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const headers = { ...corsHeaders(okOrigin), "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(okOrigin) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers });
  }

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "bad request" }), { status: 400, headers });
    }

    // ── 用量限制：訪客一段對話最多 10 句，超過請先加入會員 ──
    const GUEST_LIMIT = 10;
    const userCount = messages.filter((m: { role: string }) => m.role !== "assistant").length;
    if (userCount > GUEST_LIMIT) {
      let isMember = false;
      const auth = req.headers.get("authorization") ?? "";
      const token = auth.replace(/^Bearer\s+/i, "");
      const sbUrl = Deno.env.get("SUPABASE_URL");
      const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      // 帶的是會員 access token（不是公開金鑰）才向 Supabase 驗證
      if (sbUrl && token && token !== anon && !token.startsWith("sb_publishable_")) {
        try {
          const v = await fetch(`${sbUrl}/auth/v1/user`, {
            headers: { apikey: anon, Authorization: `Bearer ${token}` },
          });
          isMember = v.ok;
        } catch (_) { /* 驗證失敗視同訪客 */ }
      }
      if (!isMember) {
        return new Response(JSON.stringify({ error: "limit_guest" }), { status: 403, headers });
      }
    }

    // 基本護欄：只留最近 16 則，每則截 2000 字
    const trimmed = messages.slice(-16).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 2000),
    }));

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "server not configured" }), { status: 500, headers });
    }

    const model = Deno.env.get("FUSHENG_MODEL") ?? "claude-sonnet-4-5";

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: trimmed,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("anthropic error", r.status, detail);
      return new Response(JSON.stringify({ error: "upstream error" }), { status: 502, headers });
    }

    const data = await r.json();
    const reply = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();

    return new Response(JSON.stringify({ reply }), { headers });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "server error" }), { status: 500, headers });
  }
});
