"""Application settings, loaded from environment variables."""
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Storage
    data_dir: Path = Path("./data")
    db_path: Path = Path("./data/voice_analysis.db")
    # Delete original uploads + converted wav after analysis (default: yes)
    keep_audio: bool = False

    # Upload validation
    max_upload_bytes: int = 25 * 1024 * 1024  # 25 MB
    min_duration_sec: float = 3.0
    max_duration_sec: float = 120.0

    # Analysis
    sample_rate: int = 16000
    f0_min: float = 50.0
    f0_max: float = 500.0

    # Quality gate: below this confidence we refuse to output wuxing scores
    min_confidence: float = 40.0

    # CORS
    cors_origins: str = "http://localhost:3000"

    model_config = {"env_prefix": "VA_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
