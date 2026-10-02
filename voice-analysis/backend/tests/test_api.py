"""API tests: full upload → convert → analyze → score flow over HTTP."""
import io
import subprocess

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from .conftest import SR, make_voiced


@pytest.fixture()
def client(tmp_path, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "data_dir", tmp_path / "data")
    monkeypatch.setattr(settings, "db_path", tmp_path / "data" / "test.db")
    monkeypatch.setattr(settings, "keep_audio", False)
    from app.main import app
    with TestClient(app) as c:
        yield c


def wav_bytes(y: np.ndarray, sr: int = SR) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def post_audio(client, data: bytes, filename="voice.wav",
               nickname="測試者", reference="male"):
    return client.post(
        "/api/analyze",
        files={"file": (filename, data, "audio/wav")},
        data={"nickname": nickname, "reference": reference},
    )


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_full_analysis_flow(client, tmp_path):
    r = post_audio(client, wav_bytes(make_voiced(duration=6.0, f0=130.0)))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "completed"
    assert body["nickname"] == "測試者"
    assert body["quality"]["ok"] is True
    assert abs(body["features"]["f0_median"] - 130.0) < 12.0
    assert len(body["features"]["pitch_contour"]) == 8
    scores = body["scores"]
    assert scores["primary"] in scores["elements"]
    for el in scores["elements"].values():
        assert 0 <= el["score"] <= 100
        assert len(el["breakdown"]) == 3

    # Result is retrievable from SQLite
    r2 = client.get(f"/api/analyses/{body['id']}")
    assert r2.status_code == 200
    assert r2.json()["scores"]["primary"] == scores["primary"]

    # Audio was deleted after analysis (keep_audio=False)
    from app.config import settings
    leftovers = [p for p in settings.data_dir.rglob("*")
                 if p.suffix in (".wav", ".mp3", ".webm")]
    assert leftovers == []


def test_mp3_upload_converted(client):
    """Real ffmpeg conversion from mp3."""
    y = make_voiced(duration=5.0, f0=180.0)
    wav = wav_bytes(y)
    mp3 = subprocess.run(
        ["ffmpeg", "-hide_banner", "-v", "error", "-i", "pipe:0",
         "-f", "mp3", "-b:a", "128k", "pipe:1"],
        input=wav, capture_output=True, check=True,
    ).stdout
    r = post_audio(client, mp3, filename="voice.mp3", reference="female")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "completed"
    assert abs(body["features"]["f0_median"] - 180.0) < 15.0


def test_silent_audio_gets_no_wuxing_conclusion(client):
    rng = np.random.default_rng(0)
    silent = (1e-4 * rng.standard_normal(SR * 5)).astype(np.float32)
    r = post_audio(client, wav_bytes(silent))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "insufficient_quality"
    assert body["scores"] is None
    assert body["quality"]["ok"] is False
    assert len(body["quality"]["issues"]) >= 1


def test_rejects_too_short(client):
    r = post_audio(client, wav_bytes(make_voiced(duration=1.0)))
    assert r.status_code == 422
    assert "太短" in r.json()["detail"]


def test_rejects_bad_extension(client):
    r = post_audio(client, b"not audio", filename="notes.txt")
    assert r.status_code == 422


def test_rejects_garbage_content(client):
    r = post_audio(client, b"\x00" * 100000, filename="fake.mp3")
    assert r.status_code == 422


def test_rejects_empty_nickname(client):
    r = post_audio(client, wav_bytes(make_voiced()), nickname="   ")
    assert r.status_code == 422


def test_rejects_bad_reference(client):
    r = post_audio(client, wav_bytes(make_voiced()), reference="dragon")
    assert r.status_code == 422


def test_unknown_analysis_404(client):
    r = client.get("/api/analyses/deadbeef")
    assert r.status_code == 404
