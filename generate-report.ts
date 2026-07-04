// 浮生矩陣 — AI 生成報告 Edge Function（v3：接力式分段生成，避開執行時間上限）
//
// 呼叫方式：
//   A. 訂單自動生成（notify / create-order 免費通道觸發）：
//      header x-internal-key = service role key，body { order_id, version, part? }
//      → 每次只寫一段（約1~2分鐘）→ 存進 reports 草稿 → 自動觸發下一段 → 最後一段發布＋解鎖
//   B. 管理後台手動生成（admin.html，需管理員登入）：
//      body { summary, name, version, evidence, intensity, relation? }
//      → 單次精簡生成（約3000字草稿），回傳 { excerpt, full } 給後台編輯框
//
// ⚠️ 此函式須關閉「Verify JWT」。Secrets：ANTHROPIC_API_KEY

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
   語氣與規則
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
    "②「父母線索」：用摘要裡的印星/財星/父母宮，寫一段他與父母的關係與性格議題。只談關係與議題，嚴禁編造姓氏、名字、具體事件。\n" +
    "③「日常線索」：從五行偏枯、月亮星座、人類圖類型推 2~3 個他大概率有的生活慣性。\n" +
    "這些段落的目的是讓他覺得「你怎麼會知道」。\n" +
    "\n【誠實邊界】只根據提供的命盤摘要推論，不杜撰未提供的數據；不算生死、不斷病症、不給醫療/投資/法律指示；" +
    "命盤講的是「傾向與結構」，語氣要讓人感到方向感，而不是宿命論。\n" +
    "\n【最重要的任務｜痛點】整份報告圍繞一件事：找出這個人『最痛、最反覆卡住、最不願意承認』的那一個核心痛點，" +
    "開場就直接講出來、講到他心頭一震，之後每一章都從不同角度回到這個痛點，不要平均分配、不要面面俱到。\n" +
    "大量用第二人稱「你」。多用『你以為…其實…』點破他以為是個性、其實是防衛機制的地方。\n\n" + tone
  );
}

const relationMap: Record<string, string> = {
  "曖昧探索": "【關係階段：曖昧探索】兩人還沒在一起或剛開始靠近。重點寫：這段吸引力的本質是什麼、繼續靠近會發生什麼、什麼訊號值得注意。語氣輕盈但誠實，不勸進也不勸退，幫他們看清楚。",
  "熱戀磨合": "【關係階段：熱戀磨合】在一起了，第一批摩擦正在出現。重點寫：為什麼當初最吸引彼此的地方，現在開始變成摩擦點——這是結構，不是誰變了。給具體的磨合方法。",
  "穩定婚姻": "【關係階段：穩定・婚姻】長期關係。重點寫：日復一日的相處裡，能量怎麼互相滋養、又怎麼慢性消耗；那些「懶得再說」的地方藏著什麼。給長期經營的具體做法。",
  "修復期": "【關係階段：修復期】關係出過狀況，正在修。語氣要多接住、少指責。重點寫：反覆發生的那個迴圈的結構原因、兩人各自要認領的部分、修復的實際路徑。不寫「該不該繼續」的判決，寫「如果要修，修什麼」。",
};

