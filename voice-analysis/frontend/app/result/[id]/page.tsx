"use client";

import { use, useEffect, useState } from "react";
import ResultView from "@/components/ResultView";
import type { AnalysisResult } from "@/lib/types";

export default function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = sessionStorage.getItem(`analysis:${id}`);
    if (cached) {
      setResult(JSON.parse(cached));
      return;
    }
    fetch(`/api/analyses/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).detail ?? "載入失敗");
        return res.json();
      })
      .then(setResult)
      .catch((e) => setError(e instanceof Error ? e.message : "載入失敗"));
  }, [id]);

  if (error) {
    return (
      <main className="space-y-4 pt-16 text-center">
        <p className="text-red-300">{error}</p>
        <a href="/" className="inline-block rounded-xl bg-emerald-500 px-6 py-3 font-bold text-zinc-950">
          回首頁
        </a>
      </main>
    );
  }
  if (!result) {
    return (
      <main className="pt-16 text-center text-zinc-400">
        <p className="animate-pulse">載入分析結果中…</p>
      </main>
    );
  }
  return <ResultView result={result} />;
}
