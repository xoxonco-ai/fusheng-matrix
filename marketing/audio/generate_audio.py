#!/usr/bin/env python3
"""
浮生靜心 音檔產生器
在「你自己的電腦」執行（本雲端環境的網路政策會封鎖 TTS 服務）。

三種聲音品質，由高到低：
  1) ElevenLabs（療癒級，最推薦）—— 設環境變數 ELEVENLABS_API_KEY
  2) OpenAI TTS（自然，好用）      —— 設環境變數 OPENAI_API_KEY
  3) gTTS（免費、免金鑰、堪用）    —— 不設任何金鑰時的預設

用法：
  python generate_audio.py 先停一下_旁白稿.txt 先停一下.mp3

段落之間會自動插入停頓（需要 pydub + ffmpeg；沒有時退化為單段合成）。
"""
import os
import sys


def read_segments(path):
    """以空行切段，讓每段之間可以插入停頓。"""
    with open(path, encoding="utf-8") as f:
        blocks = [b.strip() for b in f.read().split("\n\n")]
    return [b.replace("\n", " ") for b in blocks if b]


def tts_elevenlabs(text, api_key):
    import requests
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")  # 溫柔女聲，可換
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    r = requests.post(
        url,
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        json={"text": text, "model_id": "eleven_multilingual_v2",
              "voice_settings": {"stability": 0.6, "similarity_boost": 0.8}},
        timeout=120,
    )
    r.raise_for_status()
    return r.content


def tts_openai(text, api_key):
    import requests
    r = requests.post(
        "https://api.openai.com/v1/audio/speech",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": "gpt-4o-mini-tts", "voice": "shimmer", "input": text, "speed": 0.85},
        timeout=120,
    )
    r.raise_for_status()
    return r.content


def tts_gtts(text):
    from gtts import gTTS
    import io
    buf = io.BytesIO()
    gTTS(text=text, lang="zh-TW", slow=False).write_to_fp(buf)
    return buf.getvalue()


def pick_engine():
    if os.environ.get("ELEVENLABS_API_KEY"):
        return "elevenlabs", lambda t: tts_elevenlabs(t, os.environ["ELEVENLABS_API_KEY"])
    if os.environ.get("OPENAI_API_KEY"):
        return "openai", lambda t: tts_openai(t, os.environ["OPENAI_API_KEY"])
    return "gtts", tts_gtts


def main():
    if len(sys.argv) < 3:
        print("用法: python generate_audio.py <旁白稿.txt> <輸出.mp3>")
        sys.exit(1)
    src, out = sys.argv[1], sys.argv[2]
    engine, synth = pick_engine()
    print(f"使用引擎: {engine}")

    segments = read_segments(src)
    parts = [synth(seg) for seg in segments]
    print(f"已合成 {len(parts)} 段")

    # 嘗試用 pydub 在段落間插入 1.5 秒停頓（需 ffmpeg）
    try:
        from pydub import AudioSegment
        import io
        gap = AudioSegment.silent(duration=1500)
        combined = AudioSegment.silent(duration=300)
        for p in parts:
            combined += AudioSegment.from_file(io.BytesIO(p), format="mp3") + gap
        combined.export(out, format="mp3")
        print(f"完成（含停頓）: {out}")
    except Exception as e:
        print(f"[提示] 未插入停頓（{e}）。改為單段合成整篇。")
        with open(src, encoding="utf-8") as f:
            whole = f.read().replace("\n\n", "\n")
        with open(out, "wb") as fo:
            fo.write(synth(whole))
        print(f"完成: {out}")


if __name__ == "__main__":
    main()
