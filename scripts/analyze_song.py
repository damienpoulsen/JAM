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
import gc
import json
import os
import sys
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
    parser.add_argument(
        "--extract-stems",
        action="store_true",
        help="Extract instrumental (no vocals) and save to --output path. Skips analysis.",
    )
    parser.add_argument(
        "--stem-mode",
        choices=["none", "hpss", "demucs"],
        default="demucs",
        help="Stem separation mode before chord detection. 'demucs' removes drums+vocals (best quality), 'hpss' removes drum transients (fast), 'none' uses full mix.",
    )
    return parser.parse_args()


def normalize_lv_chord_label(label: str) -> str:
    chord = label.strip()
    if not chord or chord == "N":
        return "N"

    root, _, quality = chord.partition(":")
    if not quality:
        return root

    # Replace min/min7/min9 before touching maj so we don't corrupt minmaj variants
    quality = quality.replace("min", "m")
    # Only strip bare "maj" (plain major triad) — leave maj7, maj9, etc. intact
    if quality == "maj":
        quality = ""
    normalized = f"{root}{quality}"
    return normalized or root


MIN_CHORD_SEGMENT_SECONDS = 0.35
BRIDGE_CHORD_MAX_SECONDS = 0.15
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

    if "dim" in lowered:
        return "dim"
    # Root is 1 char, or 2 if followed by # or b (e.g. C#, Bb)
    root_end = 2 if len(lowered) >= 2 and lowered[1] in ("#", "b") else 1
    quality_part = lowered[root_end:]
    # Minor if quality starts with "m" but not "maj" (catches Cm, Cm7, Cm9, etc.)
    if (quality_part.startswith("m") and not quality_part.startswith("maj")) or "min" in quality_part:
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


# Diatonic scale-degree → expected quality for major and minor keys.
# Intervals are semitones above the tonic (0–11).
_DIATONIC_MAJOR: dict[int, str] = {
    0: "major", 2: "minor", 4: "minor",
    5: "major", 7: "major", 9: "minor", 11: "dim",
}
_DIATONIC_MINOR: dict[int, str] = {
    0: "minor", 2: "dim",  3: "major",
    5: "minor", 7: "minor", 8: "major", 10: "major",
    # harmonic minor additions: raised leading tone and V major
    7: "major", 11: "dim",
}


def filter_chords_by_key(
    segments: list[dict[str, Any]],
    key: str,
) -> list[dict[str, Any]]:
    """Correct obvious major/minor quality errors on diatonic roots.

    Only touches plain triads (no 7ths, no slash chords) where the root lands
    on a diatonic scale degree but the quality is the wrong one. Safe to apply
    because both the chromagram and chord-based key estimates already agreed.
    """
    tonic_note = key[:-1] if key.endswith("m") else key
    mode = "minor" if key.endswith("m") else "major"

    if tonic_note not in NOTE_TO_INDEX:
        return segments

    tonic_idx = NOTE_TO_INDEX[tonic_note]
    diatonic = _DIATONIC_MAJOR if mode == "major" else _DIATONIC_MINOR

    result: list[dict[str, Any]] = []
    for segment in segments:
        chord = segment["chord"]
        root = extract_chord_root(chord)

        if root is None:
            result.append(segment)
            continue

        # Leave 7th/extended chords and slash chords alone — too many legitimate variations
        if any(ch in chord for ch in ("7", "9", "11", "13", "/")):
            result.append(segment)
            continue

        quality = classify_chord_quality(chord)
        interval = (NOTE_TO_INDEX[root] - tonic_idx) % 12
        expected_quality = diatonic.get(interval)

        # Only correct plain major ↔ minor swaps on a diatonic root
        if (
            expected_quality in ("major", "minor")
            and quality in ("major", "minor")
            and quality != expected_quality
        ):
            suffix = "m" if expected_quality == "minor" else ""
            result.append({**segment, "chord": f"{root}{suffix}"})
        else:
            result.append(segment)

    # Re-collapse any consecutive identical chords created by the corrections
    final: list[dict[str, Any]] = []
    for segment in result:
        prev = final[-1] if final else None
        if prev and prev["chord"] == segment["chord"]:
            prev["end_time"] = max(prev["end_time"], segment["end_time"])
        else:
            final.append(segment.copy())

    return final


