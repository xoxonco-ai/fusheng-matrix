"""Recording quality assessment.

Produces a 0–100 confidence score plus human-readable issues. When
confidence is below the configured gate, the API refuses to produce
wuxing scores rather than inventing a conclusion from bad audio.
"""
from dataclasses import dataclass, field

from .features import AcousticFeatures


@dataclass
class QualityReport:
    confidence: float               # 0-100
    ok: bool
    issues: list[str] = field(default_factory=list)
    checks: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "confidence": round(self.confidence, 1),
            "ok": self.ok,
            "issues": self.issues,
            "checks": self.checks,
        }


def assess_quality(f: AcousticFeatures, min_confidence: float = 40.0) -> QualityReport:
    issues: list[str] = []
    checks: dict = {}
    score = 100.0

    # Enough voiced material overall
    checks["voiced_sec"] = round(f.voiced_sec, 2)
    if f.voiced_sec < 1.0:
        score -= 50
        issues.append("有效發聲時間不足 1 秒")
    elif f.voiced_sec < 2.5:
        score -= 25
        issues.append("有效發聲時間偏短（建議至少 5 秒持續說話）")

    # Pitch detectability
    checks["voiced_fraction"] = round(f.voiced_fraction, 3)
    if f.voiced_fraction < 0.10:
        score -= 40
        issues.append("幾乎偵測不到音高，可能只有雜訊或音量過低")
    elif f.voiced_fraction < 0.25:
        score -= 20
        issues.append("可偵測音高比例偏低")

    # Silence
    checks["silence_ratio"] = round(f.silence_ratio, 3)
    if f.silence_ratio > 0.85:
        score -= 30
        issues.append("錄音大部分是靜音")
    elif f.silence_ratio > 0.6:
        score -= 10
        issues.append("靜音比例偏高")

    # Level: too quiet
    checks["rms_mean"] = round(f.rms_mean, 5)
    if f.rms_mean < 0.005:
        score -= 30
        issues.append("音量過低，請靠近麥克風重錄")
    elif f.rms_mean < 0.02:
        score -= 10
        issues.append("音量偏低")

    # Clipping: too loud / distorted
    checks["clipping_ratio"] = round(f.clipping_ratio, 4)
    if f.clipping_ratio > 0.05:
        score -= 30
        issues.append("音訊嚴重削波（破音），請降低音量重錄")
    elif f.clipping_ratio > 0.01:
        score -= 10
        issues.append("音訊有輕微削波")

    # Pitch statistics must exist for scoring at all
    if f.f0_median is None:
        score -= 40
        issues.append("無法建立可靠的基頻統計")

    confidence = max(0.0, min(100.0, score))
    return QualityReport(
        confidence=confidence,
        ok=confidence >= min_confidence,
        issues=issues,
        checks=checks,
    )
