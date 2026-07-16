"""Safe ffmpeg-based conversion of uploaded audio to mono 16 kHz WAV."""
import subprocess
import uuid
from pathlib import Path

# Formats we accept for upload. Browser recordings add webm (Chrome/Android)
# and mp4/m4a (iOS Safari), which ffmpeg handles the same way.
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".webm", ".mp4"}

ALLOWED_MIME_PREFIXES = ("audio/", "video/webm", "video/mp4", "application/octet-stream")

FFMPEG_TIMEOUT_SEC = 60


class ConversionError(Exception):
    """Raised when ffmpeg cannot decode the uploaded file."""


def probe_duration(path: Path) -> float | None:
    """Return the container duration in seconds, or None if unreadable."""
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True, text=True, timeout=FFMPEG_TIMEOUT_SEC,
        )
        if out.returncode != 0:
            return None
        return float(out.stdout.strip())
    except (subprocess.TimeoutExpired, ValueError):
        return None


def convert_to_mono_wav(src: Path, dst_dir: Path, sample_rate: int, max_duration: float) -> Path:
    """Convert `src` to a mono 16-bit PCM WAV at `sample_rate`.

    The output is capped at `max_duration` seconds (-t) so a hostile file
    cannot produce an unbounded decode. ffmpeg is invoked with an explicit
    argument list (no shell) and a timeout.
    """
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / f"{uuid.uuid4().hex}.wav"
    cmd = [
        "ffmpeg", "-hide_banner", "-nostdin", "-y",
        "-v", "error",
        "-i", str(src),
        "-t", str(max_duration + 1.0),
        "-vn", "-sn", "-dn",           # drop video/subtitle/data streams
        "-map_metadata", "-1",         # strip metadata
        "-ac", "1",
        "-ar", str(sample_rate),
        "-c:a", "pcm_s16le",
        str(dst),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT_SEC)
    except subprocess.TimeoutExpired as exc:
        dst.unlink(missing_ok=True)
        raise ConversionError("轉檔逾時") from exc
    if proc.returncode != 0 or not dst.exists() or dst.stat().st_size == 0:
        dst.unlink(missing_ok=True)
        raise ConversionError(f"無法解碼音檔: {proc.stderr.strip()[:300]}")
    return dst
