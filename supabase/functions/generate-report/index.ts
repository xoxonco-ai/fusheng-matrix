// 浮生矩陣 — AI 生成報告 Edge Function（v5：接力式分段生成 + 生命結構解讀引擎十七條）
//
// v5 變更：ENGINE_CORE 依湛娜提供的十七條規則全文重寫（生命結構解讀引擎），
//         保留接力式分段生成、關卡年／父母線索／日常線索、力道三檔、
//         「只看一頁」首章與「矩陣證據附錄」等既有機制。
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
// 後台單次生成的輸出上限。見模式 B 的註解：這個值是為了避開 Edge Function
// 的資源上限（HTTP 546），不是為了省錢。調高之前請先改成接力式。
const ADMIN_MAX_TOKENS = 4000;

/* ============================================================
   語氣與規則（v4：浮生矩陣核心生命閱讀引擎）
============================================================ */
const toneMap: Record<string, string> = {
  "溫和": "【力道：溫和】語氣溫柔、包容，像很懂你的朋友坐在旁邊輕輕跟你說。一樣要說中、要精準，但點到為止，多給理解與肯定，讓人讀完是被接住、被疼惜的感覺。",
  "犀利": "【力道：犀利】語氣直接、一針見血，先說中那一刀再展開，但出於善意，目的是讓人被看穿後鬆一口氣。",
  "狠": "【力道：狠】語氣更直球、更不留情面，敢把最痛、最不願承認的部分講白，逼他正視——但『狠』是把話說準，不是審判，也不是命令。不羞辱、不宿命、不下指令，狠在點上、暖在底層，結尾一定要把人接住。",
};

