# 索引層：AI 怎麼找到資料

## 這個任務不需要索引/檢索

浮生矩陣的報告生成任務資料量非常小（見 [../data/README.md](../data/README.md)：每次只有一筆訂單的摘要 + 少量選填欄位），不需要目錄說明、主題地圖、LLM Wiki 或 RAG 中的任何一種——所有輸入都直接放進單一次 prompt。

## 版本本身就是索引

如果要說有「索引」，就是 `generate-report.ts` 裡的版本 key（見 [../rules/report-structure.md](../rules/report-structure.md)）：

- `script` → 個人・劇本版
- `breakthrough` → 個人・破局版
- `sync` → 合盤・同頻版
- `clash` → 合盤・碰撞版

`planOf(version)` 這個函式就是完整的「路徑查找」：給定版本 key，直接對應到固定的章節規劃，不需要更複雜的檢索機制。

## 什麼時候才需要真的做索引/RAG

只有當未來真的建立了案例庫（見 [../data/README.md](../data/README.md) 的「如果未來要擴充」）、且案例數量大到無法整份塞進 prompt 時，才需要考慮索引層的進階做法。在那之前，不要為了套用框架而過度設計。
