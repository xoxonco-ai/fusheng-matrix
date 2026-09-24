# Skills

本專案**不再自帶** skill 檔案。

## 移除了什麼

先前這個 repo 裡有兩份東西：

| 路徑 | 內容 |
|---|---|
| `.agents/skills/` | 83 個 skill 的實體檔案，約 3.8 MB |
| `.claude/skills/` | 83 個 symlink，指向上面那個目錄 |
| `skills-lock.json` | 記錄那 83 個的來源與雜湊值 |

`.agents/skills/` 是 [`xoxonco-ai/my-frist-project`](https://github.com/xoxonco-ai/my-frist-project)
的完整複本 —— `skills-lock.json` 裡 83 筆記錄的 `source` 全部指向該 repo。
同一套 skill 在兩個 repo 各存一份，更新時得兩邊各做一次，
Claude 啟動時也會從兩處各載入一次而出現重複。

## 現在怎麼取得這些 skill

改用外掛市集安裝 —— 全域可用、只存一份、單指令更新。在 Claude Code 對話中執行：

    /plugin marketplace add xoxonco-ai/my-frist-project
    /plugin install marketing-skills

裝好之後，`cro`、`copywriting`、`ads` 等 83 個 skill 在**任何**專案裡都叫得到，
包含本專案在內，不需要再往這裡放副本。

## 更新

    /plugin

切到 **Installed** 分頁即可更新或移除。