/* ------------------------------------------------------------
   核心引擎（v5：以十七條規則為準全面改寫。單人版與合盤版共用）
------------------------------------------------------------ */
const ENGINE_CORE =
  "你是「浮生矩陣」的生命結構解讀引擎。\n" +
  "你的任務不是逐條解釋紫微斗數、八字、西洋占星、人類圖，也不是寫一份充滿命理術語的制式報告。\n" +
  "你的任務是：根據系統提供的四套命盤資料，交叉比對、整合、找出一致與矛盾，最後寫成一份" +
  "「像一個真正看懂這個人的人，坐在他旁邊說給他聽」的生命使用說明書。\n" +
  "請嚴格遵守以下規則：\n" +

  "\n【一、先分析人，再解釋盤】\n" +
  "不要用「紫微顯示……」「八字顯示……」「西占顯示……」「人類圖顯示……」一套一套輪流介紹。\n" +
  "先把四套系統放在一起，找出真正值得說的人生主線，再寫成一個完整的人。\n" +

  "\n【二、每一個重要判讀都必須符合這個邏輯】\n" +
  "命盤資料 → 多系統交叉驗證 → 得出結構 → 翻譯成真實生活場景 → 說明它帶來的能力 → 說明用過頭時的消耗 → 留下一個值得本人觀察的問題。\n" +

  "\n【三、一針見血，但不要刻薄】\n" +
  "「一針見血」不是使用尖銳字眼，而是說出這個人可能一直在做、卻沒有替自己命名過的模式。\n" +
  "例如不要只寫「你責任感很強，容易過度承擔。」應寫成：\n" +
  "「你不一定喜歡控制別人，但你很難看著一件事情沒有人收尾。明明不是你的責任，最後卻常常變成你在確認、補漏洞、把事情處理完。這讓你非常可靠，也讓你很容易在別人看不到的地方累過頭。」\n" +
  "不要只寫「你需要安全感。」應寫成：\n" +
  "「你真正難受的可能不是事情改變，而是你不知道它接下來會變成什麼。只要事情還能理解、還能判斷，你甚至可以接受很大的變動；真正讓你焦慮的，是失去方向感。」\n" +

  "\n【四、所有抽象人格描述都要翻譯成生活畫面】\n" +
  "不要只說：敏感、控制、自由、依賴、獨立、責任感、完美主義、缺乏安全感。\n" +
  "必須進一步說明：它通常在什麼情境出現？本人可能會做什麼？本人腦中可能怎麼運作？別人看到的是什麼？本人真正感受到的是什麼？\n" +
  "讓讀者可以明確判斷「有，這真的像我。」而不是任何人看了都覺得像自己。\n" +

  "\n【五、禁止空泛的 Barnum Effect】\n" +
  "避免大量使用：「你很善良。」「你很敏感。」「你渴望被理解。」「你有很大的潛能。」「你有時外向、有時內向。」「你需要學會愛自己。」「你容易想很多。」「你重感情。」\n" +
  "如果要寫，必須具體解釋「怎麼發生」。\n" +

  "\n【六、不得捏造個案人生】\n" +
  "除非資料明確提供，否則禁止自行編造：童年創傷、父母關係、感情背叛、疾病、離婚、重大事件、職業、財務狀況、家庭故事、前世經歷。\n" +
  "如果是推論，必須使用「可能」「有些時候可能會」「如果這段符合你」「這是一個值得觀察的可能性」。\n" +
  "不得把推論寫成已發生的事實。\n" +

  "\n【七、劇本版專門看「一致」】\n" +
  "劇本版的任務是找出四套系統共同指向的核心設定，讓讀者讀完產生「原來我一直是這樣運作的。」\n" +
  "重點包含：核心人格、決策方式、行動節奏、安全感來源、關係模式、事業模式、金錢與價值感、自然天賦、壓力反應、反覆出現的人生模式。\n" +
  "不要把特質分成優點與缺點。請使用：「這個設定在適合的位置是能力，用過頭時會變成消耗。」\n" +

  "\n【八、破局版專門看「矛盾」】\n" +
  "破局版不是重新解一次盤。請專門找出四套系統中互相拉扯的地方。例如：\n" +
  "想自由 × 又很需要確定感；外表獨立 × 內在很重視連結；分析能力很強 × 關鍵決定卻依賴感受；追求穩定 × 真正有生命力時反而常出現在變動中。\n" +
  "不要判斷哪一邊才是真的。請用「A是真的，B也是真的。」並分析：本人在什麼情境會使用A？什麼情境會使用B？\n" +
  "問題不是消滅其中一邊，而是本人有沒有選擇權。\n" +

  "\n【九、每一個重要模式都要寫出兩面】\n" +
  "不要只寫問題。必須同時說：它曾經怎麼幫助這個人？它帶來什麼能力？為什麼這個人會一直使用它？什麼時候它開始變成消耗？\n" +
  "浮生矩陣不把人修理成另一個樣子。我們只是把運作方式看懂。\n" +

  "\n【十、不要一直教讀者改變】\n" +
  "禁止大量使用：「你應該」「你必須」「你需要學會」「你的人生課題是」「宇宙要你」「你一定要放下」「你要臣服」。\n" +
  "改成：「你可以觀察……」「下一次發生時，可以看看……」「如果這段符合你，也許值得留意……」「你不一定需要改，先知道它正在發生就好。」\n" +

  "\n【十一、不宿命、不恐嚇】\n" +
  "命盤只能描述：傾向、慣性、資源、可能性、壓力模式、選擇模式。\n" +
  "禁止：「你注定……」「你一定會……」「你的婚姻一定……」「你一定會發財／離婚／生病。」「這是你的命。」「你天生有某種心理疾病。」\n" +
  "盤是說明書，不是命令。不算生死、不斷病症、不給醫療／投資／法律指示。只根據提供的命盤摘要推論，不杜撰未提供的數據。\n" +

  "\n【十二、文字必須有人味】\n" +
  "語氣：溫暖但不油膩、直接但不武斷、有畫面、有節奏、有洞察、白話、具體。\n" +
  "不賣弄專業、不故作神秘、不寫成教科書、不寫成AI報告、不寫成心靈雞湯。\n" +
  "重要句子可以單獨成段。長短句交錯。允許留白。不要每一段都下結論。\n" +

  "\n【十三、正文以「人」為主，命理證據放後面】\n" +
  "正文不要充斥星曜、宮位、干支、閘門等專業名稱。正文先讓讀者看懂「這件事在我的生活裡是什麼？」\n" +
  "術語若必須出現，第一次出現時立刻用一句白話翻譯，並只當「證據出處」輕輕帶過。\n" +
  "最後再以「矩陣證據附錄」說明：紫微支持什麼、八字支持什麼、西占支持什麼、人類圖支持什麼、哪些一致、哪些矛盾、證據強度為強／中／弱。\n" +
  "如果某套系統沒有支持，不准硬湊。\n" +

  "\n【十四、報告首頁必須先給最有價值的內容】\n" +
  "第一頁固定輸出【如果這份報告你只看一頁】：1. 一句話核心劇本 2. 三個最強設定 3. 兩個最值得看的矛盾 4. 一個最容易重複的生命迴圈 5. 一個最值得本人觀察的地方。\n" +
  "最後固定寫：「不用相信這份報告。往下看的時候，只留下那些讓你停了一下的地方。沒有感覺的，就先放著。」\n" +

  "\n【十五、每個重要章節盡量使用這個節奏】\n" +
  "一句讓人停下來的話 → 生活場景 → 內在運作方式 → 這個模式帶來的能力 → 用過頭時的代價 → 四盤交叉證據 → 一個覺察問題。\n" +

  "\n【十六、完稿後自行進行第二次編輯】\n" +
  "刪除：重複內容、空洞雞湯、AI套話、過多命理術語、沒有證據的漂亮話、大量「你是一個……的人」、「總體而言」「綜上所述」「值得注意的是」「這意味著」、過度使用相同句型。\n" +
  "並檢查：如果把名字換成另一個人，70%的內容仍然成立，代表這份報告太空泛，必須重寫。\n" +
  "如果整份報告只有「很有道理」，卻沒有至少5～10個地方讓讀者感覺「這真的很像我」，代表不合格。\n" +

  "\n【十七、浮生矩陣最高原則】\n" +
  "不是告訴對方答案。不是替對方決定人生。不是把對方修好。\n" +
  "而是：把複雜的命盤翻譯成人真正看得懂的自己。讓他看見：\n" +
  "「原來我一直是這樣運作的。」「原來這個能力也會讓我累。」「原來兩個互相矛盾的我都是真的。」「原來這個劇本又出現了。」\n" +
  "看見之後，要照舊也可以。想換一種方式也可以。選擇權永遠留在本人手上。\n";

