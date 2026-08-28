"""Unit tests for real acoustic feature extraction."""
import numpy as np

from app.audio.features import extract_features
from .conftest import SR, make_voiced


def test_duration_and_voicing(voiced_signal):
    f = extract_features(voiced_signal, SR)
    assert abs(f.duration_sec - 6.0) < 0.05
    assert f.voiced_sec > 4.0
    assert f.silence_ratio < 0.3
    assert f.voiced_fraction > 0.5


def test_f0_estimation_close_to_truth(voiced_signal):
    f = extract_features(voiced_signal, SR)
    assert f.f0_median is not None
    assert abs(f.f0_median - 150.0) < 10.0
    assert abs(f.f0_mean - 150.0) < 10.0
    assert f.f0_p05 < f.f0_median < f.f0_p95
    assert f.f0_std is not None and f.f0_std < 15.0


def test_rising_pitch_slope_detected():
    y = make_voiced(duration=6.0, f0=120.0, slope=10.0)  # +10 Hz/s
    f = extract_features(y, SR)
    assert f.pitch_slope_hz_per_sec is not None
    assert 6.0 < f.pitch_slope_hz_per_sec < 14.0


def test_falling_pitch_slope_detected():
    y = make_voiced(duration=6.0, f0=200.0, slope=-8.0)
    f = extract_features(y, SR)
    assert f.pitch_slope_hz_per_sec is not None
    assert -12.0 < f.pitch_slope_hz_per_sec < -4.0


def test_silent_signal_has_no_f0(silent_signal):
    f = extract_features(silent_signal, SR)
    assert f.voiced_fraction < 0.2
    assert f.rms_mean < 0.001


def test_clipping_detected(clipped_signal):
    f = extract_features(clipped_signal, SR)
    assert f.clipping_ratio > 0.05


def test_clean_signal_not_clipped(voiced_signal):
    f = extract_features(voiced_signal, SR)
    assert f.clipping_ratio < 0.001


def test_band_ratios_sum_at_most_one(voiced_signal):
    f = extract_features(voiced_signal, SR)
    total = f.low_band_ratio + f.mid_band_ratio + f.high_band_ratio
    assert 0.5 < total <= 1.001
    # 150 Hz fundamental + harmonics ≤ 600 Hz → energy in low+mid bands
    assert f.low_band_ratio + f.mid_band_ratio > 0.8


def test_low_pitch_has_more_low_band_energy():
    low = extract_features(make_voiced(f0=100.0), SR)
    high = extract_features(make_voiced(f0=300.0), SR)
    assert low.low_band_ratio > high.low_band_ratio
    assert low.spectral_centroid_hz < high.spectral_centroid_hz


def test_pitch_contour_has_eight_segments(voiced_signal):
    f = extract_features(voiced_signal, SR)
    assert len(f.pitch_contour) == 8
    detected = [s for s in f.pitch_contour if s["f0_median"] is not None]
    assert len(detected) == 8
    for s in detected:
        assert abs(s["f0_median"] - 150.0) < 15.0
    # segments are ordered and contiguous in time
    for a, b in zip(f.pitch_contour, f.pitch_contour[1:]):
        assert a["t_end"] <= b["t_start"] + 1e-6


def test_contour_follows_rising_pitch():
    y = make_voiced(duration=8.0, f0=120.0, slope=10.0)
    f = extract_features(y, SR)
    first = f.pitch_contour[0]["f0_median"]
    last = f.pitch_contour[-1]["f0_median"]
    assert first is not None and last is not None
    assert last - first > 40.0


def test_to_dict_serializable(voiced_signal):
    import json
    f = extract_features(voiced_signal, SR)
    json.dumps(f.to_dict())
