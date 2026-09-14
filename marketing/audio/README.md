# 音檔產生器｜浮生靜心

> ⚠️ 為什麼不能在雲端 session 直接生成：本環境的網路政策封鎖所有外部 TTS 服務
> （translate.google.com、api.muapi.ai、ElevenLabs、OpenAI 皆回 403）。
> 請在「你自己的電腦」執行以下步驟。

## 快速開始（免費、免金鑰）

```bash
pip install gTTS
python generate_audio.py 先停一下_旁白稿.txt 先停一下.mp3
```

幾秒後就會產生 `先停一下.mp3`。gTTS 是免費的，聲音平穩堪用，適合先聽節奏、驗證腳本。

## 想要療癒級的聲音（推薦）

設一個金鑰再跑同一支腳本即可，程式會自動選用更好的引擎：

**ElevenLabs（最推薦，多語女聲最自然）**
```bash
pip install requests
export ELEVENLABS_API_KEY=你的金鑰
# 可選：export ELEVENLABS_VOICE_ID=想要的聲音ID
python generate_audio.py 先停一下_旁白稿.txt 先停一下.mp3
```

**OpenAI TTS**
```bash
pip install requests
export OPENAI_API_KEY=你的金鑰
python generate_audio.py 先停一下_旁白稿.txt 先停一下.mp3
```

## 段落間的停頓（冥想很需要）

程式會嘗試在每段之間插入 1.5 秒靜默，這需要 `pydub` 和 `ffmpeg`：

```bash
pip install pydub
# macOS: brew install ffmpeg ｜ Windows: 到 ffmpeg.org 下載
```

沒安裝也能跑，只是退化為整篇一次合成、停頓較短。

## 另一條路：用我們建的 my-podcast App

`ai-app-templates/my-podcast`（在 xoxonco-ai-social-auto-poster repo）本身就是語音生成 App。
在本機或 Vercel 上跑起來、填 MuAPI 金鑰，貼上 `先停一下_旁白稿.txt` 的內容即可，
還有 470+ 種聲音可選。部署見該 repo 的 `docs/DEPLOY-templates.md`。

## 檔案
- `先停一下_旁白稿.txt` — 乾淨旁白稿（已移除〔停頓〕標記，空行=段落停頓）
- `generate_audio.py` — 三引擎產生器（ElevenLabs / OpenAI / gTTS 自動選擇）

其餘 7 天腳本見上層 `05_浮生靜心_7天完整引導腳本.md`，可依同法逐日轉出旁白稿再生成。