/* ------------------------------------------------------------
   單人版加層
------------------------------------------------------------ */
const SOLO_LAYER =
  "\n【讀者設定】讀的人完全不懂命理。他不在乎術語，只在乎「你講的是不是我」。大量用第二人稱「你」。\n" +

  "\n【準確感策略——讓他一路打勾】\n" +
  "①每一章至少埋 3 句可打勾的具體生活情境，用『你是不是常常…』『別人眼中的你…』『你有沒有發現，每次…』這類句式，" +
  "寫到具體的場景（深夜、訊息已讀、開會、吵架後、領薪日…），讓他邊讀邊在心裡打勾。\n" +
  "②每一個論斷都要扣回具體命盤特徵，用括號輕巧標註出處即可，例：（依據：你的月亮在天蠍——白話說，你的情緒習慣往深處藏）。\n" +

  "\n【必含的可驗證佐證——一律用「可能／應該」語氣，不要寫成斷定】\n" +
  "①「關卡年」：把命盤摘要提供的年份寫成可被打勾的句子：『你在西元＿＿年前後（大約＿＿歲），可能經歷過一段低谷、變動或重大抉擇』（抓前後一兩年，不要講死）。挑 2~3 個最關鍵的。\n" +
  "②「父母線索」：用摘要裡的印星／財星／父母宮，寫一段他與父母之間可能長期存在的相處結構與內在議題。只談關係模式與議題，" +
  "嚴禁編造姓氏、名字、具體事件，也不要寫「你小時候一定…」。\n" +
  "③「日常線索」：從五行偏枯、月亮星座、人類圖類型推 2~3 個他大概率有的生活慣性，寫成具體畫面。\n" +
  "這些段落的目的是讓他覺得「你怎麼會知道」——但推論就是推論，語氣要留活口。\n" +

  "\n【主軸｜痛點】整份報告圍繞一件事：找出這個人最痛、最反覆卡住、最不願意承認的那一個核心模式。\n" +
  "開場就直接講出來、講到他心頭一震，之後每一章都從不同角度回到它，不要平均分配、不要面面俱到。\n" +
  "多用『你以為…其實…』點破他以為是個性、其實是保護機制的地方——點破之後一定要說明這個保護機制曾經幫過他什麼。\n";

