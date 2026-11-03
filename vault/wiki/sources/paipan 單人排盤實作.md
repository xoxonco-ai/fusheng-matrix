---
address: l-000006
type: source
title: paipan.html（單人排盤實作）
created: 2026-08-27
updated: 2026-11-03
status: mature
tags:
  - source
  - 排盤
  - 程式碼
source_type: code
author: 浮生矩陣
date_published: ""
url: ""
source_id: src-928d2d54da9bc0df723a
sha256: e375e4d6543399132a663787e5f52570e012cd85fbcf5ef914337df04ae624eb
authority: primary
independence_key: fusheng-matrix-repo
review_state: active
key_claims:
  - 計算路徑內無隨機性與當下時間，排盤為確定性計算
  - 關卡年三訊號的掃描範圍與步長與技術文件逐字吻合
  - 三處計算邏輯已收斂為單一來源，compute() 與 chartSummary() 共用
claim_ids:
  - clm-engine-deterministic
  - clm-gate-years-computed
  - clm-hd-design-88deg
  - clm-doc-code-consistent
  - clm-parent-guard-fixed
  - clm-calc-single-source
related:
  - "[[解盤公式技術文件]]"
  - "[[排盤引擎架構]]"
  - "[[關卡年推算]]"
  - "[[解讀邊界與誠實聲明]]"
  - "[[排盤程式碼是否與技術文件一致]]"
---

# paipan.html（單人排盤實作）

## 這是什麼

浮生矩陣「人生羅盤」單人排盤頁的完整實作——HTML、CSS、四套命理系統的
JavaScript 計算、三語系文案、金流與 Supabase 串接，全在一個檔案裡。

- 權威層級：`primary`（實作本身，不是對實作的描述）
- 擷取方式：本機檔案，無網路抓取

## 版本歷史

兩份快照都保留著，舊的不會被覆寫——這是查證當時說了什麼的唯一依據。

| 快照 | SHA-256 前綴 | 狀態 | 內容 |
|------|-------------|------|------|
| 稽核版 | `2b791137…546a` | `superseded` | 父母線索防護只寫「嚴禁猜姓氏」 |
| 修補版 | `e5206373…e2ed` | `superseded` | 防護補成「嚴禁猜姓氏或具體事件」 |
| 收斂版 | `e375e4d6…24eb` | `active` | 三處重複計算收斂為共用函式 |

稽核版→修補版：差異僅一個字串，其餘位元組相同。

修補版→收斂版：中間檔案還被其他 commit 大幅改過（首頁改版、千字精華、
聊天機器人），所以**不是只有我的重構**。收斂版是「別人的改版 ＋ 防護修補
＋ 三處去重」疊加後的結果，已重新核對過全部 12 項參數仍成立。

每一版的 inline JavaScript 都通過 `node --check`。

## 為什麼權威層級是 primary 而非 official

[[解盤公式技術文件]]是 `official`——產品方**描述**自家實作。
這份是實作**本身**。對「程式實際怎麼做」這個問題，程式碼是第一手證據，
文件是二手轉述。兩者衝突時以程式碼為準。

兩者共用 `independence_key: fusheng-matrix-repo`，**不算互相獨立佐證**——
都出自同一個 repo、同一個作者。真正的獨立驗證要靠第三方排盤軟體對照。

## 讀到的關鍵位置

| 行 | 內容 |
|----|------|
| 305 | `GATE_ORDER` 64 閘門排列 |
| 321 / 533 | `lonToGate` / `_ltg`——兩份重複的黃經轉閘門實作 |
| 446 / 553 | `ti=(h===23)?12:Math.floor((h+1)/2)` 紫微時辰索引，兩份 |
| 433 | `dy.slice(1,9)` 大運 8 步 |
| 465 / 567 | 儒略世紀、黃赤交角、ASC/MC 球面公式 |
| 490 / 574 | 設計盤 88° 二分逼近，兩份 |
| 535 | `chartSummary()` 主函式 |
| 583-593 | 關卡年三訊號 |
| 599 | 父母線索與其防護字串 |
| 256 | 出生時間不確定時的四項揭露 |

## 未涵蓋

- `hepan.html`（合盤）與 `admin.html`（後台）不在本次擷取範圍
- 未執行程式、未與第三方排盤軟體對照實際輸出
- 收斂版已重跑 12 項參數核對；但未逐行審閱中間那幾個 commit 帶進來的其他改動（首頁改版等），本頁的結論只涵蓋計算相關部分
- 未檢視 CDN 上的三個開源引擎本身的實作
