---
type: meta
title: Wiki Log
status: evergreen
created: 2026-08-24
updated: 2026-11-10
tags:
  - meta
  - log
---

# Wiki Log

Newest completed operations appear first.

## 2026-11-10 — `ingest-shared-calc-20261110`

抽出 `fusheng-calc.js`，把 paipan 與 hepan 的計算層收斂為單一來源（方案 A）。

**程式碼變更**

| 檔案 | 變化 |
|------|------|
| `fusheng-calc.js` | 新增，62 行、19 個頂層宣告 |
| `paipan.html` | −3,384 字元 |
| `hepan.html` | −2,867 字元 |

收進共用檔：`s2t`、`_SG`/`_fmt`/`_CNM`、`GATE_ORDER`/`GATE_CENTER`/`MOTORS`/
`CHANNELS`/`gco`/`lonToGate`、`trueNodeLon`/`planetLon`/`sunLon`/`designTime`、
`ziweiHourIndex`、`STEM_WUXING`/`BRANCH_WUXING`、`saturnReturn`/`chongYears`。

刻意保留在各頁：多語 UI 資料（`fmtSign`、`CENTER_NAME`、`TYPE`…）、
`STEM_EL`/`BRANCH_EL`（對映 CSS class，不同資料形狀）、合盤專屬的
`elPair`/`quickRead`。

**驗證（23 項，零差異）**

| 層次 | 內容 | 結果 |
|------|------|------|
| 靜態 | 宣告衝突交集 / 未定義引用 | 0 / 0 |
| 語法 | 共用檔與兩頁 inline | `node --check` 全過 |
| 端對端 | paipan 6 組渲染 DOM＋摘要 | 逐字相同 |
| 端對端 | hepan 6 組 `calcPerson()`＋5 組 `quickRead()` | 逐字相同 |
| 跨頁 | 5 組單人盤 vs 合盤的人類圖類型／權威／角色 | 全一致 |

**主張評估變動**

| 主張 | 變動 |
|------|------|
| `clm-calc-shared-across-pages` | 新增 **accepted**，`supersedes` 下一列 |
| `clm-crossfile-calc-duplication` | accepted → **deprecated** |
| 六則既有技術主張 | 補上新快照為支持證據 |

**更正**：2026-11-03 的記錄寫「hepan 關卡年只有土星回歸」有誤，
實際有土星回歸與流年沖日支**兩個**訊號，只缺大運交接。
錯因為只數 grep 命中次數、未逐行讀該區塊。已在 hepan 來源頁標註更正。

**未涵蓋**：`admin.html` 未納入共用、仍未讀；未引入打包工具；
hepan 的 `_fm` 死碼未清。


## 2026-11-03 — `ingest-hepan-20261103`

稽核 `hepan.html`，釐清重複實作的實際範圍。來源：482 行，
SHA-256 `56f9cc27…f19d`，權威層級 `primary`。

**新增頁面**

- `wiki/sources/hepan 合盤實作.md`
- `wiki/questions/跨檔計算層重複.md`

**結論**

檔案內部**零重複**；但與 `paipan.html` **跨檔重複約 14 項**，
逐項驗證目前零行為漂移。三處差異純屬命名。

| 驗證 | 結果 |
|------|------|
| 閘門轉換 `lonToGate` vs `_ltg` | 29,377 個黃經值 → 0 不一致 |
| 設計盤 `designTime` vs hepan 就地版 | 3 替身 × 292 時刻 = 876 次 → 0 不一致 |
| 紫微時辰索引 | h=0..23 → 0 不一致 |
| `planetLon`、北交點 | 命名正規化後逐字相同 |
| `GATE_ORDER` 等 9 項常數與函式 | 逐字相同 |

**主張評估**

| 主張 | 評估 |
|------|------|
| `clm-hepan-no-internal-dup` | 新增 **accepted** |
| `clm-crossfile-calc-duplication` | 新增 **accepted** |

**附帶發現**：hepan 的 `_fm` 是死碼（宣告、賦值、零次讀取）；
hepan 關卡年只有土星回歸；paipan 殘留 `wx`/`_wx2` 兩份天干五行表（低風險）。