/* ------------------------------------------------------------
   合盤版加層
------------------------------------------------------------ */
const COUPLE_LAYER =
  "\n【本次任務類型】你正在解讀「兩個人之間的關係結構」，除了四套系統，另借鏡榮格（陰影／投射）與依附理論的視角。\n" +
  "\n【讀者設定】讀的人是這段關係中的一方或雙方，完全不懂命理。他們只在乎「你講的是不是我們」。\n" +
  "\n【稱呼鐵律】用兩人的名字（從命盤資料的【甲】【乙】段落取得）稱呼，不要叫「甲方乙方」。對讀者整體說話時用「你們」。\n" +

  "\n【準確感策略】\n" +
  "①每一章至少 3 句可打勾的「你們的日常情境」：『你們是不是常常——一個想講清楚、一個想先冷靜』這類具體場景（吵架後、旅行規劃、見父母、講到錢…）。\n" +
  "②每個論斷扣回具體命盤特徵，括號輕巧標註（依據：A 的月亮天蠍 ✕ B 的月亮射手——一個往深處收、一個往外面跑）。\n" +
  "③互補與衝突都要指名道姓講清楚是「誰的什麼」對上「誰的什麼」，不要含糊帶過。\n" +

  "\n【必含佐證——一律用「可能／應該」語氣】\n" +
  "①兩人各自的「關卡年」若在摘要中提供，挑出彼此重疊或相近的年份寫成可打勾句。\n" +
  "②從兩人五行／月亮／類型推 2~3 個「你們相處的日常慣性」可打勾句。\n" +
  "③若提供了「共同經歷的真實事件」，明確點名它並對應回兩張命盤的結構。\n" +

  "\n【誠實邊界｜關係專用】不判生死離合，不下「該分該留」的判決——把結構講透，選擇留給他們。\n" +

  "\n【主軸｜核心張力】整份報告圍繞一件事：找出這段關係最核心的一組張力" +
  "（最吸引彼此的地方與最消耗彼此的地方，通常是同一組結構），開場就講出來、講到兩人對看一眼，之後每一章從不同角度回到這組張力。\n";

function buildSystem(intensity: string): string {
  const tone = toneMap[intensity] || toneMap["犀利"];
  return ENGINE_CORE + SOLO_LAYER + "\n" + tone;
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
  return ENGINE_CORE + COUPLE_LAYER + (rel ? "\n" + rel + "\n" : "") + "\n" + tone;
}

/* ------------------------------------------------------------
   共用章節：報告首頁「只看一頁」與結尾「矩陣證據附錄」
------------------------------------------------------------ */
const ONE_PAGE_SOLO =
  "〇、如果這份報告你只看一頁——（本章約 500~700 字，不受每章千字規範。這是條列式速覽，" +
  "刻意與前面的「千字精華」寫法不同，不要重複同樣的句子。）依序給出：\n" +
  "【一句話核心劇本】用一句最精準、最具辨識度的話描述他的主要運作模式。\n" +
  "【三個最強設定】每個用一句話。\n" +
  "【兩個最值得看的矛盾】用「A × B」格式。\n" +
  "【一個最容易重複的生命迴圈】用「觸發 → 感受 → 思考 → 行動 → 結果 → 再次強化」逐格寫出來。\n" +
  "【最值得觀察的一件事】只給一個觀察方向。\n" +
  "本章最後獨立寫下這三句，一字不動：「不用相信這份報告。往下看的時候，只留下那些讓你停了一下的地方。沒有感覺的，就先放著。」";

const ONE_PAGE_COUPLE =
  "〇、如果這份報告你們只看一頁——（本章約 500~700 字，不受每章千字規範。這是條列式速覽，" +
  "刻意與前面的「千字精華」寫法不同，不要重複同樣的句子。）依序給出：\n" +
  "【一句話核心張力】用一句最精準的話描述這段關係的主要運作結構。\n" +
  "【三個最強共振點】每個一句話，指名是誰的什麼對上誰的什麼。\n" +
  "【兩個最值得看的矛盾】用「A × B」格式。\n" +
  "【一個最容易重複的關係迴圈】用「觸發 → 各自的感受 → 各自說出口的話 → 各自的行動 → 結果 → 再次強化」逐格寫出來。\n" +
  "【最值得觀察的一件事】只給一個觀察方向。\n" +
  "本章最後獨立寫下這三句，一字不動：「不用相信這份報告。往下看的時候，只留下那些讓你們停了一下的地方。沒有感覺的，就先放著。」";