def _load_audio_tensor(audio_path: Path, target_sr: int):
    """Load audio file to a (2, samples) float32 torch tensor at target_sr."""
    import torch
    import soundfile as sf
    import numpy as np
    data, sr = sf.read(str(audio_path), dtype="float32", always_2d=True)
    wav = torch.from_numpy(data.T)  # (channels, samples)
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)
    if sr != target_sr:
        try:
            import torchaudio
            wav = torchaudio.functional.resample(wav, sr, target_sr)
        except Exception:
            import librosa
            mono = librosa.resample(data[:, 0], orig_sr=sr, target_sr=target_sr)
            wav = torch.from_numpy(np.stack([mono, mono]))
    return wav


def _save_audio_tensor(tensor, sr: int, output_path: Path) -> None:
    """Save a (channels, samples) float32 tensor as WAV."""
    import soundfile as sf
    import numpy as np
    out = tensor.numpy().T  # (samples, channels)
    sf.write(str(output_path), out, sr)


def extract_instrumental(audio_path: Path, output_path: Path) -> None:
    """
    Use Demucs to separate stems, then mix everything except vocals into output_path.
    Raises on failure.
    """
    import torch
    from demucs.pretrained import get_model
    from demucs.apply import apply_model

    model = get_model("htdemucs")
    model.eval()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)

    wav = _load_audio_tensor(audio_path, model.samplerate)
    mix = wav.unsqueeze(0).to(device)
    with torch.no_grad():
        sources = apply_model(model, mix, device=device)[0]

    stem_names = list(model.sources)
    vocal_idx = stem_names.index("vocals")
    instrumental = sum(
        sources[i].cpu()
        for i in range(len(stem_names))
        if i != vocal_idx
    )

    _save_audio_tensor(instrumental, model.samplerate, output_path)


def separate_for_chords(audio_path: Path, mode: str) -> "Path | None":
    """
    Isolate harmonic content from audio before chord detection.
    Returns path to a temp WAV file, or None to use the original.
    Caller is responsible for deleting the returned file.
    """
    if mode == "demucs":
        try:
            import torch
            from demucs.pretrained import get_model
            from demucs.apply import apply_model

            model = get_model("htdemucs")
            model.eval()
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model.to(device)

            wav = _load_audio_tensor(audio_path, model.samplerate)
            mix = wav.unsqueeze(0).to(device)
            with torch.no_grad():
                sources = apply_model(model, mix, device=device)[0]

            stem_names = list(model.sources)
            bass_idx  = stem_names.index("bass")
            other_idx = stem_names.index("other")
            harmonic = (sources[bass_idx] + sources[other_idx]).cpu()

            tmp = Path(tempfile.mktemp(suffix=".wav"))
            _save_audio_tensor(harmonic, model.samplerate, tmp)
            print("[stem-sep] demucs: bass+other extracted successfully", file=sys.stderr)
            return tmp
        except Exception as exc:
            print(f"[stem-sep] demucs failed ({exc}), falling back to HPSS", file=sys.stderr)

    if mode in ("hpss", "demucs"):
        try:
            import soundfile as sf
            signal, sr = librosa.load(audio_path, sr=22050, mono=True)
            y_harmonic, _ = librosa.effects.hpss(signal)
            tmp = Path(tempfile.mktemp(suffix=".wav"))
            sf.write(str(tmp), y_harmonic, sr)
            label = "hpss" if mode == "hpss" else "hpss (demucs fallback)"
            print(f"[stem-sep] {label}: harmonic component extracted", file=sys.stderr)
            return tmp
        except Exception as exc:
            print(f"[stem-sep] HPSS failed ({exc}), using original mix", file=sys.stderr)
            return None

    print("[stem-sep] none: using original mix", file=sys.stderr)
    return None  # mode == "none"


def _patch_collections_compat() -> None:
    """Monkey-patch collections.abc aliases removed in Python 3.10+.

    madmom 0.16.x uses bare `collections.MutableSequence` etc., which no
    longer exist in Python 3.10+. Patching once before import is safe.
    """
    import collections
    import collections.abc
    for _name in dir(collections.abc):
        if not hasattr(collections, _name):
            setattr(collections, _name, getattr(collections.abc, _name))