function buildCoupleSystem(relation: string, intensity: string): string {
  const tone = toneMap[intensity] || toneMap["犀利"];
  const rel = relationMap[relation] || "";
  return (
    "你是「浮生矩陣」的合盤解讀作者，融合八字、紫微斗數、西洋占星、人類圖四套系統，" +
    "並借鏡榮格（陰影/投射）、依附理論等視角，專門解讀兩個人之間的關係結構。\n" +
    "\n【讀者設定】讀的人是這段關係中的一方或雙方，完全不懂命理。他們只在乎「你講的是不是我們」。\n" +
    "\n【白話鐵律——最高優先】\n" +
    "①整篇用日常口語寫，像很懂命理但講話很白的朋友。短句、可以反問。\n" +
    "②術語第一次出現必須立刻白話翻譯（例：『他的日主是庚金——講白了，他的出廠設定是一把刀：講效率、講原則，鈍了就煩躁。』）\n" +
    "③術語只當證據出處輕輕帶過，人話才是主體。\n" +
    "\n【稱呼鐵律】用兩人的名字（從命盤資料的【甲】【乙】段落取得）稱呼，不要叫「甲方乙方」。對讀者整體說話時用「你們」。\n" +
    "\n【準確感策略】\n" +
    "①每一章至少 3 句可打勾的「你們的日常情境」：『你們是不是常常——一個想講清楚、一個想先冷靜』這類具體場景（吵架後、旅行規劃、見父母、講到錢…）。\n" +
    "②每個論斷扣回具體命盤特徵，括號輕巧標註（依據：A的月亮天蠍 ✕ B的月亮射手——一個往深處收、一個往外面跑）。\n" +
    "③嚴禁巴納姆套話與兩面討好；寧可講窄講深。互補與衝突都要指名道姓講清楚是「誰的什麼」對上「誰的什麼」。\n" +
    "\n【必含佐證】①兩人各自的「關卡年」若在摘要中提供，挑出彼此重疊或相近的年份寫成可打勾句。" +
    "②從兩人五行/月亮/類型推 2~3 個「你們相處的日常慣性」可打勾句。③若提供了「共同經歷的真實事件」，明確點名它並對應回兩張命盤的結構。\n" +
    "\n【誠實邊界】只根據提供的命盤摘要推論；不判生死離合、不下「該分該留」的判決——把結構講透，選擇留給他們；不給法律/醫療指示。\n" +
    "\n【最重要的任務】整份報告圍繞一件事：找出這段關係『最核心的一組張力』（最吸引彼此的地方與最消耗彼此的地方通常是同一組結構），" +
    "開場就講出來、講到兩人對看一眼，之後每一章從不同角度回到這組張力。\n" +
    (rel ? "\n" + rel + "\n" : "") + "\n" + tone
  );
}