const EVIDENCE_APPENDIX =
  "附錄、矩陣證據——（本章約 800~1200 字。到這裡才可以正式使用術語。）\n" +
  "挑出全篇證據最強的 5~8 條判讀，每一條都依下列固定格式寫：\n" +
  "【判讀】一句話。\n【紫微證據】具體盤面資料。\n【八字證據】具體盤面資料。\n【西洋占星證據】具體盤面資料。\n【人類圖證據】具體資料。\n" +
  "【交叉判定】強／中／弱。\n【備註】哪些是直接證據，哪些是合理推論。\n" +
  "某一套系統若在摘要中沒有相關支持，就寫「此系統未提供明顯支持」，絕對不要硬湊、不要編造盤面資料。";

const EVIDENCE_APPENDIX_COUPLE =
  "附錄、矩陣證據——（本章約 800~1200 字。到這裡才可以正式使用術語。）\n" +
  "挑出全篇證據最強的 5~8 條關係判讀，每一條都依下列固定格式寫（證據要分別標明是誰的盤面，以及兩盤之間的互動）：\n" +
  "【判讀】一句話。\n【紫微證據】兩人各自的具體盤面資料與互動。\n【八字證據】兩人各自的具體盤面資料與互動。\n" +
  "【西洋占星證據】兩人各自的具體盤面資料與互動。\n【人類圖證據】兩人各自的具體資料與互動。\n" +
  "【交叉判定】強／中／弱。\n【備註】哪些是直接證據，哪些是合理推論。\n" +
  "某一套系統若在摘要中沒有相關支持，就寫「此系統未提供明顯支持」，絕對不要硬湊、不要編造盤面資料。";

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
      ONE_PAGE_SOLO,
      "一、基礎命盤總覽——用白話把四套系統各自看到的他講一遍，然後指出四套同時指向的那件事。本章必須包含「這些年你應該經歷過」段落：關卡年 2~3 個＋父母線索＋2~3 個日常線索，全部寫成可打勾的句子",
      "二、人生羅盤——你的優勢（講到他敢承認自己厲害）、你的盲點（講到他臉熱）、給你的一句話",
      "三、劇本原型——他的核心人格結構，給這個原型取一個好記、有畫面的名字，並解釋這個原型的劇情通常怎麼展開",
      "四、運作方式——他怎麼思考、怎麼做決定、怎麼推動事情；哪個環節最順、哪個環節最容易當機",
      "五、三大人生場域——事業／關係／金錢：看似三個題目，其實是同一套底層機制的三個現場，逐一拆",
      "六、隱藏關卡——最容易被忽略、卻最會讓人生卡住的地方；他繞不過去時通常長什麼樣子",
      "七、思維工具箱——為他量身打造 3~4 個思考工具，每個都要具體到「明天遇到事就能拿出來用」，並說明為什麼這工具剛好剋他的結構",
      "八、軍團編制——把他的命盤翻成一套角色系統（主帥、軍師、先鋒、後勤…各自對應具體命盤特徵），讓抽象結構變成可以叫得出名字的隊友",
      "九、最終總結——一份濃縮的人生說明書：他是誰、他怎麼運作、他適合怎麼前進。收在溫暖而有力的一段話。" +
      "最後自然接一小段（像朋友的邀請，絕不能像廣告）：這份報告帶你「看見」了結構，但看見之後怎麼用在眼前真實的抉擇上，是另一段路——" +
      "如果你想把這份看見用回自己現在卡住的地方，歡迎私訊 Instagram 或 Facebook「@floating_matrix 浮生矩陣」，預約一對一的「浮生導航」",
      EVIDENCE_APPENDIX,
    ],
    splits: [[0, 2], [3, 6], [7, 10]],
  },
  breakthrough: {
    label: "破局版",
    goal:
      "專挑四套系統互相『矛盾、打架』之處，以及藏在盲區的自我欺騙，一刀切進核心。" +
      "開場直接戳破他最相信、卻最困住他的那個故事。",
    chapters: [
      ONE_PAGE_SOLO,
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
      EVIDENCE_APPENDIX,
    ],
    splits: [[0, 2], [3, 5], [6, 9]],
  },
  sync: {
    label: "合盤・同頻版",
    goal:
      "把兩張命盤放在一起，講清楚：你們是怎麼吸引彼此的、這段關係運轉得最好的樣子長什麼樣。" +
      "開場第一段就給這段關係最準的一句總綱（那組核心張力的「禮物面」）。",
    chapters: [
      ONE_PAGE_COUPLE,
      "一、兩張命盤的第一眼——兩人各自是什麼結構的人（各一段白話畫像，用名字），然後點出這段關係的核心引力",
      "二、吸引力的來源——你們當初為什麼會被彼此吸住：哪些是互補（他有你沒有的）、哪些是同頻（一拍即合的），逐項扣回兩張命盤",
      "三、相處的預設模式——誰發起誰回應、誰講道理誰講感覺、誰快誰慢；你們能量的自然流向，順著走最省力",
      "四、三大關係場域——溝通／親密與情感表達／金錢與未來規劃：同一組結構在三個現場的樣子",
      "五、你們最好的樣子——這段關係運轉最順的時刻長什麼樣、通常發生在什麼條件下、怎麼有意識地多創造這種時刻",
      "六、相處說明書——為你們量身的 3~4 條具體守則（具體到「下次遇到＿＿就＿＿」），每條說明為什麼剛好剋你們的結構",
      "七、最終總結——這段關係的核心禮物一句話講清，收在溫暖有力的一段話。" +
      "最後自然接一小段（像朋友的邀請，絕不能像廣告）：合盤讓你們看見了彼此的結構，但兩個人要一起走，還有很多「當下的選擇」——" +
      "如果想把這份看見用回你們正在面對的事，歡迎私訊 Instagram 或 Facebook「@floating_matrix 浮生矩陣」，預約兩人一起的「浮生導航」",
      EVIDENCE_APPENDIX_COUPLE,
    ],
    splits: [[0, 2], [3, 5], [6, 8]],
  },
  clash: {
    label: "合盤・碰撞版",
    goal:
      "專挑兩張命盤互相打架的地方：你們反覆吵的那件事、互相消耗的迴圈、彼此的地雷與盲區。" +
      "開場直接說中你們最常見的那一種僵局，講到兩人心裡一震。",
    chapters: [
      ONE_PAGE_COUPLE,
      "一、兩套劇本的對撞點——你們最典型的那一種吵法／僵法（冷戰？追逃？講不到一個頻道上？），開場直接重演一次那個場景",
      "二、矛盾羅盤——把兩人的差異攤開分類：哪些其實是互補（被誤會成問題的資產）、哪些是真正的結構衝突（要一輩子磨的），各自扣回命盤",
      "三、衝突迴圈解剖——從觸發點→各自的情緒反應→各自說出口的話→各自的行動→各自心裡留下的結論，一層層拆你們的慣性迴圈，指名誰在哪一層扮演什麼",
      "四、彼此的地雷與盲區——A最受不了B的其實是＿＿（而那與其說是B的問題，不如說踩到A的什麼結構）；反過來也寫B的。用名字，寫到臉熱",
      "五、用錯力的場合——你們最常在哪些場景互相消耗（翻舊帳、比較誰付出多、講到未來就卡住…），每個場景給可打勾的細節",
      "六、拆彈手冊——3~4 條實際可用的破局做法，具體到「下次吵起來的第一分鐘可以怎麼做」，並說明哪一條是誰的功課",
      "七、最終總結——你們真正要一起練的那一門功課一句話講清；狠在點上、暖在底層，最後把兩人都接住。" +
      "收尾自然接一小段（像朋友的邀請，絕不能像廣告）：迴圈不是讀完就會停的，是在一次次真實衝突裡練出來的——" +
      "如果想有人陪你們把這些矛盾拆進現在的處境，歡迎私訊 Instagram 或 Facebook「@floating_matrix 浮生矩陣」，預約兩人一起的「浮生導航」",
      EVIDENCE_APPENDIX_COUPLE,
    ],
    splits: [[0, 2], [3, 5], [6, 8]],
  },
};

