"""Real acoustic feature extraction with librosa.

Every value in `AcousticFeatures` is computed from the signal — nothing is
faked or defaulted when detection fails; undetectable values are None.
"""
from dataclasses import dataclass, asdict

import librosa
import numpy as np

FRAME_LENGTH = 1024
HOP_LENGTH = 256

# Band edges (Hz) for low/mid/high energy ratios
LOW_BAND = (0.0, 300.0)
MID_BAND = (300.0, 2000.0)
HIGH_BAND = (2000.0, 8000.0)

CLIP_THRESHOLD = 0.985
PITCH_SEGMENTS = 8


@dataclass
class AcousticFeatures:
    duration_sec: float
    voiced_sec: float
    silence_ratio: float

    f0_mean: float | None
    f0_median: float | None
    f0_p05: float | None          # reliable range: 5th percentile
    f0_p95: float | None          # reliable range: 95th percentile
    f0_std: float | None
    voiced_fraction: float        # fraction of frames with detectable pitch
    pitch_slope_hz_per_sec: float | None

    rms_mean: float
    rms_std: float
    spectral_centroid_hz: float
    spectral_bandwidth_hz: float
    spectral_rolloff_hz: float
    zero_crossing_rate: float

    low_band_ratio: float
    mid_band_ratio: float
    high_band_ratio: float
    clipping_ratio: float

    pitch_contour: list[dict]     # 8 segments: {segment, t_start, t_end, f0_median}

    def to_dict(self) -> dict:
        d = asdict(self)
        return {k: (round(v, 6) if isinstance(v, float) else v) for k, v in d.items()}


def _round_contour(contour: list[dict]) -> list[dict]:
    return [
        {
            "segment": c["segment"],
            "t_start": round(c["t_start"], 3),
            "t_end": round(c["t_end"], 3),
            "f0_median": round(c["f0_median"], 2) if c["f0_median"] is not None else None,
        }
        for c in contour
    ]


def extract_features(
    y: np.ndarray,
    sr: int,
    f0_min: float = 50.0,
    f0_max: float = 500.0,
) -> AcousticFeatures:
    if y.ndim != 1:
        y = librosa.to_mono(y)
    duration = len(y) / sr
    if duration <= 0:
        raise ValueError("empty signal")

    # --- energy / voice activity -------------------------------------------
    rms = librosa.feature.rms(y=y, frame_length=FRAME_LENGTH, hop_length=HOP_LENGTH)[0]
    rms_mean = float(np.mean(rms))
    rms_std = float(np.std(rms))

    # Adaptive activity threshold: above both an absolute floor and a
    # fraction of the 95th-percentile energy, so quiet-but-clean recordings
    # still register as active.
    peak_energy = float(np.percentile(rms, 95))
    activity_thresh = max(1e-4, 0.1 * peak_energy)
    active_frames = rms > activity_thresh
    frame_sec = HOP_LENGTH / sr
    active_sec = float(np.sum(active_frames)) * frame_sec
    silence_ratio = float(np.clip(1.0 - active_sec / duration, 0.0, 1.0))

    # --- pitch (pyin: probabilistic YIN) ------------------------------------
    f0, voiced_flag, _ = librosa.pyin(
        y,
        fmin=f0_min,
        fmax=f0_max,
        sr=sr,
        frame_length=2048,
        hop_length=HOP_LENGTH,
        fill_na=np.nan,
    )
    times = librosa.times_like(f0, sr=sr, hop_length=HOP_LENGTH)
    voiced_mask = np.isfinite(f0) & (voiced_flag.astype(bool))
    voiced_f0 = f0[voiced_mask]
    voiced_times = times[voiced_mask]
    voiced_fraction = float(np.mean(voiced_mask)) if len(f0) else 0.0
    voiced_sec = float(np.sum(voiced_mask)) * frame_sec

    if len(voiced_f0) >= 5:
        f0_mean = float(np.mean(voiced_f0))
        f0_median = float(np.median(voiced_f0))
        f0_p05 = float(np.percentile(voiced_f0, 5))
        f0_p95 = float(np.percentile(voiced_f0, 95))
        f0_std = float(np.std(voiced_f0))
        # least-squares linear trend of f0 over time
        slope = float(np.polyfit(voiced_times, voiced_f0, 1)[0])
    else:
        f0_mean = f0_median = f0_p05 = f0_p95 = f0_std = slope = None

    # --- spectral shape ------------------------------------------------------
    S = np.abs(librosa.stft(y, n_fft=FRAME_LENGTH, hop_length=HOP_LENGTH))
    centroid = float(np.mean(librosa.feature.spectral_centroid(S=S, sr=sr)))
    bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(S=S, sr=sr)))
    rolloff = float(np.mean(librosa.feature.spectral_rolloff(S=S, sr=sr, roll_percent=0.85)))
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(
        y, frame_length=FRAME_LENGTH, hop_length=HOP_LENGTH)))

    # --- band energy ratios --------------------------------------------------
    freqs = librosa.fft_frequencies(sr=sr, n_fft=FRAME_LENGTH)
    power = S ** 2
    total = float(np.sum(power)) + 1e-12

    def band_ratio(lo: float, hi: float) -> float:
        mask = (freqs >= lo) & (freqs < hi)
        return float(np.sum(power[mask, :]) / total)

    low_ratio = band_ratio(*LOW_BAND)
    mid_ratio = band_ratio(*MID_BAND)
    high_ratio = band_ratio(HIGH_BAND[0], min(HIGH_BAND[1], sr / 2))

    # --- clipping -------------------------------------------------------------
    clipping_ratio = float(np.mean(np.abs(y) >= CLIP_THRESHOLD))

    # --- 8-segment pitch contour over the voiced portion ----------------------
    contour: list[dict] = []
    if len(voiced_times) >= PITCH_SEGMENTS:
        t0, t1 = float(voiced_times[0]), float(voiced_times[-1])
        edges = np.linspace(t0, t1, PITCH_SEGMENTS + 1)
        for i in range(PITCH_SEGMENTS):
            seg_mask = (voiced_times >= edges[i]) & (voiced_times <= edges[i + 1])
            seg_f0 = voiced_f0[seg_mask]
            contour.append({
                "segment": i + 1,
                "t_start": float(edges[i]),
                "t_end": float(edges[i + 1]),
                "f0_median": float(np.median(seg_f0)) if len(seg_f0) else None,
            })
    else:
        for i in range(PITCH_SEGMENTS):
            contour.append({
                "segment": i + 1,
                "t_start": duration / PITCH_SEGMENTS * i,
                "t_end": duration / PITCH_SEGMENTS * (i + 1),
                "f0_median": None,
            })

    return AcousticFeatures(
        duration_sec=float(duration),
        voiced_sec=voiced_sec,
        silence_ratio=silence_ratio,
        f0_mean=f0_mean,
        f0_median=f0_median,
        f0_p05=f0_p05,
        f0_p95=f0_p95,
        f0_std=f0_std,
        voiced_fraction=voiced_fraction,
        pitch_slope_hz_per_sec=slope,
        rms_mean=rms_mean,
        rms_std=rms_std,
        spectral_centroid_hz=centroid,
        spectral_bandwidth_hz=bandwidth,
        spectral_rolloff_hz=rolloff,
        zero_crossing_rate=zcr,
        low_band_ratio=low_ratio,
        mid_band_ratio=mid_ratio,
        high_band_ratio=high_ratio,
        clipping_ratio=clipping_ratio,
        pitch_contour=_round_contour(contour),
    )