def _detect_chords_madmom(audio_path: Path) -> list[dict[str, Any]]:
    """Chord recognition via madmom DeepChroma model (CNN + CRF decoder).

    Returns raw segments in the same shape as lv_chordia so the rest of
    the pipeline (smoothing, key detection) is unchanged.
    """
    _patch_collections_compat()
    from madmom.features.chords import CNNChordFeatureProcessor, CRFChordRecognitionProcessor

    wav_path, is_tmp = _to_wav_for_madmom(audio_path)
    try:
        features = CNNChordFeatureProcessor()(str(wav_path))
        chords = CRFChordRecognitionProcessor()(features)
    finally:
        if is_tmp and wav_path.exists():
            wav_path.unlink()

    return [
        {"start_time": float(c[0]), "end_time": float(c[1]), "chord": str(c[2])}
        for c in chords
    ]


def _detect_chords_lvchordia(audio_path: Path) -> list[dict[str, Any]]:
    from lv_chordia.chord_recognition import chord_recognition
    return chord_recognition(str(audio_path), chord_dict_name="submission")  # type: ignore[return-value]


def _chord_root(label: str) -> str:
    """Extract just the root note from a chord label (e.g. 'Am7' → 'A', 'F#m' → 'F#')."""
    if not label or label == "N":
        return "N"
    if len(label) >= 2 and label[1] in ("#", "b"):
        return label[:2]
    return label[:1]


