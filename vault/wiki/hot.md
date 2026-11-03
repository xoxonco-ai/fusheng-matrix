---
type: meta
title: Hot Cache
status: developing
created: 2026-08-24
updated: 2026-11-03
tags:
  - meta
  - hot-cache
---

# Recent Context

## Last Updated

2026-11-03，ingest 操作 `ingest-paipan-dedupe-20261103` 完成（三處重複計算已收斂）。

## Key Recent Facts

- 三處重複計算已收斂為頂層共用函式：`lonToGate`、`ziweiHourIndex(h)`、`designTime(utc)`，`compute()` 與 `chartSummary()` 共用同一份。
- `_ltg` 一直是多餘的——它和 `lonToGate` 同屬一個 `<script>` 的頂層作用域，摘要那邊本來就能直接呼叫。
- **刻意沒合併** `fmtSign`/`_fmt` 與 `CENTER_NAME`/`_CNM`：前者多語＋一位小數，後者固定繁中＋零位小數，行為不同。
- 收斂版 `Math.random` 已降為 **0 處**（星空動畫隨首頁改版移除），確定性比稽核時更強。
- `paipan.html` 在稽核版與收斂版之間被其他 commit 大幅改過（首頁改版、千字精華、聊天機器人），12 項參數已重新核對全數成立。

## Recent Changes

- 擷取收斂版快照 `e375e4d6…`；修補版 `e5206373…` 轉為 `superseded`。四份快照全部保留。
- 新增主張 `clm-calc-single-source`（accepted）。
- 五則既有主張補上收斂版為支持證據並更新 `reviewed_at`。

## Active Threads

- **待抽查**：防護字串存在不等於模型遵守，要拿實際產出的報告抽驗父母段落。
- **待驗**：拿已知出生資料與第三方排盤軟體對照——所有來源同 repo 同作者，這才是真正的獨立佐證。
- **未讀**：`hepan.html`、`admin.html`。`hepan.html` 也有自己的 `calcPerson()`，可能存在同類的重複實作。
