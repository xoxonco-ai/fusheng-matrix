---
address: l-000009
type: source
title: fusheng-calc.js（共用命理計算層）
created: 2026-11-10
updated: 2026-11-10
status: developing
tags:
  - source
  - 排盤
  - 架構
  - 程式碼
source_type: code
author: 浮生矩陣
date_published: ""
url: ""
source_id: src-3301ff0f80770cf86ae3
sha256: 7f9b0f6fdc9628e5986afb2505bfd104dfad6c8fb9b73febc3fa1fde5e73af6b
authority: primary
independence_key: fusheng-matrix-repo
review_state: active
key_claims:
  - 單人盤與合盤的計算層已收斂為單一檔案，19 個頂層宣告
  - 兩頁的渲染輸出與摘要在收斂前後逐字相同
claim_ids:
  - clm-calc-shared-across-pages
related:
  - "[[paipan 單人排盤實作]]"
  - "[[hepan 合盤實作]]"
  - "[[跨檔計算層重複]]"
  - "[[排盤引擎架構]]"
---

# fusheng-calc.js（共用命理計算層）

## 這是什麼

`paipan.html`（單人盤）與 `hepan.html`（合盤）共用的計算層。
2026-11-10 從兩頁各自的副本收斂而來。

- 62 行、19 個頂層宣告
- 擷取快照：`.raw/captured/7f9b0f6fdc96….bin`（擷取器把 `.js` 判為
  `application/octet-stream` 故存為 `.bin`，位元組與原檔相同）

## 內容

| 區塊 | 項目 |
|------|------|
| 簡繁轉換 | `s2t` |
| 摘要格式化（固定繁中） | `_SG`、`_fmt`、`_CNM` |
| 人類圖對照 | `GATE_ORDER`、`GATE_CENTER`、`MOTORS`、`CHANNELS`、`gco`、`lonToGate` |
| 天文 | `trueNodeLon`、`planetLon`、`sunLon`、`designTime` |
| 紫微 | `ziweiHourIndex` |
| 八字五行 | `STEM_WUXING`、`BRANCH_WUXING` |
| 關卡年 | `saturnReturn`、`chongYears` |

## 載入順序（會踩的坑）

```html
<script src=".../lunar-javascript@1.7.7/lunar.js"></script>
<script src=".../iztro@2.5.8/dist/iztro.min.js"></script>
<script src=".../astronomy-engine@2.1.19/astronomy.browser.min.js"></script>
<script src=".../opencc-js@1.3.1/dist/umd/full.js"></script>
...
<script src="fusheng-calc.js"></script>   <!-- 必須在上面之後、inline 之前 -->
<script> /* 頁面自己的程式 */ </script>
```

兩個硬性條件：

1. **必須在 CDN 之後**——`s2t` 在載入時就讀 `window.OpenCC`，
   `designTime` 等依賴 `Astronomy`。
2. **頁面裡不可再宣告同名變數**——classic script 的頂層 `const` 與 inline
   script 共用同一個全域詞法環境。重複宣告會讓**整個 inline 區塊**因
   SyntaxError 不執行，而且不是只壞那一行。

第 2 點是這次重構最大的風險面，用靜態檢查擋住：抽出共用檔與兩頁 inline 的
頂層宣告名稱做交集，必須為空。

## 保留在各頁的（刻意不共用）

| 項目 | 留在哪 | 為什麼 |
|------|--------|--------|
| `fmtSign`、`CENTER_NAME`、`cName`、`TYPE`、`AUTH`、`ROLE`… | paipan | 依賴 `LANG` 的多語 UI 資料 |
| `STEM_EL`、`BRANCH_EL` | paipan | 對映到 CSS class 名（`wood`/`fire`…），與 `STEM_WUXING` 是不同資料形狀 |
| `elPair`、`quickRead` | hepan | 合盤專屬的比對邏輯 |
| `WX`/`BZ`、`wx`/`bz`、`_wx2` | 各頁一行別名 | 指向共用常數，保留本地名以縮小 diff |

## 未涵蓋

- `admin.html` 未納入共用（未讀）
- 未引入打包工具或模組系統；維持 classic script，與 repo 既有的
  `supabase-config.js`、`fusheng-widget.js` 同一模式