def _ensemble_merge_chords(
    madmom_segs: list[dict[str, Any]],
    lv_segs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Merge two chord detection results into one higher-confidence sequence.

    For each madmom segment we find the lv_chordia segment with the greatest
    temporal overlap and compare roots:
      - Roots agree  → keep madmom chord as-is (high confidence)
      - Roots disagree → keep madmom chord but flag it so smoothing is stricter
        (short disagreement bursts get absorbed into neighbours)

    The merged output is normal segment dicts, but disagreement segments carry
    an extra "_uncertain" key that smooth_chord_segments_ensemble uses to apply
    a tighter minimum-duration threshold.
    """
    if not lv_segs:
        return madmom_segs

    # Pre-normalise lv_chordia labels so roots are comparable
    lv_normalised = [
        {**s, "chord": normalize_lv_chord_label(s["chord"])}
        for s in lv_segs
    ]

    merged: list[dict[str, Any]] = []
    for seg in madmom_segs:
        mid = (float(seg["start_time"]) + float(seg["end_time"])) / 2.0

        # Find lv_chordia segment that contains midpoint (or is closest)
        lv_chord: str | None = None
        for lv in lv_normalised:
            if float(lv["start_time"]) <= mid < float(lv["end_time"]):
                lv_chord = lv["chord"]
                break
        if lv_chord is None and lv_normalised:
            # Closest by midpoint distance
            lv_chord = min(
                lv_normalised,
                key=lambda s: abs((float(s["start_time"]) + float(s["end_time"])) / 2.0 - mid),
            )["chord"]

        madmom_root = _chord_root(normalize_lv_chord_label(seg["chord"]))
        lv_root = _chord_root(lv_chord or "N")
        uncertain = madmom_root != lv_root and madmom_root != "N" and lv_root != "N"

        merged.append({**seg, "_uncertain": uncertain})

    return merged


def _smooth_ensemble_segments(raw_segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Like smooth_chord_segments but uses stricter min-duration for uncertain segments."""
    CERTAIN_MIN = MIN_CHORD_SEGMENT_SECONDS       # 0.35 s
    UNCERTAIN_MIN = MIN_CHORD_SEGMENT_SECONDS * 1.4  # ~0.49 s — slightly stricter for disagreements

    cleaned = []
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
        cleaned.append({"start_time": start, "end_time": end, "chord": chord_label, "_uncertain": item.get("_uncertain", False)})

    if not cleaned:
        return []

    # Collapse consecutive identical chords
    collapsed: list[dict[str, Any]] = []
    for seg in cleaned:
        prev = collapsed[-1] if collapsed else None
        if prev and prev["chord"] == seg["chord"]:
            prev["end_time"] = max(prev["end_time"], seg["end_time"])
            prev["_uncertain"] = prev["_uncertain"] and seg["_uncertain"]
            continue
        collapsed.append(seg.copy())

    # Bridge smoothing (same as original)
    bridge_smoothed: list[dict[str, Any]] = []
    for idx, seg in enumerate(collapsed):
        prev = bridge_smoothed[-1] if bridge_smoothed else None
        nxt = collapsed[idx + 1] if idx + 1 < len(collapsed) else None
        dur = seg["end_time"] - seg["start_time"]
        if (
            prev and nxt
            and dur <= BRIDGE_CHORD_MAX_SECONDS
            and prev["chord"] == nxt["chord"]
        ):
            prev["end_time"] = nxt["end_time"]
            continue
        bridge_smoothed.append(seg.copy())

    # Duration filtering — stricter threshold for uncertain chords
    dur_filtered: list[dict[str, Any]] = []
    for idx, seg in enumerate(bridge_smoothed):
        min_dur = UNCERTAIN_MIN if seg.get("_uncertain") else CERTAIN_MIN
        dur = seg["end_time"] - seg["start_time"]
        if dur >= min_dur:
            dur_filtered.append(seg.copy())
            continue
        prev = dur_filtered[-1] if dur_filtered else None
        nxt = bridge_smoothed[idx + 1] if idx + 1 < len(bridge_smoothed) else None
        if prev and nxt:
            if seg["start_time"] - prev["end_time"] <= nxt["start_time"] - seg["end_time"]:
                prev["end_time"] = seg["end_time"]
            else:
                nxt["start_time"] = seg["start_time"]
            continue
        if prev:
            prev["end_time"] = seg["end_time"]
            continue
        if nxt:
            nxt["start_time"] = seg["start_time"]
            continue
        dur_filtered.append(seg.copy())

    # Final collapse + strip internal key
    final: list[dict[str, Any]] = []
    for seg in dur_filtered:
        prev = final[-1] if final else None
        if prev and prev["chord"] == seg["chord"]:
            prev["end_time"] = max(prev["end_time"], seg["end_time"])
            continue
        final.append({"start_time": seg["start_time"], "end_time": seg["end_time"], "chord": seg["chord"]})

    return final


def _refine_chord_starts_with_onsets(
    segments: list[dict[str, Any]],
    audio_path: Path,
    search_window: float = 0.18,
) -> list[dict[str, Any]]:
    """Pull chord start times back to the nearest harmonic onset.

    The CNN/CRF detectors place chord changes at the frame centre after
    processing, which is typically 80-180ms late. Onset detection on the
    separated harmonic stem finds the exact moment new harmonic content
    begins, which is where the chord actually starts in the audio.

    search_window: max seconds *before* the detected start to look for an
    onset. We never move a chord start *later* than the detected time.
    """
    if not segments:
        return segments

    try:
        signal, sr = librosa.load(audio_path, sr=22050, mono=True)
        # Harmonic component isolates pitched onsets from any remaining transients
        harmonic = librosa.effects.harmonic(signal, margin=3)
        onset_frames = librosa.onset.onset_detect(
            y=harmonic,
            sr=sr,
            hop_length=256,
            backtrack=True,          # backtrack to the energy trough before the onset peak
            units="frames",
        )
        onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=256)
        del signal, harmonic
    except Exception as exc:
        print(f"[onset] onset detection failed ({exc}), skipping refinement", file=sys.stderr)
        return segments

    if onset_times.size == 0:
        return segments

    refined: list[dict[str, Any]] = []
    for seg in segments:
        detected_start = float(seg["start_time"])
        # Find onsets in (detected_start - search_window, detected_start + 0.04)
        # The small positive tolerance handles tiny over-corrections in the detector
        lo = detected_start - search_window
        hi = detected_start + 0.04
        candidates = onset_times[(onset_times >= lo) & (onset_times <= hi)]

        if candidates.size > 0:
            # Use the latest onset before/at the detected start (closest to real change)
            best = float(candidates[candidates <= detected_start + 0.04].max()
                         if (candidates <= detected_start + 0.04).any()
                         else candidates[0])
            new_start = round(min(best, detected_start), 3)
        else:
            new_start = round(detected_start, 3)

        refined.append({**seg, "start_time": new_start})

    # Fix any end_times that now precede the next start
    for i in range(len(refined) - 1):
        if refined[i]["end_time"] > refined[i + 1]["start_time"]:
            refined[i]["end_time"] = refined[i + 1]["start_time"]

    onset_count = sum(1 for o, s in zip(refined, segments) if o["start_time"] < s["start_time"])
    print(f"[onset] refined {onset_count}/{len(segments)} chord starts earlier", file=sys.stderr)
    return refined


