#!/usr/bin/env python3
"""
Prototype song analysis script.

Current goal:
- take an audio file path
- detect bpm + beat start with librosa
- detect timed chord events with lv-chordia
- emit one SongAnalysis-shaped JSON object
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path
from typing import Any

import librosa
import numpy as np

CURRENT_ANALYSIS_VERSION = 3


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze one song into app analysis JSON.")
    parser.add_argument("--song-id", required=True, help="Song id used by the app")
    parser.add_argument("--audio-path", required=True, help="Absolute or relative path to the audio file")
    parser.add_argument(
        "--detect-chords",
        action="store_true",
        help="Run chord detection with the configured detector.",
    )
    parser.add_argument(
        "--output",
        help="Optional output file path. If omitted, analysis JSON is printed to stdout.",
    )
    parser.add_argument(
        "--source",
        choices=["manual", "ai"],
        default="ai",
        help="Analysis source label written into the output JSON.",
    )
    parser.add_argument(
        "--skip-bpm",
        action="store_true",
        help="Skip BPM/beat analysis for fast pipeline testing.",
    )
    return parser.parse_args()


def normalize_lv_chord_label(label: str) -> str:
    chord = label.strip()
    if not chord or chord == "N":
        return "N"

    root, _, quality = chord.partition(":")
    if not quality:
        return root

    quality = quality.replace("maj", "")
    quality = quality.replace("min", "m")
    quality = quality.replace("/", "/")
    normalized = f"{root}{quality}"
    return normalized or root


MIN_CHORD_SEGMENT_SECONDS = 0.7
BRIDGE_CHORD_MAX_SECONDS = 0.35
BPM_VALID_MIN = 55.0
BPM_VALID_MAX = 220.0
BPM_PREFERRED_MIN = 84.0
BPM_PREFERRED_MAX = 168.0
BPM_PREFERRED_CENTER = 118.0
BPM_HOP_LENGTH = 512
NOTE_TO_INDEX = {
    "C": 0,
    "B#": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "Fb": 4,
    "F": 5,
    "E#": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
    "Cb": 11,
}
INDEX_TO_NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def smooth_chord_segments(raw_segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []

    for item in raw_segments:
        if not isinstance(item, dict):
            continue

        start_time = item.get("start_time")
        end_time = item.get("end_time")
        raw_label = item.get("chord")

        if not isinstance(start_time, (int, float)) or not isinstance(end_time, (int, float)):
            continue
        if not isinstance(raw_label, str):
            continue

        chord_label = normalize_lv_chord_label(raw_label)
        if chord_label == "N":
            continue

        start = round(float(start_time), 3)
        end = round(float(end_time), 3)
        if end <= start:
            continue

        segments.append(
            {
                "start_time": start,
                "end_time": end,
                "chord": chord_label,
            }
        )

    if not segments:
        return []

    collapsed: list[dict[str, Any]] = []
    for segment in segments:
        previous = collapsed[-1] if collapsed else None
        if previous and previous["chord"] == segment["chord"]:
            previous["end_time"] = max(previous["end_time"], segment["end_time"])
            continue
        collapsed.append(segment.copy())

    bridge_smoothed: list[dict[str, Any]] = []
    for index, segment in enumerate(collapsed):
        previous = bridge_smoothed[-1] if bridge_smoothed else None
        next_segment = collapsed[index + 1] if index + 1 < len(collapsed) else None
        duration = segment["end_time"] - segment["start_time"]

        if (
            previous
            and next_segment
            and duration <= BRIDGE_CHORD_MAX_SECONDS
            and previous["chord"] == next_segment["chord"]
        ):
            previous["end_time"] = next_segment["end_time"]
            continue

        bridge_smoothed.append(segment.copy())

    duration_smoothed: list[dict[str, Any]] = []
    for index, segment in enumerate(bridge_smoothed):
        duration = segment["end_time"] - segment["start_time"]

        if duration >= MIN_CHORD_SEGMENT_SECONDS:
            duration_smoothed.append(segment.copy())
            continue

        previous = duration_smoothed[-1] if duration_smoothed else None
        next_segment = bridge_smoothed[index + 1] if index + 1 < len(bridge_smoothed) else None

        if previous and next_segment:
            previous_gap = segment["start_time"] - previous["end_time"]
            next_gap = next_segment["start_time"] - segment["end_time"]
            if previous_gap <= next_gap:
                previous["end_time"] = segment["end_time"]
            else:
                next_segment["start_time"] = segment["start_time"]
            continue

        if previous:
            previous["end_time"] = segment["end_time"]
            continue

        if next_segment:
            next_segment["start_time"] = segment["start_time"]
            continue

        duration_smoothed.append(segment.copy())

    final_segments: list[dict[str, Any]] = []
    for segment in duration_smoothed:
        previous = final_segments[-1] if final_segments else None
        if previous and previous["chord"] == segment["chord"]:
            previous["end_time"] = max(previous["end_time"], segment["end_time"])
            continue
        final_segments.append(segment)

    return final_segments


def classify_chord_quality(chord_label: str) -> str:
    lowered = chord_label.lower()

    if "dim" in lowered or "o" in lowered:
        return "dim"
    if lowered.endswith("m") or "min" in lowered:
        return "minor"
    return "major"


def extract_chord_root(chord_label: str) -> str | None:
    if not chord_label:
        return None

    base_label = chord_label.split("/", 1)[0]
    if len(base_label) >= 2 and base_label[1] in ("#", "b"):
        root = base_label[:2]
    else:
        root = base_label[:1]

    return root if root in NOTE_TO_INDEX else None


def infer_key_from_segments(segments: list[dict[str, Any]]) -> str | None:
    if not segments:
        return None

    major_scale_matches = {
        (0, "major"): 4.8,
        (2, "minor"): 2.6,
        (4, "minor"): 2.2,
        (5, "major"): 3.9,
        (7, "major"): 4.5,
        (9, "minor"): 3.0,
        (11, "dim"): 1.4,
    }
    minor_scale_matches = {
        (0, "minor"): 4.8,
        (2, "dim"): 1.6,
        (3, "major"): 3.4,
        (5, "minor"): 3.0,
        (7, "minor"): 3.6,
        (7, "major"): 4.2,
        (8, "major"): 4.0,
        (10, "major"): 2.8,
    }

    best_key: str | None = None
    best_score = float("-inf")
    first_segment = segments[0]
    last_segment = segments[-1]

    for tonic_index, tonic_note in enumerate(INDEX_TO_NOTE):
        for mode, weights in (("major", major_scale_matches), ("minor", minor_scale_matches)):
            score = 0.0
            tonic_duration = 0.0
            dominant_duration = 0.0
            tonic_quality = "major" if mode == "major" else "minor"
            dominant_quality = "major"
            subdominant_quality = "major" if mode == "major" else "minor"

            for segment in segments:
                root = extract_chord_root(segment["chord"])
                if root is None:
                    continue

                duration = max(0.1, float(segment["end_time"]) - float(segment["start_time"]))
                interval = (NOTE_TO_INDEX[root] - tonic_index) % 12
                quality = classify_chord_quality(segment["chord"])

                exact_weight = weights.get((interval, quality))
                if exact_weight is not None:
                    score += exact_weight * duration
                elif any(candidate_interval == interval for candidate_interval, _ in weights):
                    score += 0.6 * duration
                else:
                    score -= 0.9 * duration

                if interval == 0 and quality == tonic_quality:
                    tonic_duration += duration
                    score += 2.0 * duration
                elif interval == 7 and quality == dominant_quality:
                    dominant_duration += duration
                    score += 1.3 * duration
                elif interval == 5 and quality == subdominant_quality:
                    score += 0.9 * duration

                if mode == "major" and interval == 11 and quality == "dim":
                    score += 0.6 * duration
                if mode == "minor" and interval in {3, 8} and quality == "major":
                    score += 0.7 * duration

            # ── Cadence detection (V→I, IV→I, ii→V→I) ──────────────────────
            # These progressions are strong tonal anchors that confirm the tonic.
            # Critically important for distinguishing I from IV (e.g. C maj vs F maj).
            for idx in range(len(segments) - 1):
                curr_root = extract_chord_root(segments[idx]["chord"])
                next_root = extract_chord_root(segments[idx + 1]["chord"])
                if curr_root is None or next_root is None:
                    continue

                curr_interval = (NOTE_TO_INDEX[curr_root] - tonic_index) % 12
                next_interval = (NOTE_TO_INDEX[next_root] - tonic_index) % 12
                curr_quality = classify_chord_quality(segments[idx]["chord"])
                next_quality = classify_chord_quality(segments[idx + 1]["chord"])

                # Authentic cadence: V(maj) → I
                if curr_interval == 7 and curr_quality == "major" and next_interval == 0 and next_quality == tonic_quality:
                    score += 4.5

                # Plagal cadence: IV → I
                if curr_interval == 5 and next_interval == 0 and next_quality == tonic_quality:
                    score += 1.8

                # ii → V (half cadence setup — strong ii–V–I pull)
                if curr_interval == 2 and curr_quality == "minor" and next_interval == 7 and next_quality == "major":
                    score += 2.0

                # Three-chord resolution: ii → V → I
                if idx + 2 < len(segments):
                    next2_root = extract_chord_root(segments[idx + 2]["chord"])
                    if next2_root is not None:
                        next2_interval = (NOTE_TO_INDEX[next2_root] - tonic_index) % 12
                        next2_quality = classify_chord_quality(segments[idx + 2]["chord"])
                        if (
                            curr_interval == 2 and curr_quality == "minor"
                            and next_interval == 7 and next_quality == "major"
                            and next2_interval == 0 and next2_quality == tonic_quality
                        ):
                            score += 6.0

            first_root = extract_chord_root(first_segment["chord"])
            last_root = extract_chord_root(last_segment["chord"])
            if first_root is not None:
                first_interval = (NOTE_TO_INDEX[first_root] - tonic_index) % 12
                if first_interval == 0:
                    score += 6.0
                elif first_interval == 5:
                    score += 2.5
                elif first_interval == 7:
                    score += 1.8

            if last_root is not None:
                last_interval = (NOTE_TO_INDEX[last_root] - tonic_index) % 12
                if last_interval == 0:
                    score += 11.0
                elif last_interval == 7:
                    score += 2.2
                else:
                    score -= 1.2

            if tonic_duration > 0:
                score += tonic_duration * 1.6
            if tonic_duration > dominant_duration:
                score += 2.5
            elif dominant_duration > tonic_duration * 1.25:
                score -= 1.5

            if score > best_score:
                best_score = score
                best_key = tonic_note if mode == "major" else f"{tonic_note}m"

    return best_key


# Krumhansl-Schmuckler tonal hierarchy profiles (major and minor)
_KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def detect_key_from_chromagram(audio_path: Path) -> str | None:
    """Independent key detection using pitch-class chromagram + K-S profiles.

    This runs directly on the raw audio and is unaffected by chord detector
    errors, making it a reliable cross-check against infer_key_from_segments.
    """
    try:
        signal, sample_rate = librosa.load(audio_path, sr=22050, mono=True)
        harmonic = librosa.effects.harmonic(signal, margin=4)
        chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sample_rate, bins_per_octave=36)
        chroma_mean = np.mean(chroma, axis=1)  # 12-element pitch-class profile

        best_key: str | None = None
        best_corr = float("-inf")

        for i, note in enumerate(INDEX_TO_NOTE):
            major_corr = float(np.corrcoef(chroma_mean, np.roll(_KS_MAJOR, i))[0, 1])
            minor_corr = float(np.corrcoef(chroma_mean, np.roll(_KS_MINOR, i))[0, 1])

            if major_corr > best_corr:
                best_corr = major_corr
                best_key = note
            if minor_corr > best_corr:
                best_corr = minor_corr
                best_key = f"{note}m"

        return best_key
    except Exception:
        return None


def _key_to_tonic_and_mode(key: str) -> tuple[int, str]:
    if key.endswith("m"):
        note = key[:-1]
        return NOTE_TO_INDEX.get(note, -1), "minor"
    return NOTE_TO_INDEX.get(key, -1), "major"


def resolve_detected_key(chord_key: str | None, chroma_key: str | None) -> str | None:
    """Reconcile chord-based and chromagram-based key estimates.

    - Agreement → confident, return that key.
    - Relative-key confusion (e.g. C maj vs A min) → trust chord-based
      since cadence structure distinguishes these better than pitch profiles.
    - All other disagreements → trust chromagram; it's independent of chord
      detector errors and reliably catches subdominant-as-tonic mistakes
      (e.g. detecting F maj when the song is in C maj).
    """
    if chord_key is None and chroma_key is None:
        return None
    if chord_key is None:
        return chroma_key
    if chroma_key is None:
        return chord_key
    if chord_key == chroma_key:
        return chord_key

    chord_idx, chord_mode = _key_to_tonic_and_mode(chord_key)
    chroma_idx, chroma_mode = _key_to_tonic_and_mode(chroma_key)

    # Relative key pair: major tonic is minor tonic + 3 semitones
    # e.g. C major (0) and A minor (9) → (9 + 3) % 12 == 0
    if chord_mode == "major" and chroma_mode == "minor":
        if chord_idx == (chroma_idx + 3) % 12:
            return chord_key  # cadence structure is better for maj/min distinction
    if chord_mode == "minor" and chroma_mode == "major":
        if chroma_idx == (chord_idx + 3) % 12:
            return chord_key  # same reason — keep chord-based judgment

    # Genuine disagreement (e.g. C maj vs F maj) — chromagram wins
    return chroma_key


def detect_chord_events(
    audio_path: Path,
    detect_chords: bool,
) -> tuple[list[dict[str, Any]], str | None]:
    if not detect_chords:
        return ([], None)

    os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "jam-mpl-cache"))

    try:
        from lv_chordia.chord_recognition import chord_recognition
    except Exception:
        return ([], None)

    try:
        results = chord_recognition(str(audio_path), chord_dict_name="submission")
    except Exception:
        return ([], None)

    smoothed_segments = smooth_chord_segments(results)
    normalized_events: list[dict[str, Any]] = []

    for item in smoothed_segments:
        normalized_events.append(
            {
                "time": item["start_time"],
                "chord": item["chord"],
            }
        )

    chord_key = infer_key_from_segments(smoothed_segments)
    chroma_key = detect_key_from_chromagram(audio_path)
    final_key = resolve_detected_key(chord_key, chroma_key)

    return (normalized_events, final_key)


def correct_bpm(raw_bpm: float | None) -> float | None:
    if raw_bpm is None or raw_bpm <= 0:
        return None

    corrected = round(float(raw_bpm), 1)
    if BPM_VALID_MIN <= corrected <= BPM_VALID_MAX:
        return corrected

    return None


def collect_tempo_candidates(raw_tempi: list[float]) -> list[float]:
    candidates: set[float] = set()

    for tempo in raw_tempi:
        if not np.isfinite(tempo) or tempo <= 0:
            continue

        for factor in (0.5, 1.0, 2.0):
            candidate = round(float(tempo) * factor, 1)
            if BPM_VALID_MIN <= candidate <= BPM_VALID_MAX:
                candidates.add(float(candidate))

    return sorted(candidates)


def score_tempo_candidate(
    bpm: float,
    onset_envelope: np.ndarray,
    sample_rate: int,
    inter_beat_bpm: float | None,
    autocorrelation: np.ndarray,
) -> float:
    frames_per_beat = (60.0 * sample_rate) / (bpm * BPM_HOP_LENGTH)
    lag = int(round(frames_per_beat))
    if lag <= 0 or lag >= len(autocorrelation):
        return float("-inf")

    autocorr_score = float(autocorrelation[lag]) / float(autocorrelation[0] + 1e-8)
    range_bonus = 1.25 if BPM_PREFERRED_MIN <= bpm <= BPM_PREFERRED_MAX else 0.0
    center_penalty = abs(bpm - BPM_PREFERRED_CENTER) * 0.035
    interval_penalty = 0.0 if inter_beat_bpm is None else min(abs(bpm - inter_beat_bpm), 40.0) * 0.08

    beat_grid = np.arange(0, len(onset_envelope), frames_per_beat)
    beat_indices = np.clip(np.round(beat_grid).astype(int), 0, len(onset_envelope) - 1)
    unique_indices = np.unique(beat_indices)
    grid_energy = float(np.mean(onset_envelope[unique_indices])) if unique_indices.size else 0.0
    baseline_energy = float(np.mean(onset_envelope)) + 1e-8
    grid_score = grid_energy / baseline_energy

    return autocorr_score * 5.0 + grid_score * 2.2 + range_bonus - center_penalty - interval_penalty


def infer_beat_start_time(
    beat_times: np.ndarray,
    beat_frames: np.ndarray,
    onset_envelope: np.ndarray,
    bpm: float,
) -> float | None:
    if beat_times.size == 0 or beat_frames.size == 0 or bpm <= 0:
        return None

    beat_duration = 60.0 / bpm
    usable_beats = min(int(beat_times.size), 24)
    usable_frames = beat_frames[:usable_beats]
    usable_times = beat_times[:usable_beats]
    usable_strengths = onset_envelope[usable_frames] if usable_frames.size > 0 else np.array([])

    if usable_times.size == 0:
        return None

    if usable_times.size < 4 or usable_strengths.size < 4:
        return float(usable_times[0])

    best_phase = 0
    best_score = float("-inf")

    for phase in range(4):
        phase_indices = np.arange(phase, usable_times.size, 4)
        if phase_indices.size == 0:
            continue

        downbeat_strength = float(np.mean(usable_strengths[phase_indices]))
        all_strength = float(np.mean(usable_strengths)) + 1e-8
        normalized_strength = downbeat_strength / all_strength

        position_bonus = max(0.0, 1.0 - (phase * 0.16))
        cadence_bonus = 0.0

        if phase_indices.size >= 2:
            first_downbeat = float(usable_times[phase_indices[0]])
            second_downbeat = float(usable_times[phase_indices[1]])
            cadence_error = abs((second_downbeat - first_downbeat) - (beat_duration * 4.0))
            cadence_bonus = max(0.0, 1.0 - (cadence_error / max(beat_duration, 1e-8)))

        score = normalized_strength * 4.5 + position_bonus + cadence_bonus

        if score > best_score:
            best_score = score
            best_phase = phase

    anchor_time = float(usable_times[best_phase])
    return anchor_time - (best_phase * beat_duration)


def analyze_bpm_and_beats(audio_path: Path) -> tuple[float | None, float | None]:
    signal, sample_rate = librosa.load(audio_path, sr=None, mono=True)
    _, percussive = librosa.effects.hpss(signal)
    onset_envelope = librosa.onset.onset_strength(
        y=percussive,
        sr=sample_rate,
        hop_length=BPM_HOP_LENGTH,
        aggregate=np.median,
    )
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_envelope,
        sr=sample_rate,
        hop_length=BPM_HOP_LENGTH,
        units="frames",
        trim=False,
    )
    beat_times = librosa.frames_to_time(beat_frames, sr=sample_rate, hop_length=BPM_HOP_LENGTH)

    raw_tempi: list[float] = []
    if tempo is None:
        pass
    elif isinstance(tempo, np.ndarray):
        raw_tempi.extend(float(value) for value in tempo.flatten() if np.isfinite(value))
    else:
        raw_tempi.append(float(tempo))

    try:
        dynamic_tempi = librosa.feature.tempo(
            onset_envelope=onset_envelope,
            sr=sample_rate,
            hop_length=BPM_HOP_LENGTH,
            aggregate=None,
        )
        raw_tempi.extend(float(value) for value in np.asarray(dynamic_tempi).flatten() if np.isfinite(value))
    except Exception:
        pass

    inter_beat_bpm: float | None = None
    if len(beat_times) >= 2:
        beat_intervals = np.diff(beat_times)
        stable_intervals = beat_intervals[np.isfinite(beat_intervals) & (beat_intervals > 0.2) & (beat_intervals < 2.0)]
        if stable_intervals.size > 0:
            inter_beat_bpm = float(round(60.0 / float(np.median(stable_intervals)), 1))
            raw_tempi.append(inter_beat_bpm)

    candidates = collect_tempo_candidates(raw_tempi)
    autocorrelation = librosa.autocorrelate(onset_envelope, max_size=min(len(onset_envelope) - 1, 2000))
    bpm = max(candidates, key=lambda candidate: score_tempo_candidate(candidate, onset_envelope, sample_rate, inter_beat_bpm, autocorrelation)) if candidates else None
    bpm = correct_bpm(bpm)

    if len(beat_times) == 0 or bpm is None:
        beat_start_time = None
    else:
        beat_start_time = infer_beat_start_time(beat_times, beat_frames, onset_envelope, bpm)

    return bpm, beat_start_time


def main() -> None:
    args = parse_args()
    audio_path = Path(args.audio_path)
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    if args.skip_bpm:
        bpm, beat_start_time = None, None
    else:
        bpm, beat_start_time = analyze_bpm_and_beats(audio_path)
    chord_events, detected_key = detect_chord_events(
        audio_path=audio_path,
        detect_chords=args.detect_chords,
    )

    analysis = {
        "songId": args.song_id,
        "bpm": bpm,
        "beatStartTime": beat_start_time,
        "detectedKey": detected_key,
        "chordEvents": chord_events,
        "source": args.source,
        "version": CURRENT_ANALYSIS_VERSION,
    }

    rendered = json.dumps(analysis, indent=2)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered, encoding="utf-8")
        return

    print(rendered)


if __name__ == "__main__":
    main()
