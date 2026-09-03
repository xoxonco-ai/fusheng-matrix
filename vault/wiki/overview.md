---
type: overview
title: Vault Overview
status: developing
created: 2026-08-24
updated: 2026-08-27
tags:
  - overview
---

# Vault Overview

This local-first vault compounds source-backed knowledge over time.

## 目前的主題

**浮生矩陣「人生羅盤」排盤系統。** 兩個來源：產品的公開技術文件（official）
與單人排盤頁的實作程式碼（primary）。拆成三條線：引擎怎麼算
（[[排盤引擎架構]]）、哪些結論可被讀者驗證（[[關卡年推算]]）、
哪些話不能說（[[解讀邊界與誠實聲明]]）。

## 目前的證據狀態

七則主張：六則 `accepted`、一則 `deprecated`。第一輪只有文件時，
三則技術主張停在 `provisional`；第二輪讀了 `paipan.html` 逐項比對後升上來。

**一則主張走完了完整生命週期**：`clm-parent-guard-narrower` 記錄了
文件與程式碼的落差（文件說禁止「姓氏或具體事件」，防護字串只寫了「姓氏」），
落差修補後轉為 `deprecated`，由 `clm-parent-guard-fixed` 取代。
舊主張與它的矛盾證據都沒有刪除——這類落差會再發生，紀錄留著才有參考價值。

## 未解的部分

- 與第三方排盤軟體對照實際輸出——兩個來源共用 `independence_key`，
  互相佐證的份量有限，真正的獨立驗證還沒做
- `hepan.html`、`admin.html` 未讀
- 三個 CDN 開源引擎本身只確認版本號，未檢視實作
