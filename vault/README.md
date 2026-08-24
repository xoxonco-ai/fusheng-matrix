# 浮生矩陣知識庫（claude-obsidian vault）

用 [claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) v2.1.0 建立的
local-first 知識庫。純 Markdown + JSON，不依賴任何雲端服務。

## 目錄

| 路徑 | 用途 |
|------|------|
| `inbox/` | 放待處理的來源檔（文章、逐字稿、PDF…） |
| `.raw/` | 不可變的來源副本，以內容雜湊定址 |
| `wiki/` | 產出的連結筆記、索引、日誌 |
| `wiki/meta/ledgers/` | 來源與主張的溯源帳本 |
| `.vault-meta/` | 執行期狀態，已被 gitignore |

## 使用方式

先安裝 plugin（只需一次，Python 3.11+）：

```bash
claude plugin marketplace add AgriciDaniel/claude-obsidian
claude plugin install claude-obsidian@agricidaniel-claude-obsidian
```

從 repo 根目錄執行時，指定 vault 位置：

```bash
export CLAUDE_OBSIDIAN_VAULT="$(pwd)/vault"
```

或直接在 `vault/` 裡開 Claude Code。常用指令：

```
/claude-obsidian:wiki          起手式，看目前狀態
/claude-obsidian:wiki-ingest   把 inbox/ 的來源吃進來
/claude-obsidian:wiki-query    問知識庫
/claude-obsidian:save          明確存下一段答案
/claude-obsidian:wiki-lint     檢查連結與溯源完整性
```

用 Obsidian 開啟時，透過 vault picker 選擇這個 `vault/` 目錄。

## 健康檢查

```bash
python3 <plugin>/scripts/claude-obsidian.py doctor --vault ./vault
```
