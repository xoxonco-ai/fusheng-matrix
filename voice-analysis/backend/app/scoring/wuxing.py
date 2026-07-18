"""Transparent five-element (五行) weighted scoring.

Each element's score is a weighted sum of normalized acoustic features:

    score = 100 * Σ_i  weight_i * normalize(raw_i)

`normalize` is a clamped linear ramp between (lo, hi); `invert=True` flips
it (lower raw value → higher normalized value). Every component's raw
value, normalized value, weight and contribution is returned so the UI can
show exactly how each score was produced. This is a heuristic mapping from
voice acoustics to traditional element imagery — not a medical or
scientific diagnosis.

Reference profiles (male/female/neutral/unspecified) only change the
normalization ranges for F0-based features, since typical pitch differs
by voice type.
"""
from dataclasses import dataclass

from ..audio.features import AcousticFeatures

REFERENCES = ("male", "female", "neutral", "unspecified")

# F0 normalization ranges (Hz) per reference profile: (low, high) covering
# the typical speaking range for that voice type.
F0_RANGES: dict[str, tuple[float, float]] = {
    "male": (85.0, 180.0),
    "female": (160.0, 260.0),
    "neutral": (110.0, 230.0),
    "unspecified": (80.0, 260.0),
}


@dataclass(frozen=True)
class Component:
    feature: str          # attribute name on AcousticFeatures
    label: str            # human-readable label (zh-TW)
    lo: float
    hi: float
    weight: float
    invert: bool = False


def _f0_components(ref: str) -> dict[str, tuple[float, float]]:
    lo, hi = F0_RANGES.get(ref, F0_RANGES["unspecified"])
    span = hi - lo
    return {
        "f0": (lo, hi),
        # variability ranges scale with the profile's span
        "f0_std_low": (5.0, 0.22 * span + 5.0),
        "f0_range": (10.0, 0.9 * span),
    }


def build_element_specs(reference: str) -> dict[str, list[Component]]:
    """Element → weighted feature components for the given reference."""
    r = _f0_components(reference)
    f0_lo, f0_hi = r["f0"]
    std_lo, std_hi = r["f0_std_low"]
    rng_lo, rng_hi = r["f0_range"]

    return {
        # 木 growth & rise: rising pitch trend, wide pitch range, broad spectrum
        "wood": [
            Component("pitch_slope_hz_per_sec", "音高趨勢斜率", -8.0, 8.0, 0.40),
            Component("f0_range_hz", "基頻可靠範圍寬度", rng_lo, rng_hi, 0.35),
            Component("spectral_bandwidth_hz", "頻譜頻寬", 1200.0, 2600.0, 0.25),
        ],
        # 火 brightness & energy: bright spectrum, high-band energy, strong level
        "fire": [
            Component("spectral_centroid_hz", "頻譜重心", 800.0, 2800.0, 0.40),
            Component("high_band_ratio", "高頻能量比例", 0.02, 0.30, 0.30),
            Component("rms_mean", "RMS 能量", 0.01, 0.12, 0.30),
        ],
        # 土 stability: steady pitch, steady loudness, little silence
        "earth": [
            Component("f0_std", "基頻標準差", std_lo, std_hi, 0.40, invert=True),
            Component("rms_cv", "能量起伏（變異係數）", 0.35, 1.1, 0.30, invert=True),
            Component("silence_ratio", "靜音比例", 0.15, 0.7, 0.30, invert=True),
        ],
        # 金 clarity & definition: clear pitch detection, defined rolloff, crisp zcr
        "metal": [
            Component("voiced_fraction", "可偵測音高比例", 0.25, 0.85, 0.40),
            Component("spectral_rolloff_hz", "Spectral rolloff", 1500.0, 4500.0, 0.30),
            Component("zero_crossing_rate", "Zero crossing rate", 0.03, 0.15, 0.30),
        ],
        # 水 depth & flow: low pitch (relative to reference), low-band energy,
        # gentle pitch movement
        "water": [
            Component("f0_median", "基頻中位數", f0_lo, f0_hi, 0.40, invert=True),
            Component("low_band_ratio", "低頻能量比例", 0.15, 0.65, 0.35),
            Component("pitch_slope_abs", "音高趨勢平緩度", 0.0, 10.0, 0.25, invert=True),
        ],
    }