/* ============================================================
   章節規劃（每版三段接力，總計約萬字）
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
      "九、最終總結——一份濃縮的人生說明書：他是誰、他怎麼運作、他適合怎麼前進。收在溫暖而有力的一段話。" +
      "最後自然接一小段（像朋友的邀請，絕不能像廣告）：這份報告帶你「看見」了結構，但看見之後怎麼用在眼前真實的抉擇上，是另一段路——" +
      "如果你想把這份看見用回自己現在卡住的地方，歡迎私訊 Instagram 或 Facebook「@floating_matrix 浮生矩陣」，預約一對一的「浮生導航」",
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
      "八、最終總結——真正困住他的核心模式一句話講清，下一步該校正什麼給出明確方向。狠在點上、暖在底層，最後把人接住。" +
      "收尾自然接一小段（像朋友的邀請，絕不能像廣告）：破局不是讀完就完成的，是在一次次真實選擇裡練出來的——" +
      "如果你想有人陪你把這些矛盾拆進現在的處境裡，歡迎私訊 Instagram 或 Facebook「@floating_matrix 浮生矩陣」，預約一對一的「浮生導航」",
    ],
    splits: [[0, 2], [3, 5], [6, 7]],
  },
  sync: {
    label: "合盤・同頻版",
    goal:
      "把兩張命盤放在一起，講清楚：你們是怎麼吸引彼此的、這段關係運轉得最好的樣子長什麼樣。" +
      "開場第一段就給這段關係最準的一句總綱（那組核心張力的「禮物面」）。",
    chapters: [
      "一、兩張命盤的第一眼——兩人各自是什麼結構的人（各一段白話畫像，用名字），然後點出這段關係的核心引力",
      "二、吸引力的來源——你們當初為什麼會被彼此吸住：哪些是互補（他有你沒有的）、哪些是同頻（一拍即合的），逐項扣回兩張命盤",
      "三、相處的預設模式——誰發起誰回應、誰講道理誰講感覺、誰快誰慢；你們能量的自然流向，順著走最省力",
      "四、三大關係場域——溝通／親密與情感表達／金錢與未來規劃：同一組結構在三個現場的樣子",
      "五、你們最好的樣子——這段關係運轉最順的時刻長什麼樣、通常發生在什麼條件下、怎麼有意識地多創造這種時刻",
      "六、相處說明書——為你們量身的 3~4 條具體守則（具體到「下次遇到＿＿就＿＿」），每條說明為什麼剛好剋你們的結構",
      "七、最終總結——這段關係的核心禮物一句話講清，收在溫暖有力的一段話。" +
      "最後自然接一小段（像朋友的邀請，絕不能像廣告）：合盤讓你們看見了彼此的結構，但兩個人要一起走，還有很多「當下的選擇」——" +
      "如果想把這份看見用回你們正在面對的事，歡迎私訊 Instagram 或 Facebook「@floating_matrix 浮生矩陣」，預約兩人一起的「浮生導航」",
    ],
    splits: [[0, 2], [3, 4], [5, 6]],
  },
  clash: {
    label: "合盤・碰撞版",
    goal:
      "專挑兩張命盤互相打架的地方：你們反覆吵的那件事、互相消耗的迴圈、彼此的地雷與盲區。" +
      "開場直接說中你們最常見的那一種僵局，講到兩人心裡一震。",
    chapters: [
      "一、兩套劇本的對撞點——你們最典型的那一種吵法／僵法（冷戰？追逃？講不到一個頻道上？），開場直接重演一次那個場景",
      "二、矛盾羅盤——把兩人的差異攤開分類：哪些其實是互補（被誤會成問題的資產）、哪些是真正的結構衝突（要一輩子磨的），各自扣回命盤",
      "三、衝突迴圈解剖——從觸發點→各自的情緒反應→各自說出口的話→各自的行動→各自心裡留下的結論，一層層拆你們的慣性迴圈，指名誰在哪一層扮演什麼",
      "四、彼此的地雷與盲區——A最受不了B的其實是＿＿（而那與其說是B的問題，不如說踩到A的什麼結構）；反過來也寫B的。用名字，寫到臉熱",
      "五、用錯力的場合——你們最常在哪些場景互相消耗（翻舊帳、比較誰付出多、講到未來就卡住…），每個場景給可打勾的細節",
      "六、拆彈手冊——3~4 條實際可用的破局做法，具體到「下次吵起來的第一分鐘可以怎麼做」，並說明哪一條是誰的功課",
      "七、最終總結——你們真正要一起練的那一門功課一句話講清；狠在點上、暖在底層，最後把兩人都接住。" +
      "收尾自然接一小段（像朋友的邀請，絕不能像廣告）：迴圈不是讀完就會停的，是在一次次真實衝突裡練出來的——" +
      "如果想有人陪你們把這些矛盾拆進現在的處境，歡迎私訊 Instagram 或 Facebook「@floating_matrix 浮生矩陣」，預約兩人一起的「浮生導航」",
    ],
    splits: [[0, 2], [3, 4], [5, 6]],
  },
};

/* ============================================================
   生成核心
============================================================ */
async function callClaude(apiKey: string, system: string, prompt: string, maxTokens = 7000): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || "AI 服務回應錯誤");
  const text = (data?.content?.[0]?.text ?? "").trim();
  return text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
}

function evidenceBlock(evidence: string, isCouple = false): string {
  const ev = (evidence || "").trim();
  if (!ev) return "";
  const who = isCouple ? "他們自己說的、共同經歷過的事" : "這個人自己說的、真實發生過的事";
  return (
    `\n\n【${who}（鐵證）】\n${ev}\n` +
    `→ 把這件事當成最有力的佐證：在報告中至少一次明確點名它，說清楚它如何精準對應命盤結構，` +
    `讓${isCouple ? "他們" : "他"}讀到時起雞皮疙瘩。但只用這一件事，不要再杜撰其他事件。\n`
  );
}

type GenArgs = { summary: string; version: string; evidence?: string; intensity?: string; relation?: string };
function planOf(version: string) {
  const vkey = ["script", "breakthrough", "sync", "clash"].includes(version) ? version : "script";
  const isCouple = vkey === "sync" || vkey === "clash";
  return { plan: PLANS[vkey], isCouple };
}
function systemOf(args: GenArgs, isCouple: boolean) {
  return isCouple
    ? buildCoupleSystem(args.relation || "", args.intensity || "犀利")
    : buildSystem(args.intensity || "犀利");
}
const chapterList = (plan: Plan, s: [number, number]) =>
  plan.chapters.slice(s[0], s[1] + 1).map((c) => "・" + c).join("\n");

