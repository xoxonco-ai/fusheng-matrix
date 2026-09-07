# 工作流層：進入真實任務

## 真實任務：產生命理解讀報告

這是浮生矩陣目前唯一由 AI 執行的真實任務，完整流程如下：

1. 使用者在 `paipan.html`／`hepan.html` 完成排盤，取得免費的基礎命盤
2. 使用者下單，`create-order.ts` 建立訂單
3. `ecpay-notify.ts` / `gomypay-notify.ts` 收到付款成功通知，觸發 `generate-report.ts`
4. `generate-report.ts` 以「接力式分段生成」執行（每次只寫一段，避開 Edge Function 執行時間上限）：
   - part 0：寫前 1/3 章節 + 產出「千字精華」摘要 → 存草稿 → 觸發 part 1
   - part 1：接續寫中間章節 → 觸發 part 2
   - part 2（最後一段）：寫完剩餘章節，務必完整收尾 → 標記 `published: true`、`full_unlocked: true`
   - 個人訂單需要跑完 `script` + `breakthrough` 兩個版本；合盤訂單需要跑完 `sync` + `clash` 兩個版本；第一版跑完後自動接力觸發第二版
5. `report.html` 輪詢訂單狀態；若偵測到某版整版缺失、或草稿卡超過 5 分鐘未發布，會呼叫 `resume_order` 模式自癒補跑
6. 另有 `admin.html` 手動生成模式（模式 B）：管理員登入後可單次產出精簡版（約 3000 字）供編輯，不走接力機制

## 閉環：反饋回寫 → 人工驗收 → 跑通標誌

- **反饋回寫**：目前沒有機制把使用者對報告的反饋寫回規則層（例如「這個痛點沒講中」）。如果未來要做，需要在 `admin.html` 加一個標記/備註欄位，讓管理員能記錄哪些訂單的規則需要調整。
- **人工驗收**：目前的人工驗收管道是 `admin.html` 的手動生成模式——管理員可以先跑一次精簡版檢查語氣/準確度，再讓正式訂單走自動接力生成
- **跑通標誌**：
  - [ ] 能找到資料 — 訂單摘要/證據欄位是否完整帶入 prompt（見 [../data/README.md](../data/README.md)）
  - [ ] 能標注來源 — 報告裡是否有對應命盤特徵的括號標註（見 [../rules/banned-expressions.md](../rules/banned-expressions.md) 的準確感策略）
  - [ ] 變更規則或資料時，無需修改/重新部署核心程式碼 — **目前不成立**：規則仍寫死在 `generate-report.ts`，改規則就要改程式碼、重新部署 Edge Function。這是這個任務目前最大的落差，也是未來如果要把 [../rules/](../rules/README.md) 真正接進來時，需要優先解決的事。