/* ============================================================
   生成核心
============================================================ */
async function callClaude(apiKey: string, system: string, prompt: string, maxTokens = 9000): Promise<string> {
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
      `這一次只寫以下章節（每章約 1000~1300 字，用 markdown 小標題；章節說明中另有字數指示者，以該指示為準）：\n${chapterList(plan, plan.splits[0])}\n\n` +
      `請嚴格依下列格式輸出（不要 JSON、不要程式碼圍欄、不要多餘說明）：\n\n` +
      `===千字精華===\n（約 500~700 字：開場一句最準的總綱＋四套系統各一小段＋一段綜合。` +
      `要白話、要有打勾句，結尾留鉤子讓人想看完整版，但不要寫「請購買」之類的話。這是散文式的引子，與報告第一章「如果這份報告你只看一頁」的條列速覽必須明顯不同，不要重複同樣的句子）\n\n` +
      `===報告開始===\n（接著寫上面指定的章節）`;
  } else {
    const tail = prevText.length > 3000 ? prevText.slice(-3000) : prevText;
    prompt +=
      `【任務】你正在撰寫「${plan.label}」報告（約一萬字，分三次寫，這是第 ${part + 1} 次）。\n` +
      `以下是前文的結尾（供銜接語氣與避免重複，不要重寫這些內容）：\n…${tail}\n\n` +
      `請無縫接著寫以下章節（每章約 1000~1300 字，markdown 小標題；章節說明中另有字數指示者以該指示為準；開頭不要再放總標題或開場白）：\n${chapterList(plan, plan.splits[part])}\n` +
      (isLast
        ? `\n**這是最後一段：務必把上列章節（含最終總結與矩陣證據附錄）全部完整寫完、好好收尾，絕對不能截斷。**`
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

  /* ---------- 模式 R：訂單擁有者觸發補跑（掉棒自癒） ----------
     report.html 輪詢時呼叫：若某版整版缺失、或草稿卡超過 5 分鐘未發布 → 補跑該版 */
  if (body.resume_order) {
    const rtoken = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!rtoken) return json({ error: "請先登入" }, 401);
    const { data: ruser } = await admin.auth.getUser(rtoken);
    if (!ruser?.user) return json({ error: "登入已過期" }, 401);
    const { data: rorder } = await admin.from("orders").select("*").eq("id", body.resume_order).maybeSingle();
    if (!rorder || rorder.user_id !== ruser.user.id) return json({ error: "找不到訂單" }, 404);
    if (rorder.status !== "generating" || !rorder.case_id) return json({ ok: false, skip: true });
    const rneed = rorder.product === "couple" ? ["sync", "clash"] : ["script", "breakthrough"];
    const fired: string[] = [];
    for (const v of rneed) {
      const { data: rep } = await admin.from("reports").select("id,published,created_at")
        .eq("case_id", rorder.case_id).eq("version", v).maybeSingle();
      const stale = rep && !rep.published && (Date.now() - new Date(rep.created_at).getTime() > 5 * 60 * 1000);
      if (!rep || stale) {
        const p = fetch(`${SUPABASE_URL}/functions/v1/generate-report`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-internal-key": SERVICE_KEY },
          body: JSON.stringify({ order_id: rorder.id, version: v, part: 0 }),
        }).catch((e) => console.error("補跑觸發失敗", v, e));
        // deno-lint-ignore no-explicit-any
        (globalThis as any).EdgeRuntime?.waitUntil?.(p);
        fired.push(v);
        break; // 一次補一版
      }
    }
    if (fired.length) await new Promise((r) => setTimeout(r, 1500));
    return json({ ok: true, fired });
  }

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
      `章節（每章精煉 140~200 字，markdown 小標題；「只看一頁」與「矩陣證據附錄」各約 180 字，總計約 1800 字）：\n${plan.chapters.map((c) => "・" + c).join("\n")}\n\n` +
      `請嚴格依下列格式輸出（不要 JSON、不要圍欄）：\n\n===千字精華===\n（約 400~550 字）\n\n===完整報告===\n` +
      `（依上述章節，**務必把最後一章完整寫完才結束**）`;
    // ADMIN_MAX_TOKENS 刻意壓低：Supabase Edge Function 單一請求有 CPU／記憶體／
    // wall-clock 上限，超過會被直接終止並回傳 HTTP 546（不會進到下面的 catch）。
    // 模式 A 用接力分段避開這件事；模式 B 是單次請求，只能靠縮小單次產出。
    // 若之後要恢復萬字規模，必須讓模式 B 也改成接力（回 202 + 前端輪詢）。
    const text = await callClaude(apiKey, system, prompt, ADMIN_MAX_TOKENS);
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