// 生成單一段（part 0/1/2）。part 0 同時產出千字精華。
async function generatePart(apiKey: string, args: GenArgs, part: number, prevText: string): Promise<{ excerpt: string; text: string }> {
  const { plan, isCouple } = planOf(args.version);
  const system = systemOf(args, isCouple);
  const evb = evidenceBlock(args.evidence || "", isCouple);
  const isLast = part === plan.splits.length - 1;
  let prompt = `【此人命盤資料】\n${args.summary}${evb}\n\n`;

  if (part === 0) {
    prompt +=
      `【任務】撰寫「${plan.label}」報告（完整版約一萬字，分三次寫，這是第一次）。\n${plan.goal}\n\n` +
      `這一次只寫以下章節（每章約 1000~1300 字，用 markdown 小標題）：\n${chapterList(plan, plan.splits[0])}\n\n` +
      `請嚴格依下列格式輸出（不要 JSON、不要程式碼圍欄、不要多餘說明）：\n\n` +
      `===千字精華===\n（約 500~700 字：開場一句最準的總綱＋四套系統各一小段＋一段綜合。` +
      `要白話、要有打勾句，結尾留鉤子讓人想看完整版，但不要寫「請購買」之類的話）\n\n` +
      `===報告開始===\n（接著寫上面指定的章節）`;
  } else {
    const tail = prevText.length > 3000 ? prevText.slice(-3000) : prevText;
    prompt +=
      `【任務】你正在撰寫「${plan.label}」報告（約一萬字，分三次寫，這是第 ${part + 1} 次）。\n` +
      `以下是前文的結尾（供銜接語氣與避免重複，不要重寫這些內容）：\n…${tail}\n\n` +
      `請無縫接著寫以下章節（每章約 1000~1300 字，markdown 小標題，開頭不要再放總標題或開場白）：\n${chapterList(plan, plan.splits[part])}\n` +
      (isLast
        ? `\n**這是最後一段：務必把「最終總結」完整寫完、好好收尾，絕對不能截斷。**`
        : `\n寫完指定章節就停，不要提前寫後面的章節。`);
  }

  const text = await callClaude(apiKey, system, prompt);
  let excerpt = "";
  let body = text;
  if (part === 0) {
    const TAG_E = "===千字精華===";
    const TAG_F = "===報告開始===";
    const iF = text.indexOf(TAG_F);
    if (iF >= 0) {
      const iE = text.indexOf(TAG_E);
      excerpt = text.slice(iE >= 0 ? iE + TAG_E.length : 0, iF).trim();
      body = text.slice(iF + TAG_F.length).trim();
    } else {
      body = text.replace(TAG_E, "").trim();
    }
  }
  return { excerpt, text: body };
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

  /* ---------- 模式 A：訂單接力生成（內部觸發） ---------- */
  if (body.order_id) {
    if (req.headers.get("x-internal-key") !== SERVICE_KEY) return json({ error: "未授權" }, 401);
    const version = ["script", "breakthrough", "sync", "clash"].includes(String(body.version))
      ? String(body.version) : "script";
    const part = Math.max(0, Math.min(2, Number(body.part) || 0));

    const { data: order } = await admin.from("orders").select("*").eq("id", body.order_id).maybeSingle();
    if (!order) return json({ error: "找不到訂單" }, 404);
    if (!order.case_id) return json({ error: "訂單尚未建立個案" }, 400);
    const { plan } = planOf(version);
    const isLast = part === plan.splits.length - 1;

    try {
      // 讀取現有草稿（part>0 需要前文）
      const { data: existing } = await admin.from("reports").select("id,excerpt,full_content")
        .eq("case_id", order.case_id).eq("version", version).maybeSingle();
      const prevText = (part > 0 && existing?.full_content) ? existing.full_content : "";

      const args: GenArgs = {
        summary: order.summary, version,
        evidence: order.evidence || "",
        intensity: order.intensity || "犀利",
        relation: (order.birth && order.birth.relation) || "",
      };
      const { excerpt, text } = await generatePart(apiKey, args, part, prevText);

      const newFull = part === 0 ? text : (prevText + "\n\n" + text);
      const payload: Record<string, unknown> = {
        case_id: order.case_id, version,
        full_content: newFull,
        published: isLast, full_unlocked: isLast,
      };
      if (part === 0) payload.excerpt = excerpt;
      if (existing) await admin.from("reports").update(payload).eq("id", existing.id);
      else await admin.from("reports").insert(payload);

      const relay = async (nextVersion: string, nextPart: number) => {
        const p = fetch(`${SUPABASE_URL}/functions/v1/generate-report`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-internal-key": SERVICE_KEY },
          body: JSON.stringify({ order_id: order.id, version: nextVersion, part: nextPart }),
        }).catch((e) => console.error("接力觸發失敗", nextVersion, nextPart, e));
        // deno-lint-ignore no-explicit-any
        (globalThis as any).EdgeRuntime?.waitUntil?.(p);
        // 留一小段時間確保請求已送出，避免函式結束時請求被凍結
        await new Promise((r) => setTimeout(r, 1500));
      };

      if (!isLast) {
        // 接力：觸發同版本下一段
        await relay(version, part + 1);
        return json({ ok: true, version, part, next: part + 1 });
      }

      // 最後一段：檢查兩版是否都完成；若第二版還沒開始 → 接力觸發第二版
      const need = order.product === "couple" ? ["sync", "clash"] : ["script", "breakthrough"];
      const { data: reps } = await admin.from("reports").select("version").eq("case_id", order.case_id).eq("published", true);
      const vs = new Set((reps || []).map((r: { version: string }) => r.version));
      if (need.every((v) => vs.has(v))) {
        await admin.from("orders").update({ status: "done" }).eq("id", order.id);
        return json({ ok: true, version, part, done: true });
      }
      const other = need.find((v) => v !== version);
      if (other) {
        const { data: otherRep } = await admin.from("reports").select("id").eq("case_id", order.case_id).eq("version", other).maybeSingle();
        if (!otherRep) await relay(other, 0);
      }
      return json({ ok: true, version, part, done: true });
    } catch (e) {
      await admin.from("orders").update({ status: "failed", error: `${version} 第${part + 1}段生成失敗：${String(e)}` }).eq("id", order.id);
      return json({ error: String(e) }, 500);
    }
  }

  /* ---------- 模式 B：管理後台手動生成（單次精簡版） ---------- */
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "請先登入" }, 401);
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user) return json({ error: "登入已過期" }, 401);
  const { data: prof } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (!prof || prof.role !== "admin") return json({ error: "僅限管理員使用" }, 403);

  const { summary, name, version, evidence, intensity, relation } = body as Record<string, string>;
  if (!summary) return json({ error: "缺少命盤摘要 summary" }, 400);
  try {
    const { plan, isCouple } = planOf(version || "script");
    const system = systemOf({ summary, version: version || "script", intensity, relation }, isCouple);
    const evb = evidenceBlock(evidence || "", isCouple);
    const prompt =
      `【此人命盤資料】\n${summary}${evb}\n\n【任務】撰寫「${plan.label}」報告（後台精簡版）。\n${plan.goal}\n\n` +
      `章節（每章精煉 300~450 字，markdown 小標題，總計約 3000 字）：\n${plan.chapters.map((c) => "・" + c).join("\n")}\n\n` +
      `請嚴格依下列格式輸出（不要 JSON、不要圍欄）：\n\n===千字精華===\n（約 500~700 字）\n\n===完整報告===\n` +
      `（依上述章節，**務必把最後一章完整寫完才結束**）`;
    const text = await callClaude(apiKey, system, prompt, 6500);
    const TAG_E = "===千字精華===", TAG_F = "===完整報告===";
    let excerpt = "", full = text;
    const iF = text.indexOf(TAG_F);
    if (iF >= 0) {
      const iE = text.indexOf(TAG_E);
      excerpt = text.slice(iE >= 0 ? iE + TAG_E.length : 0, iF).trim();
      full = text.slice(iF + TAG_F.length).trim();
    }
    return json({ excerpt, full, name, version });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
