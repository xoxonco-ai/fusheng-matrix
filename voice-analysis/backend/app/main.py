"""FastAPI application: upload → convert → quality gate → analyze → score."""
import asyncio
import shutil
import tempfile
import uuid
from pathlib import Path

import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .audio.convert import (
    ALLOWED_EXTENSIONS,
    ConversionError,
    convert_to_mono_wav,
    probe_duration,
)
from .audio.features import extract_features
from .audio.quality import assess_quality
from .config import settings
from .scoring.wuxing import REFERENCES, score_wuxing

app = FastAPI(title="五行聲音分析 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


def _validate_upload(file: UploadFile) -> str:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"不支援的檔案格式 {suffix or '(無副檔名)'}。"
                   f"支援：WAV、MP3、M4A、AAC、OGG、WebM",
        )
    return suffix


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    nickname: str = Form(...),
    reference: str = Form("unspecified"),
) -> dict:
    nickname = nickname.strip()
    if not nickname or len(nickname) > 50:
        raise HTTPException(status_code=422, detail="請輸入 1–50 字的名稱或暱稱")
    if reference not in REFERENCES:
        raise HTTPException(status_code=422, detail="無效的聲學參考選項")
    suffix = _validate_upload(file)

    settings.data_dir.mkdir(parents=True, exist_ok=True)
    workdir = Path(tempfile.mkdtemp(prefix="va_", dir=settings.data_dir))
    src = workdir / f"upload_{uuid.uuid4().hex}{suffix}"
    try:
        # Stream to disk with a size cap
        size = 0
        with src.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"檔案超過 {settings.max_upload_bytes // (1024*1024)} MB 上限",
                    )
                out.write(chunk)
        if size == 0:
            raise HTTPException(status_code=422, detail="檔案是空的")

        # Duration validation before full decode. All CPU/subprocess-heavy
        # steps below run in the default thread pool so they don't block
        # the event loop while an analysis is in flight.
        dur = await asyncio.to_thread(probe_duration, src)
        if dur is not None:
            if dur < settings.min_duration_sec:
                raise HTTPException(
                    status_code=422,
                    detail=f"錄音太短（{dur:.1f} 秒），至少需要 {settings.min_duration_sec:.0f} 秒",
                )
            if dur > settings.max_duration_sec:
                raise HTTPException(
                    status_code=422,
                    detail=f"錄音太長（{dur:.1f} 秒），上限 {settings.max_duration_sec:.0f} 秒",
                )

        # Safe conversion to mono WAV
        try:
            wav_path = await asyncio.to_thread(
                convert_to_mono_wav,
                src, workdir, settings.sample_rate, settings.max_duration_sec,
            )
        except ConversionError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        y, sr = await asyncio.to_thread(sf.read, wav_path, dtype="float32")
        duration = len(y) / sr
        if duration < settings.min_duration_sec:
            raise HTTPException(
                status_code=422,
                detail=f"有效音訊太短（{duration:.1f} 秒），至少需要 {settings.min_duration_sec:.0f} 秒",
            )

        features = await asyncio.to_thread(
            extract_features, y, sr, settings.f0_min, settings.f0_max
        )
        quality = assess_quality(features, settings.min_confidence)

        if quality.ok:
            scores = score_wuxing(features, reference)
            status = "completed"
        else:
            # Quality gate: never fabricate a wuxing conclusion from bad audio
            scores = None
            status = "insufficient_quality"

        analysis_id = await asyncio.to_thread(
            db.save_analysis,
            settings.db_path,
            nickname=nickname,
            reference=reference,
            status=status,
            features=features.to_dict(),
            quality=quality.to_dict(),
            scores=scores,
        )
        return {
            "id": analysis_id,
            "nickname": nickname,
            "reference": reference,
            "status": status,
            "features": features.to_dict(),
            "quality": quality.to_dict(),
            "scores": scores,
        }
    finally:
        # Default: delete original upload and converted audio after analysis
        if not settings.keep_audio:
            shutil.rmtree(workdir, ignore_errors=True)


@app.get("/api/analyses/{analysis_id}")
def get_analysis(analysis_id: str) -> dict:
    result = db.load_analysis(settings.db_path, analysis_id)
    if result is None:
        raise HTTPException(status_code=404, detail="找不到這筆分析")
    return result
