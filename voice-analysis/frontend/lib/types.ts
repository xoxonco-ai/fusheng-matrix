export type Reference = "male" | "female" | "neutral" | "unspecified";

export interface PitchSegment {
  segment: number;
  t_start: number;
  t_end: number;
  f0_median: number | null;
}

export interface Features {
  duration_sec: number;
  voiced_sec: number;
  silence_ratio: number;
  f0_mean: number | null;
  f0_median: number | null;
  f0_p05: number | null;
  f0_p95: number | null;
  f0_std: number | null;
  voiced_fraction: number;
  pitch_slope_hz_per_sec: number | null;
  rms_mean: number;
  rms_std: number;
  spectral_centroid_hz: number;
  spectral_bandwidth_hz: number;
  spectral_rolloff_hz: number;
  zero_crossing_rate: number;
  low_band_ratio: number;
  mid_band_ratio: number;
  high_band_ratio: number;
  clipping_ratio: number;
  pitch_contour: PitchSegment[];
}

export interface Quality {
  confidence: number;
  ok: boolean;
  issues: string[];
  checks: Record<string, number>;
}

export interface BreakdownItem {
  feature: string;
  label: string;
  raw: number | null;
  normalized: number | null;
  weight: number;
  contribution: number | null;
  range: [number, number];
  invert: boolean;
}

export interface ElementResult {
  name_zh: string;
  score: number | null;
  available_weight: number;
  breakdown: BreakdownItem[];
}

export interface Scores {
  reference: Reference;
  elements: Record<string, ElementResult>;
  primary: string | null;
  primary_zh: string | null;
  secondary: string | null;
  secondary_zh: string | null;
}

export interface AnalysisResult {
  id: string;
  nickname: string;
  reference: Reference;
  status: "completed" | "insufficient_quality";
  features: Features;
  quality: Quality;
  scores: Scores | null;
}

export const ELEMENT_ORDER = ["wood", "fire", "earth", "metal", "water"] as const;

export const ELEMENT_META: Record<
  string,
  { zh: string; color: string; blurb: string }
> = {
  wood: { zh: "木", color: "#4ade80", blurb: "上揚、伸展、富變化" },
  fire: { zh: "火", color: "#f87171", blurb: "明亮、高能量、外放" },
  earth: { zh: "土", color: "#fbbf24", blurb: "沉穩、持續、少起伏" },
  metal: { zh: "金", color: "#e2e8f0", blurb: "清晰、乾脆、界線分明" },
  water: { zh: "水", color: "#60a5fa", blurb: "低沉、流動、平緩" },
};
