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

六則主張全部 `accepted`。第一輪只有文件時，三則技術主張停在 `provisional`；
第二輪讀了 `paipan.html` 逐項比對後才升上來。

**一則矛盾證據已保留**：`clm-parent-guard-narrower`——文件說父母線索
「嚴禁猜測姓氏或具體事件」，程式碼的防護字串只寫了「嚴禁猜姓氏」。
兩邊都記著，以第一手的程式碼為準。

## 未解的部分

- 與第三方排盤軟體對照實際輸出——兩個來源共用 `independence_key`，
  互相佐證的份量有限，真正的獨立驗證還沒做
- `hepan.html`、`admin.html` 未讀
- 三個 CDN 開源引擎本身只確認版本號，未檢視實作
