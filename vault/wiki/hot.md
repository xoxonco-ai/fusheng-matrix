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

2026-11-03，ingest 操作 `ingest-hepan-20261103` 完成（hepan.html 稽核）。

## Key Recent Facts

- **hepan.html 內部零重複**——每個計算邏輯各只出現一次。paipan 那種「畫面一份、摘要一份」的問題不存在，因為合盤只有 `calcPerson()` 一條路徑。
- **但跨檔重複約 14 項**：hepan 自帶 `GATE_ORDER`、`CHANNELS`、`_ltg`、`planetLon`、`sunLon`、五行表、土星回歸等。逐項驗證**目前零行為漂移**。
- 三處「差異」純屬命名：`lonToGate`/`_ltg`、`trueNodeLon`/`_tnode`、參數 `date`/`dt`。正規化後逐字相同。
- **檔內收斂反而加大不對稱**：paipan 已有 `ziweiHourIndex()`/`designTime()`，hepan 仍就地展開——改 paipan 不會同步到 hepan。
- 合盤**不輸出父母線索**，所以沒有父母防護缺口的問題。但 `_fm`（218 宣告、234 賦值）零次讀取，是死碼。
- hepan 的關卡年只有土星回歸一個訊號（與 paipan 逐字相同），沒有流年沖日支與大運交接。
- paipan 殘留一份低風險重複：`wx`(634) 與 `_wx2`(685) 兩份天干五行表，都在 `chartSummary()` 內。靜態對照資料，漂移風險極低。

## Recent Changes

- 擷取 `hepan.html` 快照 `56f9cc27…`（482 行）。
- 新增來源頁 [[hepan 合盤實作]]、問題頁 [[跨檔計算層重複]]。
- 新增主張 `clm-hepan-no-internal-dup`、`clm-crossfile-calc-duplication`（皆 accepted）。

## Active Threads

- **待決定**：跨檔重複的處理方式 A（抽出 `fusheng-calc.js` 共用）／ B（只對齊形式）／ C（維持現狀）。傾向 A。
- **待抽查**：防護字串存在不等於模型遵守，要拿實際產出的報告抽驗父母段落。
- **待驗**：與第三方排盤軟體對照——所有來源同 repo 同作者，這才是真正的獨立佐證。
- **未讀**：`admin.html`。
- **可清**：hepan 的 `_fm` 死碼；paipan 的 `_wx2` 重複表。
