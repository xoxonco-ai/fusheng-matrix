"use client";

import { useState } from "react";
import {
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalysisResult, BreakdownItem } from "@/lib/types";
import { ELEMENT_META, ELEMENT_ORDER } from "@/lib/types";

function fmt(v: number | null | undefined, digits = 2, unit = ""): string {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(digits)}${unit}`;
}

function ConfidenceBadge({ value, ok }: { value: number; ok: boolean }) {
  const color = ok
    ? value >= 75
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
      : "bg-amber-500/15 text-amber-300 border-amber-500/40"
    : "bg-red-500/15 text-red-300 border-red-500/40";
  return (
    <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${color}`}>
      錄音品質信心值 {value.toFixed(0)} / 100
    </span>
  );
}

function BreakdownRow({ item }: { item: BreakdownItem }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-zinc-900/80 p-3 text-xs">
      <p className="col-span-2 font-semibold text-zinc-200">
        {item.label}
        {item.invert && <span className="ml-1 text-zinc-500">（反向：數值越低分越高）</span>}
      </p>
      <p className="text-zinc-500">原始數值</p>
      <p className="text-right font-mono">{item.raw === null ? "無法偵測" : item.raw}</p>
      <p className="text-zinc-500">正規化（{item.range[0]}–{item.range[1]}）</p>
      <p className="text-right font-mono">{fmt(item.normalized, 3)}</p>
      <p className="text-zinc-500">權重</p>
      <p className="text-right font-mono">{(item.weight * 100).toFixed(0)}%</p>
      <p className="text-zinc-500">分數貢獻</p>
      <p className="text-right font-mono">
        {item.contribution === null ? "—" : `+${item.contribution.toFixed(1)}`}
      </p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-zinc-800 py-1.5 last:border-0">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-200">{value}</span>
    </div>
  );
}

