"use client";

import { useEffect, useRef, useState } from "react";

const MAX_SEC = 60;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function extFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export default function Recorder({
  onAudio,
}: {
  onAudio: (file: File | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const reset = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setFileName(null);
    setSeconds(0);
    onAudio(null);
  };

  const stop = () => {
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  const start = async () => {
    setError(null);
    reset();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mime = pickMimeType();
      const rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const name = `recording.${extFor(type)}`;
        const file = new File([blob], name, { type });
        setBlobUrl(URL.createObjectURL(blob));
        setFileName(name);
        onAudio(file);
      };
      recorderRef.current = rec;
      rec.start(250);
      setRecording(true);
      secondsRef.current = 0;
      setSeconds(0);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_SEC) stop();
      }, 1000);
    } catch {
      setError("無法使用麥克風，請確認瀏覽器權限，或改用檔案上傳。");
    }
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(URL.createObjectURL(f));
    setFileName(f.name);
    setSeconds(0);
    onAudio(f);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {!recording ? (
          <button
            type="button"
            onClick={start}
            className="flex-1 rounded-xl bg-red-500/90 py-3 text-lg font-semibold text-white active:scale-95"
          >
            {blobUrl ? "🎙️ 重新錄音" : "🎙️ 開始錄音"}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="flex-1 animate-pulse rounded-xl bg-red-600 py-3 text-lg font-semibold text-white"
          >
            ⏹ 停止（{seconds}s / {MAX_SEC}s）
          </button>
        )}
        <label className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-zinc-600 py-3 text-lg font-semibold">
          📁 上傳音檔
          <input
            type="file"
            accept=".wav,.mp3,.m4a,.aac,.ogg,.webm,audio/*"
            className="hidden"
            onChange={onUpload}
          />
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        建議：在安靜環境用平常語氣連續說話 10–30 秒（自我介紹、唸一段文字都可以）。
        支援 WAV / MP3 / M4A / AAC / OGG，最長 120 秒。
      </p>
      {error && <p className="text-sm text-amber-400">{error}</p>}
      {blobUrl && (
        <div className="space-y-2 rounded-xl bg-zinc-800/60 p-3">
          <p className="truncate text-sm text-zinc-300">✅ {fileName}</p>
          <audio src={blobUrl} controls className="w-full" />
          <button
            type="button"
            onClick={reset}
            className="text-sm text-zinc-400 underline"
          >
            清除並重來
          </button>
        </div>
      )}
    </div>
  );
}
