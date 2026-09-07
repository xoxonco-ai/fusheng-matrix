"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Recorder from "@/components/Recorder";
import type { Reference } from "@/lib/types";

const REFERENCES: { value: Reference; label: string; hint: string }[] = [
  { value: "male", label: "男性參考", hint: "約 85–180 Hz" },
  { value: "female", label: "女性參考", hint: "約 160–260 Hz" },
  { value: "neutral", label: "中性參考", hint: "約 110–230 Hz" },
  { value: "unspecified", label: "不指定", hint: "使用通用音域" },
];

export default function Home() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [reference, setReference] = useState<Reference>("unspecified");
  const [audio, setAudio] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = nickname.trim().length > 0 && audio !== null && !submitting;

  const submit = async () => {
    if (!canSubmit || !audio) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", audio);
      form.append("nickname", nickname.trim());
      form.append("reference", reference);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.detail ?? `分析失敗（${res.status}）`);
      }
      sessionStorage.setItem(`analysis:${body.id}`, JSON.stringify(body));
      router.push(`/result/${body.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上傳失敗，請再試一次");
      setSubmitting(false);
    }
  };

  return (
    <main className="space-y-6 pt-8">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-wide">五行聲音分析</h1>
        <p className="text-sm text-zinc-400">
          錄一段聲音，用真實聲學特徵看看你的木・火・土・金・水
        </p>
      </header>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200/90">
        <strong>免責聲明：</strong>
        本工具以聲學特徵（基頻、能量、頻譜等）搭配透明的加權規則，將聲音對應到傳統五行意象，
        僅供娛樂與自我探索參考，<strong>不具醫療、心理、命理或任何專業診斷效力</strong>。
        錄音僅用於當次分析，分析完成後預設立即刪除原始音檔。
      </section>

      <section className="space-y-2">
        <label htmlFor="nickname" className="block text-sm font-medium text-zinc-300">
          名稱或暱稱
        </label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={50}
          placeholder="例如：小明"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base outline-none focus:border-zinc-400"
        />
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium text-zinc-300">聲學參考</p>
        <p className="text-xs text-zinc-500">
          影響基頻（音高）的正規化範圍，讓分數更貼近你的音域。
        </p>
        <div className="grid grid-cols-2 gap-2">
          {REFERENCES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReference(r.value)}
              className={`rounded-xl border px-3 py-3 text-left ${
                reference === r.value
                  ? "border-emerald-400 bg-emerald-400/10"
                  : "border-zinc-700 bg-zinc-900"
              }`}
            >
              <span className="block text-sm font-semibold">{r.label}</span>
              <span className="block text-xs text-zinc-500">{r.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium text-zinc-300">錄音或上傳</p>
        <Recorder onAudio={setAudio} />
      </section>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="w-full rounded-xl bg-emerald-500 py-4 text-lg font-bold text-zinc-950 disabled:opacity-40"
      >
        {submitting ? "分析中，約需 5–20 秒…" : "開始分析"}
      </button>
    </main>
  );
}
