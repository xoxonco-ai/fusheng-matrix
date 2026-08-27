# 浮生矩陣知識庫

用 [claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) v2.1.0 建立的
local-first 知識庫。純 Markdown + JSON，不依賴雲端服務，Obsidian 可直接開啟。

核心規則只有一條：**每個結論都要能追回來源。** 沒有來源的東西不會被寫成「已確立」。

---

## 一、每次開工

```bash
cd ~/Documents/fusheng-matrix
git pull                                    # 先同步，避免兩邊打架
export CLAUDE_OBSIDIAN_VAULT="$(pwd)/vault"
claude
```

`export` 只在當前終端機視窗有效。嫌麻煩就寫進 `~/.zshrc`：

```bash
echo 'alias fs="cd ~/Documents/fusheng-matrix && export CLAUDE_OBSIDIAN_VAULT=\"$PWD/vault\" && claude"' >> ~/.zshrc
source ~/.zshrc
```

以後打 `fs` 就直接進來了。

## 二、收東西進來

**放檔案** → `vault/inbox/`（文章、逐字稿、PDF、Markdown 都行）

```bash
open ~/Documents/fusheng-matrix/vault/inbox
```

**然後在 Claude Code 裡**：

```
/claude-obsidian:wiki-ingest
```

它會讀來源、分類、抽出可證偽的主張、建立互相連結的筆記，並把每個主張的
支持證據記進帳本。網址也可以，但**會先問你同意抓哪些網域**才連網。

貼文字也行：直接把內容貼進對話，說「ingest 這個」。

## 三、問知識庫

```
/claude-obsidian:wiki-query
```

只從 vault 找答案、附上來源，**不會上網編**。找不到就說找不到。

資料多了之後可以建索引加速：

```
/claude-obsidian:wiki-retrieve
```

## 四、存下對話裡的結論

聊出一個好結論、想留下來：

```
/claude-obsidian:save
```

這跟 ingest 不同——ingest 吃的是外部素材，save 存的是**你跟 AI 談出來的東西**。

## 五、定期體檢

```
/claude-obsidian:wiki-lint
```

檢查死連結、孤兒頁、frontmatter 缺漏、溯源斷裂。唯讀，不會亂改。

## 六、收工

**vault 的變更不會自己存。** 做完記得：

```bash
cd ~/Documents/fusheng-matrix
git add vault && git commit -m "docs: <這次做了什麼>" && git push
```

沒 push 就只存在你這台電腦上。

---

## 全部指令

| 指令 | 用途 | 會改 vault？ |
|------|------|:---:|
| `/claude-obsidian:wiki` | 起手式，看狀態、決定要用哪個子指令 | — |
| `/claude-obsidian:wiki-ingest` | 吃來源建筆記（檔案／貼文字／網址） | ✅ |
| `/claude-obsidian:save` | 存下對話裡的結論 | ✅ |
| `/claude-obsidian:wiki-query` | 問知識庫，附來源 | ❌ |
| `/claude-obsidian:wiki-retrieve` | 建 BM25 索引做語意搜尋 | ✅ |
| `/claude-obsidian:wiki-lint` | 健康檢查 | ❌ |
| `/claude-obsidian:autoresearch` | 上網做有引用的深度研究 | ✅ |
| `/claude-obsidian:defuddle` | 把網頁洗成乾淨 Markdown | — |
| `/claude-obsidian:canvas` | 做 Obsidian 白板、視覺地圖 | ✅ |
| `/claude-obsidian:think` | 10 階段深思流程，處理難決策 | — |
| `/claude-obsidian:wiki-fold` | 壓縮過長的 log | ✅ |
| `/claude-obsidian:wiki-mode` | 切換歸檔方法論（Generic／LYT／PARA／Zettelkasten） | ✅ |
| `/claude-obsidian:obsidian-markdown` | Obsidian 語法教學與檢查 | — |
| `/claude-obsidian:obsidian-bases` | 做 `.base` 動態表格視圖 | ✅ |
| `/claude-obsidian:wiki-cli` | 用官方 Obsidian CLI 唯讀存取 | ❌ |

會改 vault 的指令**一律先出計畫給你看、核對雜湊才動手**，不會偷改。

---

## 目錄結構

| 路徑 | 是什麼 |
|------|--------|
| `inbox/` | 你丟素材的地方 |
| `.raw/captured/` | 來源的不可變副本，用內容雜湊命名 |
| `wiki/sources/` | 每個來源一頁：涵蓋什麼、**沒涵蓋什麼** |
| `wiki/concepts/` | 概念頁，跨來源的綜合 |
| `wiki/questions/` | 待解問題，記錄目前無法確認的事 |
| `wiki/index.md` | 目錄 |
| `wiki/hot.md` | 最近脈絡，開工先看這頁 |
| `wiki/log.md` | 操作紀錄，最新在上 |
| `wiki/meta/ledgers/` | 來源帳本 + 主張帳本 |
| `.vault-meta/` | 執行期狀態（gitignore，但位址計數器有進版控） |

## 讀懂主張評估

主張帳本裡每則主張都有一個 `assessment`：

| 值 | 意思 |
|----|------|
| `accepted` | 已確立，有新鮮的、非合成的來源支持 |
| `provisional` | 暫定，證據還不夠硬 |
| `contested` | 有互相矛盾的證據，**兩邊都留著** |
| `unsupported` | 查不到證據——這是誠實的空值，不是失敗 |
| `deprecated` | 已被取代 |

高風險的主張要**兩個獨立來源**才能 accepted。同一個 `independence_key`
的來源不算互相佐證。

## Obsidian

開 Obsidian → 左下角 vault picker → Open folder as vault → 選
`~/Documents/fusheng-matrix/vault`。

## 健康檢查（不進 Claude Code）

```bash
python3 ~/.claude/plugins/cache/agricidaniel-claude-obsidian/claude-obsidian/2.1.0/scripts/claude-obsidian.py \
  doctor --vault ~/Documents/fusheng-matrix/vault
```

## 目前內容

第一批筆記來自 `解盤公式.md`（人生羅盤排盤引擎技術文件）。
四則主張中三則是 `provisional`——文件描述了實作，但程式碼本身還沒讀。
下一步見 `wiki/questions/排盤程式碼是否與技術文件一致.md`。
