"""Unit tests for quality gate and transparent wuxing scoring."""
import pytest

from app.audio.features import AcousticFeatures
from app.audio.quality import assess_quality
from app.scoring.wuxing import (
    REFERENCES,
    build_element_specs,
    normalize,
    score_wuxing,
)


def features(**overrides) -> AcousticFeatures:
    base = dict(
        duration_sec=8.0, voiced_sec=6.0, silence_ratio=0.2,
        f0_mean=150.0, f0_median=148.0, f0_p05=120.0, f0_p95=180.0,
        f0_std=18.0, voiced_fraction=0.7, pitch_slope_hz_per_sec=1.5,
        rms_mean=0.06, rms_std=0.03,
        spectral_centroid_hz=1500.0, spectral_bandwidth_hz=1800.0,
        spectral_rolloff_hz=3000.0, zero_crossing_rate=0.08,
        low_band_ratio=0.4, mid_band_ratio=0.45, high_band_ratio=0.15,
        clipping_ratio=0.0,
        pitch_contour=[{"segment": i + 1, "t_start": i, "t_end": i + 1,
                        "f0_median": 150.0} for i in range(8)],
    )
    base.update(overrides)
    return AcousticFeatures(**base)


# ---- normalize ---------------------------------------------------------------

def test_normalize_clamps_and_inverts():
    assert normalize(5.0, 0.0, 10.0, invert=False) == 0.5
    assert normalize(-1.0, 0.0, 10.0, invert=False) == 0.0
    assert normalize(99.0, 0.0, 10.0, invert=False) == 1.0
    assert normalize(0.0, 0.0, 10.0, invert=True) == 1.0
    with pytest.raises(ValueError):
        normalize(1.0, 5.0, 5.0, invert=False)


# ---- element spec invariants ---------------------------------------------------

@pytest.mark.parametrize("reference", REFERENCES)
def test_weights_sum_to_one_per_element(reference):
    for element, comps in build_element_specs(reference).items():
        assert abs(sum(c.weight for c in comps) - 1.0) < 1e-9, element
        for c in comps:
            assert c.hi > c.lo, (element, c.feature)


# ---- scoring -----------------------------------------------------------------

def test_scores_in_range_with_full_breakdown():
    result = score_wuxing(features(), "male")
    assert set(result["elements"]) == {"wood", "fire", "earth", "metal", "water"}
    for el in result["elements"].values():
        assert 0.0 <= el["score"] <= 100.0
        contribs = [b["contribution"] for b in el["breakdown"]]
        assert all(c is not None for c in contribs)
        # score equals sum of contributions (weights fully available)
        assert abs(el["score"] - sum(contribs)) < 0.11
        for b in el["breakdown"]:
            assert {"feature", "label", "raw", "normalized",
                    "weight", "contribution", "range", "invert"} <= set(b)
            assert 0.0 <= b["normalized"] <= 1.0
    assert result["primary"] in result["elements"]
    assert result["secondary"] in result["elements"]
    assert result["primary"] != result["secondary"]
    assert result["elements"][result["primary"]]["score"] >= \
        result["elements"][result["secondary"]]["score"]


def test_low_pitch_scores_higher_water():
    low = score_wuxing(features(f0_median=95.0, low_band_ratio=0.6), "male")
    high = score_wuxing(features(f0_median=175.0, low_band_ratio=0.25), "male")
    assert low["elements"]["water"]["score"] > high["elements"]["water"]["score"]


def test_rising_slope_scores_higher_wood():
    rising = score_wuxing(features(pitch_slope_hz_per_sec=6.0))
    falling = score_wuxing(features(pitch_slope_hz_per_sec=-6.0))
    assert rising["elements"]["wood"]["score"] > falling["elements"]["wood"]["score"]


def test_bright_energetic_voice_scores_higher_fire():
    bright = score_wuxing(features(spectral_centroid_hz=2600.0,
                                   high_band_ratio=0.28, rms_mean=0.11))
    dull = score_wuxing(features(spectral_centroid_hz=900.0,
                                 high_band_ratio=0.03, rms_mean=0.02))
    assert bright["elements"]["fire"]["score"] > dull["elements"]["fire"]["score"]


def test_steady_voice_scores_higher_earth():
    steady = score_wuxing(features(f0_std=6.0, silence_ratio=0.1))
    shaky = score_wuxing(features(f0_std=40.0, silence_ratio=0.6))
    assert steady["elements"]["earth"]["score"] > shaky["elements"]["earth"]["score"]


def test_reference_changes_f0_normalization():
    f = features(f0_median=150.0)
    as_male = score_wuxing(f, "male")     # 150 is high for male → low water f0 component
    as_female = score_wuxing(f, "female")  # 150 is low for female → high water f0 component
    male_f0 = next(b for b in as_male["elements"]["water"]["breakdown"]
                   if b["feature"] == "f0_median")
    female_f0 = next(b for b in as_female["elements"]["water"]["breakdown"]
                     if b["feature"] == "f0_median")
    assert female_f0["normalized"] > male_f0["normalized"]


def test_missing_f0_drops_components_without_faking():
    f = features(f0_mean=None, f0_median=None, f0_p05=None, f0_p95=None,
                 f0_std=None, pitch_slope_hz_per_sec=None)
    result = score_wuxing(f)
    water = result["elements"]["water"]
    f0_comp = next(b for b in water["breakdown"] if b["feature"] == "f0_median")
    assert f0_comp["raw"] is None and f0_comp["contribution"] is None
    # wood loses slope (0.40) + range (0.35) → only 0.25 weight left → no score
    assert result["elements"]["wood"]["score"] is None


def test_invalid_reference_falls_back():
    result = score_wuxing(features(), "alien")
    assert result["reference"] == "unspecified"


# ---- quality gate ---------------------------------------------------------------

def test_good_audio_passes_quality():
    q = assess_quality(features())
    assert q.ok
    assert q.confidence >= 80.0
    assert q.issues == []


def test_silent_audio_fails_quality():
    f = features(voiced_sec=0.3, voiced_fraction=0.05, silence_ratio=0.95,
                 rms_mean=0.001, f0_median=None)
    q = assess_quality(f)
    assert not q.ok
    assert q.confidence < 40.0
    assert len(q.issues) >= 3


def test_clipped_audio_penalized():
    good = assess_quality(features())
    bad = assess_quality(features(clipping_ratio=0.2))
    assert bad.confidence < good.confidence
    assert any("削波" in i for i in bad.issues)
