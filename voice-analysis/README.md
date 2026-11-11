# 五行聲音分析（Voice Wuxing Analysis）MVP

手機優先的網頁應用：錄音或上傳音檔 → 後端 ffmpeg 轉檔 → 品質檢查 →
真實聲學分析（librosa）→ 透明五行加權計分 → 手機顯示結果。

> **免責聲明**：本工具將聲學特徵對應到傳統五行意象，僅供娛樂與自我探索，
> 不具醫療、心理、命理或任何專業診斷效力。

## 架構

```
voice-analysis/
├── backend/            # FastAPI + Python 3.12
│   ├── app/
│   │   ├── main.py             # API：/api/analyze、/api/analyses/{id}、/api/health
│   │   ├── config.py           # 環境變數設定（VA_ 前綴）
│   │   ├── db.py               # SQLite（只存分析結果，不存音檔）
│   │   ├── audio/
│   │   │   ├── convert.py      # ffmpeg 安全轉 mono 16kHz WAV
│   │   │   ├── features.py     # librosa 聲學特徵抽取
│   │   │   └── quality.py      # 品質檢查與信心值
│   │   └── scoring/
│   │       └── wuxing.py       # 透明五行加權計分
│   └── tests/                  # 單元測試 + API 測試（pytest）
├── frontend/           # Next.js 15 + TypeScript + Tailwind 4 + Recharts
│   ├── app/page.tsx            # 首頁：免責、暱稱、參考、錄音/上傳
│   ├── app/result/[id]/        # 結果頁
│   └── components/             # Recorder、ResultView
├── docker-compose.yml
└── .env.example
```

## 分析流程

1. **上傳驗證**：副檔名（WAV/MP3/M4A/AAC/OGG/WebM）、大小（≤25MB）、
   ffprobe 長度（3–120 秒）。
2. **安全轉檔**：ffmpeg 以固定參數列表（無 shell）轉 mono 16kHz PCM WAV，
   去除 video/metadata、限制輸出長度、60 秒逾時。
3. **聲學特徵**（全部真實計算，偵測不到就是 `null`）：
   總長度、有效發聲時間、靜音比例、pyin 基頻（平均/中位數/P5–P95 可靠範圍/標準差）、
   可偵測音高比例、音高趨勢斜率（最小平方法）、RMS 能量、頻譜重心/頻寬/rolloff、
   zero crossing rate、低中高頻能量比例、削波比例、八段音高走勢。
4. **品質閘門**：發聲時間、音高可偵測度、靜音、音量、削波各項扣分，
   得出 0–100 信心值。**低於 `VA_MIN_CONFIDENCE`（預設 40）不產生五行結論**。
5. **五行計分**：見下。
6. **刪除音檔**：預設分析完成即刪除原始上傳與轉檔結果（`VA_KEEP_AUDIO=false`）。

## 五行計分規則（完全透明）

每個元素分數 = `100 × Σ(權重 × 正規化數值)`。正規化為區間內線性映射並截斷
（`invert` 表示數值越低分越高）。缺少的特徵會被剔除並按剩餘權重換算；
若可用權重 < 50%，該元素回報「資料不足」而非硬給分數。

| 元素 | 特徵 | 權重 | 方向 |
|------|------|------|------|
| 木（上揚、伸展） | 音高趨勢斜率 / 基頻可靠範圍寬度 / 頻譜頻寬 | 40/35/25 | 正 |
| 火（明亮、能量） | 頻譜重心 / 高頻能量比例 / RMS 能量 | 40/30/30 | 正 |
| 土（沉穩）      | 基頻標準差 / 能量變異係數 / 靜音比例 | 40/30/30 | 反 |
| 金（清晰）      | 可偵測音高比例 / spectral rolloff / ZCR | 40/30/30 | 正 |
| 水（低沉、流動） | 基頻中位數（反）/ 低頻能量比例 / 斜率平緩度（反） | 40/35/25 | 混合 |

**聲學參考**只影響基頻類特徵的正規化區間：
男性 85–180 Hz、女性 160–260 Hz、中性 110–230 Hz、不指定 80–260 Hz。

每項分數在前端可展開查看：原始數值、正規化數值、權重、分數貢獻。

## 本機開發

需求：Python 3.12、Node 18+、ffmpeg。

```bash
# 後端
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000

# 測試（38 個單元 + API 測試）
.venv/bin/python -m pytest tests/ -v

# 前端
cd ../frontend
npm install
npm run dev   # http://localhost:3000（/api/* 會轉發到 :8000）
```

手機錄音需要 HTTPS 或 localhost（瀏覽器限制）。區網手機測試可用
`npx next dev -H 0.0.0.0` 搭配自簽憑證或 tunnel（如 cloudflared）。

## Docker

```bash
cp .env.example .env   # 視需要調整
docker compose up --build
# 前端 http://localhost:3000，後端 http://localhost:8000/docs
```

## API

- `POST /api/analyze` — multipart：`file`（音檔）、`nickname`、
  `reference`（male/female/neutral/unspecified）。回傳完整分析 JSON。
- `GET /api/analyses/{id}` — 讀取已存分析結果。
- `GET /api/health` — 健康檢查。

## 隱私

- 原始錄音與轉檔 WAV 預設在分析完成後**立即刪除**。
- SQLite 只保存暱稱、參考選項與計算出的數值結果。

## 本版不包含

會員系統、付款、複雜權限、LLM 文案生成、長期保存錄音、完整管理員後台。
