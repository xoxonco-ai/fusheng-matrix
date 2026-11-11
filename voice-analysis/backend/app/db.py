"""SQLite persistence for analysis results (audio itself is not stored)."""
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    reference TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    features_json TEXT NOT NULL,
    quality_json TEXT NOT NULL,
    scores_json TEXT
);
"""


def get_conn(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(SCHEMA)
    return conn


def save_analysis(
    db_path: Path,
    nickname: str,
    reference: str,
    status: str,
    features: dict,
    quality: dict,
    scores: dict | None,
) -> str:
    analysis_id = uuid.uuid4().hex
    conn = get_conn(db_path)
    try:
        conn.execute(
            "INSERT INTO analyses (id, nickname, reference, status, created_at,"
            " features_json, quality_json, scores_json) VALUES (?,?,?,?,?,?,?,?)",
            (
                analysis_id, nickname, reference, status,
                datetime.now(timezone.utc).isoformat(),
                json.dumps(features, ensure_ascii=False),
                json.dumps(quality, ensure_ascii=False),
                json.dumps(scores, ensure_ascii=False) if scores is not None else None,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return analysis_id


def load_analysis(db_path: Path, analysis_id: str) -> dict | None:
    conn = get_conn(db_path)
    try:
        row = conn.execute(
            "SELECT * FROM analyses WHERE id = ?", (analysis_id,)
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    return {
        "id": row["id"],
        "nickname": row["nickname"],
        "reference": row["reference"],
        "status": row["status"],
        "created_at": row["created_at"],
        "features": json.loads(row["features_json"]),
        "quality": json.loads(row["quality_json"]),
        "scores": json.loads(row["scores_json"]) if row["scores_json"] else None,
    }
