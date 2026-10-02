# 規則層：規則不是一句 prompt

浮生矩陣目前把所有規則寫成 `generate-report.ts` 裡的字串常數。以下文件是那些規則的可讀化摘錄，方便日後真的要把規則外部化時有現成的起點——**這些檔案目前只是文件，`generate-report.ts` 仍照舊直接使用程式碼裡的常數，兩邊需要人工保持同步**。

- [persona.md](persona.md) — 身份背景、目標讀者
- [tone-map.md](tone-map.md) — 語氣風格（溫和／犀利／狠）
- [report-structure.md](report-structure.md) — 輸出格式（四種版本、章節、分段規則）
- [honesty-boundary.md](honesty-boundary.md) — 不知道就說不知道、誠實邊界
- [banned-expressions.md](banned-expressions.md) — 禁用表達

## 缺口

目前沒有獨立的「引用來源」規則檔——命盤特徵的標註方式（括號輕巧標註，例如「依據：你的月亮在天蠍」）目前寫在白話鐵律裡，沒有拆成獨立維度。如果未來要調整引用格式，直接修改 [report-structure.md](report-structure.md) 或視需要新增 `citation-style.md`。
