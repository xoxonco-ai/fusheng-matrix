---
type: meta
title: Hot Cache
status: developing
created: 2026-08-24
updated: 2026-08-27
tags:
  - meta
  - hot-cache
---

# Recent Context

## Last Updated

2026-08-27，ingest 操作 `ingest-paipan-20260827` 完成。

## Key Recent Facts

- 排盤計算路徑**無隨機性、無當下時間**：`Math.random()` 只在星空背景動畫，`Date.now()` 只在快取時戳。確定性已由程式碼證實。
- 技術文件 12 項可查驗參數，**11 項與 `paipan.html` 逐字相符**。`GATE_ORDER` 64 元素完全相同且為 1–64 完整排列。
- **唯一落差**：父母線索防護字串只寫「嚴禁猜姓氏」，文件宣稱的「具體事件」沒進防護，全檔搜不到這四個字。
- `paipan.html` 有三處計算邏輯各兩份實作（閘門轉換、時辰索引、設計盤二分），改一邊會靜默漂移。
- `hepan.html` 取了父母宮主星但變數從未使用——死程式碼，不是防護缺口。

## Recent Changes

- 擷取 `paipan.html`（87,982 bytes）至不可變區。
- 三則主張 provisional → accepted；新增 `clm-doc-code-consistent`、`clm-parent-guard-narrower`。
- 問題頁 [[排盤程式碼是否與技術文件一致]] 已解答，含逐項對照表。

## Active Threads

- **可修**：`paipan.html` 599 行標籤改成「嚴禁猜姓氏或具體事件」，一行字。
- **可修**：三處重複實作收斂成單一函式，避免漂移。
- **待驗**：拿已知出生資料與第三方排盤軟體對照，這才是真正的獨立佐證。
- **未讀**：`hepan.html`、`admin.html`。
