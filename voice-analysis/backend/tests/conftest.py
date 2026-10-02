"""Shared fixtures: synthetic voice-like signals with known properties."""
import numpy as np
import pytest

SR = 16000


def make_voiced(
    duration: float = 6.0,
    f0: float = 150.0,
    sr: int = SR,
    amplitude: float = 0.3,
    slope: float = 0.0,
    vibrato_hz: float = 5.0,
    vibrato_depth: float = 3.0,
) -> np.ndarray:
    """Harmonic-rich tone that pyin detects as voiced speech-like signal."""
    t = np.arange(int(duration * sr)) / sr
    inst_f0 = f0 + slope * t + vibrato_depth * np.sin(2 * np.pi * vibrato_hz * t)
    phase = 2 * np.pi * np.cumsum(inst_f0) / sr
    y = np.zeros_like(t)
    for k, gain in enumerate([1.0, 0.5, 0.25, 0.12], start=1):
        y += gain * np.sin(k * phase)
    y = amplitude * y / np.max(np.abs(y))
    return y.astype(np.float32)


@pytest.fixture
def voiced_signal() -> np.ndarray:
    return make_voiced()


@pytest.fixture
def silent_signal() -> np.ndarray:
    rng = np.random.default_rng(42)
    return (1e-4 * rng.standard_normal(SR * 5)).astype(np.float32)


@pytest.fixture
def clipped_signal() -> np.ndarray:
    y = make_voiced(amplitude=1.0)
    return np.clip(y * 3.0, -1.0, 1.0).astype(np.float32)
