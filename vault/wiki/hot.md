---
type: meta
title: Hot Cache
status: developing
created: 2026-08-24
updated: 2026-11-10
tags:
  - meta
  - hot-cache
---

# Recent Context

## Last Updated

2026-11-10，ingest 操作 `ingest-shared-calc-20261110` 完成（跨檔計算層已收斂）。

## Key Recent Facts

- **計算層已單一來源**：`fusheng-calc.js`，62 行、19 個頂層宣告，paipan 與 hepan 共用。paipan −3,384 字元、hepan −2,867 字元。
- 一併收進去的比原先盤點的多：關卡年的 `saturnReturn` 與 `chongYears`。
- **最大風險面是宣告衝突，不是演算法**：classic script 頂層 `const` 與 inline script 共用全域詞法環境，同名宣告會讓**整個 inline 區塊**因 SyntaxError 不執行。靠宣告名稱交集檢查擋住，兩頁皆為 0。
- 載入順序硬性條件：必須在四個 CDN 之後、inline 之前（`s2t` 載入時就讀 `window.OpenCC`）。
- 跨頁驗證：同一個人在單人盤與合盤的人類圖類型／權威／角色一致——收斂前也一致，但現在是**結構上保證**而非巧合。
- ⚠️ **更正 2026-11-03 的記錄**：當時寫「hepan 關卡年只有土星回歸」是錯的，實際有**兩個**訊號（土星回歸＋流年沖日支），只缺大運交接。錯因是只數 grep 次數沒逐行讀。

## Recent Changes

- 新增 `fusheng-calc.js` 與其來源頁；paipan / hepan 擷取新快照，舊快照轉 `superseded`（八份快照全部保留）。
- 新增主張 `clm-calc-shared-across-pages`；`clm-crossfile-calc-duplication` 轉 `deprecated`。
- 六則既有主張補上新快照為支持證據。

## Active Threads

- **待抽查**：防護字串存在不等於模型遵守，要拿實際產出的報告抽驗父母段落。
- **待驗**：與第三方排盤軟體對照——所有來源同 repo 同作者，這才是真正的獨立佐證。
- **未讀**：`admin.html`，也未納入共用計算層。
- **可清**：hepan 的 `_fm` 死碼。
