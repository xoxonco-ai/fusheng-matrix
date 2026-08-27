---
type: meta
title: Wiki Log
status: evergreen
created: 2026-08-24
updated: 2026-08-27
tags:
  - meta
  - log
---

# Wiki Log

Newest completed operations appear first.

## 2026-08-27 — `ingest-paipan-20260827`

第二輪 ingest，目的是驗證第一輪留下的 provisional 主張。
來源：`paipan.html`（87,982 bytes，SHA-256 `2b791137…546a`），權威層級 `primary`。

**新增頁面**

- `wiki/sources/paipan 單人排盤實作.md`

**改寫頁面**

- `wiki/questions/排盤程式碼是否與技術文件一致.md` — 從待解問題改寫為逐項對照表與結論
- `wiki/concepts/排盤引擎架構.md` — 移除未驗證警告，新增重複實作的維護風險
- `wiki/concepts/關卡年推算.md` — 移除未驗證警告，附上實際程式碼
- `wiki/concepts/解讀邊界與誠實聲明.md` — 新增實作落差警示

**主張評估變動**

| 主張 | 變動 | 依據 |
|------|------|------|
| `clm-engine-deterministic` | provisional → **accepted** | 計算路徑無 `Math.random()` / `Date.now()` |
| `clm-gate-years-computed` | provisional → **accepted** | 三訊號範圍步長逐字相符 |
| `clm-hd-design-88deg` | provisional → **accepted** | 88°／80-95 天／60 次／13 天體全符 |
| `clm-doc-code-consistent` | 新增 **accepted** | 12 項參數 11 項逐字相符 |
| `clm-parent-guard-narrower` | 新增 **accepted** | 599 行防護字串未含「具體事件」 |
| `clm-parent-inference-restricted` | 維持 accepted | 關於文件規定，不受實作落差影響 |

**矛盾證據**：`clm-parent-guard-narrower` 記錄了文件與程式碼的不一致，
兩邊來源都保留（文件標 `contradicts`，程式碼標 `supports`），未擇一刪除。

**未涵蓋**：`hepan.html`、`admin.html`、CDN 引擎實作、與第三方軟體的輸出對照。

## 2026-08-27 — `capture-paipan-20260827`

擷取 `inbox/paipan.html` 至 `.raw/captured/`（create-only）。
`解盤公式.md` 經雜湊比對判定未變更，跳過。

## 2026-08-24 — `ingest-jiepan-20260824`

首次 ingest。來源：`解盤公式.md`（8,423 bytes，SHA-256 `81546581…2454`），
本機檔案，無網路抓取。

**新增頁面**

- `wiki/sources/解盤公式技術文件.md`
- `wiki/concepts/排盤引擎架構.md`
- `wiki/concepts/關卡年推算.md`
- `wiki/concepts/解讀邊界與誠實聲明.md`
- `wiki/questions/排盤程式碼是否與技術文件一致.md`

**主張評估**

| 主張 | 評估 | 理由 |
|------|------|------|
| `clm-engine-deterministic` | provisional | 規格層級，未讀程式碼 |
| `clm-gate-years-computed` | provisional | 未讀 `chartSummary()` |
| `clm-hd-design-88deg` | provisional | 單一來源，未驗證收斂 |
| `clm-parent-inference-restricted` | accepted | 官方來源對自家規定即權威 |

**未涵蓋**：文件未含正確性驗證、AI 提示詞、隱私處理、命理效度主張，均未外推。

**矛盾證據**：無。

## 2026-08-24 — `capture-jiepan-20260824`

擷取 `inbox/解盤公式.md` 至 `.raw/captured/`（create-only）。

## 2026-08-24 — `init-fusheng`

Vault 初始化。