def detect_chord_events(
    audio_path: Path,
    detect_chords: bool,
    stem_mode: str = "demucs",
) -> tuple[list[dict[str, Any]], str | None]:
    if not detect_chords:
        return ([], None)

    os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "jam-mpl-cache"))

    tmp_file = separate_for_chords(audio_path, stem_mode)
    chord_source = tmp_file if tmp_file is not None else audio_path

    madmom_segs: list[dict[str, Any]] | None = None
    lv_segs: list[dict[str, Any]] | None = None
    results: list[dict[str, Any]] | None = None
    use_ensemble = False

    try:
        madmom_segs = _detect_chords_madmom(chord_source)
        print("[chords] madmom DeepChroma OK", file=sys.stderr)
    except Exception as exc:
        print(f"[chords] madmom failed ({exc})", file=sys.stderr)

    try:
        lv_segs = _detect_chords_lvchordia(chord_source)
        print("[chords] lv_chordia OK", file=sys.stderr)
    except Exception as exc:
        print(f"[chords] lv_chordia failed ({exc})", file=sys.stderr)

    # Keep tmp_file alive — onset refinement needs chord_source after this block

    if madmom_segs and lv_segs:
        print("[chords] ensemble: merging madmom + lv_chordia", file=sys.stderr)
        results = _ensemble_merge_chords(madmom_segs, lv_segs)
        use_ensemble = True
    elif madmom_segs:
        results = madmom_segs
        print("[chords] using madmom only (lv_chordia unavailable)", file=sys.stderr)
    elif lv_segs:
        results = lv_segs
        print("[chords] using lv_chordia only (madmom unavailable)", file=sys.stderr)
    else:
        print("[chords] both detectors failed", file=sys.stderr)

    if not results:
        return ([], None)

    smoothed_segments = _smooth_ensemble_segments(results) if use_ensemble else smooth_chord_segments(results)
    del results
    gc.collect()

    # Refine chord change timestamps using onset detection on the harmonic source.
    # The CNN/CRF detectors have inherent frame-window lag — they see a blend of audio
    # around each chord boundary and tend to place the change slightly late.
    # Onset detection finds the exact moment where new harmonic content begins,
    # giving us precise anchors to snap chord starts to.
    smoothed_segments = _refine_chord_starts_with_onsets(smoothed_segments, chord_source)

    # Now safe to delete the separated stem temp file
    if tmp_file is not None and tmp_file.exists():
        tmp_file.unlink()

    chord_key = infer_key_from_segments(smoothed_segments)
    chroma_key = detect_key_from_chromagram(audio_path)
    final_key = resolve_detected_key(chord_key, chroma_key)

    if final_key is not None:
        smoothed_segments = filter_chords_by_key(smoothed_segments, final_key)

    normalized_events: list[dict[str, Any]] = [
        {"time": item["start_time"], "chord": item["chord"]}
        for item in smoothed_segments
    ]

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

    ac_norm = float(autocorrelation[0] + 1e-8)
    autocorr_score = float(autocorrelation[lag]) / ac_norm

    # Sub-harmonic penalty: if the half-lag (double-time) autocorr peak is nearly
    # as strong as this candidate's peak, the true tempo is likely double this BPM.
    # This is the main cause of half-time errors (e.g. detecting 70 when true BPM is 140).
    half_lag = lag // 2
    if half_lag > 0 and half_lag < len(autocorrelation):
        double_bpm = bpm * 2.0
        if BPM_VALID_MIN <= double_bpm <= BPM_VALID_MAX:
            half_lag_score = float(autocorrelation[half_lag]) / ac_norm
            excess = half_lag_score - autocorr_score * 0.75
            if excess > 0:
                autocorr_score -= excess * 2.5

    # Soft genre-range preference — reduced from 1.25 to avoid overriding real signal.
    range_bonus = 0.6 if BPM_PREFERRED_MIN <= bpm <= BPM_PREFERRED_MAX else 0.0
    # Very soft center pull — was 0.035, that was too aggressive and dragged everything to 118.
    center_penalty = abs(bpm - BPM_PREFERRED_CENTER) * 0.008
    # Stronger weight on measured beat intervals — was 0.08, now 0.18.
    interval_penalty = 0.0 if inter_beat_bpm is None else min(abs(bpm - inter_beat_bpm), 40.0) * 0.18

    beat_grid = np.arange(0, len(onset_envelope), frames_per_beat)
    beat_indices = np.clip(np.round(beat_grid).astype(int), 0, len(onset_envelope) - 1)
    unique_indices = np.unique(beat_indices)
    grid_energy = float(np.mean(onset_envelope[unique_indices])) if unique_indices.size else 0.0
    baseline_energy = float(np.mean(onset_envelope)) + 1e-8
    grid_score = grid_energy / baseline_energy

    return autocorr_score * 5.0 + grid_score * 3.0 + range_bonus - center_penalty - interval_penalty


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