ELEMENT_NAMES_ZH = {
    "wood": "木", "fire": "火", "earth": "土", "metal": "金", "water": "水",
}


def _derived_values(f: AcousticFeatures) -> dict[str, float | None]:
    """Feature name → raw value, including derived helper features."""
    values: dict[str, float | None] = {
        "pitch_slope_hz_per_sec": f.pitch_slope_hz_per_sec,
        "spectral_bandwidth_hz": f.spectral_bandwidth_hz,
        "spectral_centroid_hz": f.spectral_centroid_hz,
        "spectral_rolloff_hz": f.spectral_rolloff_hz,
        "high_band_ratio": f.high_band_ratio,
        "low_band_ratio": f.low_band_ratio,
        "rms_mean": f.rms_mean,
        "f0_std": f.f0_std,
        "f0_median": f.f0_median,
        "silence_ratio": f.silence_ratio,
        "voiced_fraction": f.voiced_fraction,
        "zero_crossing_rate": f.zero_crossing_rate,
    }
    values["f0_range_hz"] = (
        f.f0_p95 - f.f0_p05 if f.f0_p95 is not None and f.f0_p05 is not None else None
    )
    values["pitch_slope_abs"] = (
        abs(f.pitch_slope_hz_per_sec) if f.pitch_slope_hz_per_sec is not None else None
    )
    values["rms_cv"] = f.rms_std / f.rms_mean if f.rms_mean > 1e-9 else None
    return values


def normalize(raw: float, lo: float, hi: float, invert: bool) -> float:
    if hi <= lo:
        raise ValueError("invalid normalization range")
    n = (raw - lo) / (hi - lo)
    n = max(0.0, min(1.0, n))
    return 1.0 - n if invert else n


def score_wuxing(f: AcousticFeatures, reference: str = "unspecified") -> dict:
    """Return the full transparent scoring result.

    Components whose raw value is unavailable (None) are dropped and the
    remaining weights are re-normalized, so a score is never invented from
    missing data. If an element loses more than half its weight, its score
    is None.
    """
    if reference not in REFERENCES:
        reference = "unspecified"
    specs = build_element_specs(reference)
    values = _derived_values(f)

    elements: dict[str, dict] = {}
    for element, components in specs.items():
        breakdown = []
        available_weight = 0.0
        weighted_sum = 0.0
        for c in components:
            raw = values.get(c.feature)
            if raw is None:
                breakdown.append({
                    "feature": c.feature, "label": c.label,
                    "raw": None, "normalized": None,
                    "weight": c.weight, "contribution": None,
                    "range": [c.lo, c.hi], "invert": c.invert,
                })
                continue
            n = normalize(float(raw), c.lo, c.hi, c.invert)
            available_weight += c.weight
            weighted_sum += c.weight * n
            breakdown.append({
                "feature": c.feature, "label": c.label,
                "raw": round(float(raw), 4), "normalized": round(n, 4),
                "weight": c.weight, "contribution": round(100 * c.weight * n, 2),
                "range": [c.lo, c.hi], "invert": c.invert,
            })
        if available_weight >= 0.5:
            score = round(100.0 * weighted_sum / available_weight, 1)
        else:
            score = None
        elements[element] = {
            "name_zh": ELEMENT_NAMES_ZH[element],
            "score": score,
            "available_weight": round(available_weight, 3),
            "breakdown": breakdown,
        }

    scored = {k: v["score"] for k, v in elements.items() if v["score"] is not None}
    if len(scored) >= 2:
        ranked = sorted(scored, key=lambda k: scored[k], reverse=True)
        primary, secondary = ranked[0], ranked[1]
    else:
        primary = secondary = None

    return {
        "reference": reference,
        "elements": elements,
        "primary": primary,
        "primary_zh": ELEMENT_NAMES_ZH.get(primary) if primary else None,
        "secondary": secondary,
        "secondary_zh": ELEMENT_NAMES_ZH.get(secondary) if secondary else None,
    }