**未涵蓋**：未逐行審閱 `quickRead()` 的合盤判定邏輯與詮釋內容；
`admin.html` 仍未讀。跨檔重複的處理方式待決定，本次只記錄不修改。


## 2026-11-03 — `ingest-paipan-dedupe-20261103`

收斂稽核時發現的三處重複計算，並重新擷取檔案為新快照。

**程式碼變更**：`paipan.html`，18 行新增 / 8 行刪除

| 邏輯 | 收斂後 | 收斂前 |
|------|--------|--------|
| 黃經轉閘門 | `lonToGate`（兩邊共用） | `lonToGate` / `_ltg` 各一份 |
| 紫微時辰索引 | `ziweiHourIndex(h)` | 兩處就地運算 |
| 設計盤時刻 | `designTime(utc)` | 兩處各自展開二分迴圈 |

**行為等價性驗證（三層）**

1. 從檔案抽出兩份實作逐值對跑：29,377 個黃經值（含 64 個閘門邊界 ±1e-9
   與每爻邊界），零不一致
2. 二分法：3 種確定性 `sunLon` 替身 × 292 個跨百年時刻 = 876 次，零不一致
3. 端對端：用 npm 取回三個引擎在 Chromium 實跑 6 組出生資料（晚子時 23:00、
   早子時 00:15、閏日、南半球、時間不確定、不同時區），改動前後渲染 DOM
   與 AI 摘要逐字相同

**刻意未合併**：`fmtSign`/`_fmt`、`CENTER_NAME`+`cName`/`_CNM`——行為不同
（多語＋一位小數 vs 固定繁中＋零位小數）。看起來像重複就合併是錯的。

**來源狀態**

| 來源 | 變動 |
|------|------|
| `src-a18adecb…`（修補版 `e5206373…`） | active → **superseded** |
| `src-928d2d54…`（收斂版 `e375e4d6…`） | 新增 active，`supersedes` 前者 |

**主張評估變動**

| 主張 | 變動 |
|------|------|
| `clm-calc-single-source` | 新增 **accepted** |
| 其餘五則技術主張 | 補上收斂版為支持證據，`reviewed_at` → 2026-11-03 |

**重新核對**：檔案在兩版之間被其他 commit 大幅改過，已對收斂版重跑 12 項
參數核對，全數成立；`Math.random` 由 1 處降為 0 處。

**未涵蓋**：未逐行審閱中間那幾個 commit 的非計算改動；`hepan.html` 的
`calcPerson()` 可能有同類重複，未查。


## 2026-08-27 — `ingest-paipan-fix-20260827`

修補稽核發現的防護落差，並把修補後的檔案重新擷取為新快照。

**程式碼變更**：`paipan.html` 599 行

```diff
-【父母線索｜只談關係/性格議題，嚴禁猜姓氏】
+【父母線索｜只談關係/性格議題，嚴禁猜姓氏或具體事件】
```

一行、一處字串替換。改動位於 template literal 的純文字內，未引入 JS
metacharacter；修改後 inline JavaScript 通過 `node --check`。

**來源狀態**

| 來源 | 變動 |
|------|------|
| `src-26ef87d2…`（稽核版 `2b791137…`） | active → **superseded** |
| `src-a18adecb…`（修補版 `e5206373…`） | 新增 active，`supersedes` 前者 |

舊快照未被覆寫，仍在 `.raw/captured/`。

**主張評估變動**

| 主張 | 變動 |
|------|------|
| `clm-parent-guard-narrower` | accepted → **deprecated**（落差已消除） |
| `clm-parent-guard-fixed` | 新增 **accepted**，`supersedes` 前者 |
| `clm-doc-code-consistent` | 文字錨定稽核快照，補記修補結果 |
| `clm-engine-deterministic` / `clm-gate-years-computed` / `clm-hd-design-88deg` | 補上修補版快照為支持證據，維持現行有效支持 |

**未涵蓋**：修補後未重跑完整參數稽核（差異僅一個字串，不影響任何計算）；
防護字串是否真被模型遵守未抽查。


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