export default function ResultView({ result }: { result: AnalysisResult }) {
  const [open, setOpen] = useState<string | null>(null);
  const { features: f, quality, scores } = result;

  // primary/secondary can be null even with scores present (not enough
  // scorable elements) — treat that the same as insufficient quality.
  const primary = scores?.primary ?? null;
  const secondary = scores?.secondary ?? null;
  const hasConclusion =
    result.status === "completed" && scores !== null && primary !== null && secondary !== null;

  const radarData = scores
    ? ELEMENT_ORDER.map((k) => ({
        element: `${ELEMENT_META[k].zh}`,
        score: scores.elements[k]?.score ?? 0,
      }))
    : [];

  const contourData = f.pitch_contour.map((s) => ({
    segment: `${s.segment}`,
    f0: s.f0_median,
  }));

  return (
    <main className="space-y-6 pt-8">
      <header className="space-y-3 text-center">
        <h1 className="text-2xl font-bold">{result.nickname} 的聲音分析</h1>
        <ConfidenceBadge value={quality.confidence} ok={quality.ok} />
      </header>

      {quality.issues.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <p className="mb-1 font-semibold">品質提醒</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs">
            {quality.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      )}

      {!hasConclusion || !scores || !primary || !secondary ? (
        <section className="space-y-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-center">
          <p className="text-lg font-bold text-red-300">音訊品質不足，無法給出五行結論</p>
          <p className="text-sm text-zinc-300">
            為了誠實呈現，品質不足時我們不會硬產生結果。請參考上方提醒重新錄一段。
          </p>
          <a
            href="/"
            className="inline-block rounded-xl bg-emerald-500 px-6 py-3 font-bold text-zinc-950"
          >
            重新錄音
          </a>
        </section>
      ) : (
        <>
          <section className="rounded-xl bg-zinc-900 p-4 text-center">
            <p className="text-sm text-zinc-400">主型</p>
            <p className="text-4xl font-bold" style={{ color: ELEMENT_META[primary]?.color }}>
              {scores.primary_zh}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {ELEMENT_META[primary]?.blurb}
            </p>
            <p className="mt-3 text-sm text-zinc-400">
              輔型：
              <span className="font-semibold" style={{ color: ELEMENT_META[secondary]?.color }}>
                {scores.secondary_zh}
              </span>
              <span className="ml-1 text-xs text-zinc-500">
                {ELEMENT_META[secondary]?.blurb}
              </span>
            </p>
          </section>

          <section className="rounded-xl bg-zinc-900 p-2">
            <h2 className="px-2 pt-2 text-sm font-semibold text-zinc-300">五行雷達圖</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="70%">
                  <PolarGrid stroke="#3f3f46" />
                  <PolarAngleAxis dataKey="element" tick={{ fill: "#d4d4d8", fontSize: 16 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke="#34d399" fill="#34d399" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="space-y-3 rounded-xl bg-zinc-900 p-4">
            <h2 className="text-sm font-semibold text-zinc-300">
              五行分數（點擊展開計分明細）
            </h2>
            {ELEMENT_ORDER.map((k) => {
              const el = scores.elements[k];
              if (!el) return null;
              const meta = ELEMENT_META[k];
              const expanded = open === k;
              return (
                <div key={k}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : k)}
                    className="w-full"
                  >
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-semibold" style={{ color: meta.color }}>
                        {meta.zh}
                        <span className="ml-2 text-xs font-normal text-zinc-500">{meta.blurb}</span>
                      </span>
                      <span className="font-mono text-zinc-200">
                        {el.score === null ? "資料不足" : el.score.toFixed(1)} {expanded ? "▲" : "▼"}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${el.score ?? 0}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>
                  </button>
                  {expanded && (
                    <div className="mt-2 space-y-2">
                      {el.breakdown.map((b) => (
                        <BreakdownRow key={b.feature} item={b} />
                      ))}
                      {el.available_weight < 1 && (
                        <p className="text-xs text-zinc-500">
                          可用權重 {(el.available_weight * 100).toFixed(0)}%，分數已按可用權重換算。
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}

      <section className="rounded-xl bg-zinc-900 p-2">
        <h2 className="px-2 pt-2 text-sm font-semibold text-zinc-300">
          音高走勢（有效錄音分為八段，Hz）
        </h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={contourData} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}>
              <XAxis dataKey="segment" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <YAxis
                domain={["dataMin - 15", "dataMax + 15"]}
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }}
                formatter={(v) => [`${Number(v).toFixed(1)} Hz`, "基頻中位數"]}
              />
              <Line
                dataKey="f0"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl bg-zinc-900 p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">聲學資料卡</h2>
        <StatRow label="音檔總長度" value={fmt(f.duration_sec, 2, " 秒")} />
        <StatRow label="有效發聲時間" value={fmt(f.voiced_sec, 2, " 秒")} />
        <StatRow label="靜音比例" value={fmt(f.silence_ratio * 100, 1, "%")} />
        <StatRow label="平均基頻" value={fmt(f.f0_mean, 1, " Hz")} />
        <StatRow label="基頻中位數" value={fmt(f.f0_median, 1, " Hz")} />
        <StatRow
          label="基頻可靠範圍 (P5–P95)"
          value={
            f.f0_p05 !== null && f.f0_p95 !== null
              ? `${f.f0_p05.toFixed(0)}–${f.f0_p95.toFixed(0)} Hz`
              : "—"
          }
        />
        <StatRow label="基頻標準差" value={fmt(f.f0_std, 1, " Hz")} />
        <StatRow label="可偵測音高比例" value={fmt(f.voiced_fraction * 100, 1, "%")} />
        <StatRow label="音高趨勢斜率" value={fmt(f.pitch_slope_hz_per_sec, 2, " Hz/秒")} />
        <StatRow label="RMS 能量" value={fmt(f.rms_mean, 4)} />
        <StatRow label="頻譜重心" value={fmt(f.spectral_centroid_hz, 0, " Hz")} />
        <StatRow label="頻譜頻寬" value={fmt(f.spectral_bandwidth_hz, 0, " Hz")} />
        <StatRow label="Spectral rolloff" value={fmt(f.spectral_rolloff_hz, 0, " Hz")} />
        <StatRow label="Zero crossing rate" value={fmt(f.zero_crossing_rate, 4)} />
        <StatRow label="低頻能量比例 (<300Hz)" value={fmt(f.low_band_ratio * 100, 1, "%")} />
        <StatRow label="中頻能量比例 (300–2kHz)" value={fmt(f.mid_band_ratio * 100, 1, "%")} />
        <StatRow label="高頻能量比例 (>2kHz)" value={fmt(f.high_band_ratio * 100, 1, "%")} />
        <StatRow label="削波比例" value={fmt(f.clipping_ratio * 100, 2, "%")} />
      </section>

      <p className="text-center text-xs text-zinc-600">
        僅供娛樂與自我探索，不具任何專業診斷效力。原始錄音已於分析後刪除。
      </p>

      <a
        href="/"
        className="block w-full rounded-xl border border-zinc-700 py-3 text-center font-semibold text-zinc-300"
      >
        再測一次
      </a>
    </main>
  );
}