def snap_chord_events_to_beats(
    events: list[dict[str, Any]],
    beat_times: np.ndarray,
    bpm: float,
    max_snap_ratio: float = 0.22,
) -> list[dict[str, Any]]:
    """Snap chord event timestamps to the nearest beat or half-beat position.

    Most real chord changes land on beats or half-beats. Snapping eliminates
    frame-window jitter from fixed-hop detectors.

    max_snap_ratio: max snap distance as fraction of a beat (conservative —
    prevents snapping a chord *later* than it was detected, which feels behind).
    Snapping later than the detected time is capped at half the snap window.
    """
    if len(beat_times) < 2 or bpm <= 0 or not events:
        return events

    beat_interval = 60.0 / bpm
    half_interval = beat_interval / 2.0
    max_snap_seconds = beat_interval * max_snap_ratio
    # Only allow snapping *later* by half the window — bias toward early display
    max_snap_later = max_snap_seconds * 0.5

    # Build a dense grid: every beat + every half-beat
    half_beats = beat_times + half_interval
    grid = np.sort(np.concatenate([beat_times, half_beats]))

    snapped: list[dict[str, Any]] = []
    for event in events:
        t = float(event["time"])
        diffs = grid - t  # positive = grid point is later than detected
        abs_diffs = np.abs(diffs)
        nearest_idx = int(np.argmin(abs_diffs))
        distance = float(abs_diffs[nearest_idx])
        is_later = float(diffs[nearest_idx]) > 0

        # Don't snap if: too far, or snapping later than the looser cap
        if distance <= max_snap_seconds and not (is_later and distance > max_snap_later):
            snapped_time = round(float(grid[nearest_idx]), 3)
        else:
            snapped_time = round(t, 3)
        snapped.append({**event, "time": snapped_time})

    # Remove any events that collapsed to the same timestamp (keep the first)
    result: list[dict[str, Any]] = []
    for event in snapped:
        if result and result[-1]["time"] >= event["time"]:
            continue
        result.append(event)

    return result


def _to_wav_for_madmom(audio_path: Path) -> tuple[Path, bool]:
    """Return a mono 44100 Hz WAV that madmom can reliably read.

    madmom's audio loader requires ffmpeg for non-WAV formats and can also
    choke on stereo or non-standard-rate WAVs. We always write a fresh
    mono 44100 Hz PCM WAV to avoid all of these edge cases.
    """
    import soundfile as sf
    signal, _ = librosa.load(audio_path, sr=44100, mono=True)
    tmp = Path(tempfile.mktemp(suffix=".wav"))
    sf.write(str(tmp), signal, 44100, subtype="PCM_16")
    return tmp, True


