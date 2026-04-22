from __future__ import annotations

import gc
import os
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
import sys

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from analyze_song import (  # noqa: E402
    CURRENT_ANALYSIS_VERSION,
    analyze_bpm_and_beats,
    detect_chord_events,
    snap_chord_events_to_beats,
)

app = FastAPI(title="JAM Analysis Service")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allowed_origins == ["*"] else allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"ok": True}


@app.post("/analyze")
async def analyze(
    songId: str = Form(...),
    detectChords: str = Form("true"),
    skipBpm: str = Form("false"),
    file: UploadFile = File(...),
):
    suffix = Path(file.filename or "track.mp3").suffix or ".mp3"
    temp_dir = Path(tempfile.mkdtemp(prefix="jam-analysis-"))
    temp_path = temp_dir / f"upload{suffix}"

    try:
        with temp_path.open("wb") as destination:
            shutil.copyfileobj(file.file, destination)

        should_detect_chords = str(detectChords).lower() == "true"
        should_skip_bpm = str(skipBpm).lower() == "true"

        if should_skip_bpm:
            bpm, beat_start_time, beat_times = None, None, []
        else:
            bpm, beat_start_time, beat_times = analyze_bpm_and_beats(temp_path)

        chord_events, detected_key = detect_chord_events(
            audio_path=temp_path,
            detect_chords=should_detect_chords,
        )

        if chord_events and len(beat_times) >= 2 and bpm is not None:
            chord_events = snap_chord_events_to_beats(chord_events, beat_times, bpm)

        return JSONResponse(
            {
                "songId": songId,
                "bpm": bpm,
                "beatStartTime": beat_start_time,
                "detectedKey": detected_key,
                "chordEvents": chord_events,
                "source": "ai",
                "version": CURRENT_ANALYSIS_VERSION,
            }
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    finally:
        try:
            file.file.close()
        except Exception:
            pass
        shutil.rmtree(temp_dir, ignore_errors=True)
        gc.collect()
