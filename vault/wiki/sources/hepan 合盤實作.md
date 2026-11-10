---
address: l-000007
type: source
title: hepan.html（合盤實作）
created: 2026-11-03
updated: 2026-11-10
status: developing
tags:
  - source
  - 排盤
  - 合盤
  - 程式碼
source_type: code
author: 浮生矩陣
date_published: ""
url: ""
source_id: src-86184c277cd230b519c9
sha256: d9b0f23411640ab1475699c7982923a6a28005c9f8461753ca5a1beadfdc436a
authority: primary
independence_key: fusheng-matrix-repo
review_state: active
key_claims:
  - 檔案內部零重複實作，每個計算邏輯各只有一份
  - 計算層已於 2026-11-10 移入共用的 fusheng-calc.js
  - 父母宮主星被取出存進 _fm 但從未讀取，屬死程式碼
claim_ids:
  - clm-hepan-no-internal-dup
  - clm-crossfile-calc-duplication
  - clm-calc-shared-across-pages
related:
  - "[[fusheng-calc.js（共用命理計算層）]]"
  - "[[paipan 單人排盤實作]]"
  - "[[排盤引擎架構]]"
  - "[[跨檔計算層重複]]"
---

# hepan.html（合盤實作）

## 這是什麼

浮生矩陣「情侶合盤」頁的完整實作。兩人各跑一次 `calcPerson()` 完整實算，
再由 `quickRead()` 做結構比對產出「合盤速讀」。

- 權威層級：`primary`（實作本身）
- 482 行，單一 `<script>` 區塊（190–469）
- 擷取方式：本機檔案，無網路抓取

## 內部結構

| 函式 | 職責 |
|------|------|
| `calcPerson(c)` | 單人完整實算，回傳摘要字串陣列 |
| `elPair(a,b,layer)` | 五行生剋配對判定 |
| `quickRead(A,B,an,bn)` | 兩人結構比對，產出合盤速讀 |
| `readPerson(pfx)` | 讀取表單欄位 |

## 與 paipan.html 的關係

**檔案內部零重複**——每個計算邏輯在 hepan 裡各只出現一次，
paipan 原本那種「畫面一份、摘要一份」的問題在這裡不存在。

原本 hepan **自帶一整套計算層**，與 paipan 跨檔重複。
2026-11-10 已收斂到 [[fusheng-calc.js（共用命理計算層）]]，
hepan 現在只保留合盤專屬邏輯（`elPair`、`quickRead`、`readPerson`）
與幾行指向共用常數的別名。詳見 [[跨檔計算層重複]]。

## 與 paipan 的功能差異

| 項目 | paipan | hepan |
|------|:---:|:---:|
| 八字四柱、紫微命宮、占星、人類圖 | ✅ | ✅ |
| 關卡年：土星回歸 | ✅ | ✅ |
| 關卡年：流年沖日支 | ✅ | ✅ |
| 關卡年：大運交接 | ✅ | ❌ |
| 父母線索 | ✅（含防護字串） | ❌（見下方死碼） |
| 大運八步、胎元命宮身宮旬空 | ✅ | ❌ |

合盤不輸出父母線索，所以**沒有父母防護缺口的問題**。

> [!warning] 更正（2026-11-10）
> 2026-11-03 的稽核記錄寫「hepan 的關卡年只有土星回歸一個訊號」，**這是錯的**。
> hepan 有**兩個**訊號：土星回歸與流年沖日支（`_chong`，14–55 歲，
> 與 paipan 同一個 `((y-4)%12)` 公式，兩檔當時逐字相同）。只缺大運交接
> （`getDaYun` 全檔 0 處）。
>
> 錯因：當初用 `grep -c "age=27\|沖日支\|getDaYun"` 數到 2，
> 就誤判成「只有一個訊號」，沒有逐行讀那個區塊。兩個訊號後來都已移入共用檔。

## 死程式碼

`_fm` 在 218 行宣告、234 行被賦值為父母宮主星，但**全檔零次讀取**。

```js
const out=[];let _fm='';                                   // 218
const _fmp=zw.palaces.find(p=>p.name==='父母');
if(_fmp)_fm=_s2t(_fmp.majorStars.map(s=>s.name).join('、'))||'(空宮)'   // 234
```

清理時別誤以為它有在用——但也別因為它存在就以為合盤會談父母議題。

## 未涵蓋

- 只稽核了計算層與重複狀況，未逐行審閱 `quickRead()` 的合盤判定邏輯
- 未驗證合盤速讀的詮釋內容是否恰當
- `admin.html` 仍未讀