def _detect_beats_madmom(audio_path: Path) -> tuple[float | None, float | None, np.ndarray]:
    """Beat tracking via madmom DBN beat tracker (RNN activations + Viterbi decoding).

    Significantly more accurate than librosa on syncopated rhythms and tracks
    with weak percussion. Falls back to librosa if unavailable.
    """
    _patch_collections_compat()
    from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor

    wav_path, is_tmp = _to_wav_for_madmom(audio_path)
    try:
        act = RNNBeatProcessor()(str(wav_path))
        beat_times: np.ndarray = DBNBeatTrackingProcessor(fps=100)(act)
    finally:
        if is_tmp and wav_path.exists():
            wav_path.unlink()

    if len(beat_times) < 2:
        return None, None, np.array([])

    intervals = np.diff(beat_times)
    stable = intervals[(intervals > 0.2) & (intervals < 2.0)]
    if stable.size == 0:
        return None, None, beat_times

    raw_bpm = round(60.0 / float(np.median(stable)), 1)
    bpm = correct_bpm(raw_bpm)
    beat_start_time = float(beat_times[0])

    print(f"[beat] madmom DBN: bpm={bpm}", file=sys.stderr)
    return bpm, beat_start_time, beat_times


def _analyze_bpm_and_beats_librosa(audio_path: Path) -> tuple[float | None, float | None, np.ndarray]:
    signal, sample_rate = librosa.load(audio_path, sr=22050, mono=True)
    _, percussive = librosa.effects.hpss(signal)

    # Percussive onset: strong for drums/transients
    onset_percussive = librosa.onset.onset_strength(
        y=percussive,
        sr=sample_rate,
        hop_length=BPM_HOP_LENGTH,
        aggregate=np.median,
    )
    # Full-signal onset: catches melody and harmony beats when percussion is weak
    onset_full = librosa.onset.onset_strength(
        y=signal,
        sr=sample_rate,
        hop_length=BPM_HOP_LENGTH,
        aggregate=np.median,
    )
    del signal
    # Blend: percussive-dominant but full-signal fills in melodic content
    min_len = min(len(onset_percussive), len(onset_full))
    onset_envelope = 0.65 * onset_percussive[:min_len] + 0.35 * onset_full[:min_len]

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

    # PLP (Predominant Local Pulse): uses a different algorithm than beat_track and
    # is more robust to syncopation and off-beat rhythms. Good independent second opinion.
    try:
        pulse = librosa.beat.plp(
            onset_envelope=onset_envelope,
            sr=sample_rate,
            hop_length=BPM_HOP_LENGTH,
        )
        plp_tempi = librosa.feature.tempo(
            onset_envelope=pulse,
            sr=sample_rate,
            hop_length=BPM_HOP_LENGTH,
        )
        raw_tempi.extend(float(v) for v in np.asarray(plp_tempi).flatten() if np.isfinite(v))
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

    saved_beat_times = beat_times.copy()
    del percussive, onset_envelope, beat_frames, beat_times, autocorrelation
    gc.collect()
    print(f"[beat] librosa fallback: bpm={bpm}", file=sys.stderr)
    return bpm, beat_start_time, saved_beat_times


def analyze_bpm_and_beats(audio_path: Path) -> tuple[float | None, float | None, np.ndarray]:
    """Try madmom DBN first; fall back to librosa if madmom is unavailable."""
    try:
        result = _detect_beats_madmom(audio_path)
        if result[0] is not None:
            return result
    except Exception as exc:
        print(f"[beat] madmom failed ({exc}), falling back to librosa", file=sys.stderr)

    return _analyze_bpm_and_beats_librosa(audio_path)


def main() -> None:
    args = parse_args()
    audio_path = Path(args.audio_path)
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    if args.extract_stems:
        if not args.output:
            raise ValueError("--extract-stems requires --output <path>")
        extract_instrumental(audio_path, Path(args.output))
        print(json.dumps({"success": True}))
        return

    if args.skip_bpm:
        bpm, beat_start_time, beat_times = None, None, np.array([])
    else:
        bpm, beat_start_time, beat_times = analyze_bpm_and_beats(audio_path)
    chord_events, detected_key = detect_chord_events(
        audio_path=audio_path,
        detect_chords=args.detect_chords,
        stem_mode=args.stem_mode,
    )

    if chord_events and len(beat_times) >= 2 and bpm is not None:
        chord_events = snap_chord_events_to_beats(chord_events, beat_times, bpm)
        print(f"[beat-align] snapped {len(chord_events)} chord events to beat grid (bpm={bpm})", file=sys.stderr)

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
