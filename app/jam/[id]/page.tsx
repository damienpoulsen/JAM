"use client";

import { use } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, ValidationError } from "@formspree/react";
import ColorWheelPicker from "./components/ColorWheelPicker";
import Fretboard from "./components/Fretboard";
import LeftMenuPanel from "./components/LeftMenuPanel";
import OnboardingTour from "./components/OnboardingTour";
import OverlayControls from "./components/OverlayControls";
import VideoPanel from "./components/VideoPanel";
import PlaybackControls from "./components/PlaybackControls";
import MobileFretboardSettings from "./components/MobileFretboardSettings";
import MobilePlaybackControls from "./components/MobilePlaybackControls";
import {
    buildLayer,
    theorySettingsToLayerConfigs,
    DEFAULT_THEORY,
    type TheorySettings,
    type Layer,
} from "@/lib/layers";
import { mergeLayers } from "../../../lib/layerManager";
import { getSongAnalysis, type AnalysisChordEvent } from "../../../lib/analysis";
import { getFile, saveFile } from "../../../lib/db";
import { readSongs, SONGS_STORAGE_KEY, type Song, writeSongs } from "../../../lib/songs";

const PUBLIC_ANALYSIS_API_URL = process.env.NEXT_PUBLIC_ANALYSIS_API_URL?.replace(/\/$/, "") ?? "";

const emptySong: Song = {
    name: "",
    bpm: 70,
    key: "Unknown",
    id: "",
    fileId: "",
    analysisStatus: "ready",
};

type NoteDisplayMode = "notes" | "intervals";
type LoopRange = { start: number; end: number };
type PanelView = "main" | "page-bg" | "fretboard" | "control-center" | "playback" | "chord-display";
type BgMode = "gradient" | "solid";
type TextColorMode = "white" | "black";

type ColorPreset = {
    id: string;
    name: string;
    bgColor: string;
    bgAccentColor: string;
    bgMode: BgMode;
    boardColor: string;
    stringColor: string;
    markerColor: string;
    fretLabelTextColor: TextColorMode;
    noteTextColor: TextColorMode;
    chordDisplayColor: string;
    controlCenterColor: string;
    playheadColor: string;
    playbackContentColor: string;
    leftBarColor: string;
    panelTextMode: "light" | "dark";
};

const PRESETS_KEY = "jam-color-presets";

function readPresets(): ColorPreset[] {
    if (typeof window === "undefined") return [];
    try {
        const stored = localStorage.getItem(PRESETS_KEY);
        return stored ? (JSON.parse(stored) as ColorPreset[]) : [];
    } catch { return []; }
}

function savePresetsToStorage(presets: ColorPreset[]): void {
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch {}
}
const DISPLAY_NOTE_INDEX: Record<string, number> = {
    C: 0,
    "B#": 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    Fb: 4,
    F: 5,
    "E#": 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
    Cb: 11,
};
const INTERVAL_LABELS = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];

// Timeline helpers keep the chord display predictable even if incoming chord data is messy.
function normalizeChordTimeline(timeline: AnalysisChordEvent[] | undefined): AnalysisChordEvent[] {
    if (!timeline) {
        return [];
    }

    return timeline
        .filter(
            (event): event is AnalysisChordEvent =>
                Boolean(event) &&
                Number.isFinite(event.time) &&
                typeof event.chord === "string" &&
                event.chord.trim().length > 0
        )
        .map((event) => ({
            time: event.time,
            chord: event.chord.trim(),
        }))
        .sort((a, b) => a.time - b.time);
}

// Show chords slightly early so the visual change feels in sync with the audio.
// Human auditory processing has ~50ms latency, so displaying 50ms ahead compensates.
const CHORD_LOOKAHEAD_SECONDS = 0.10;

function getChordDisplayState(timeline: AnalysisChordEvent[], playbackTime: number) {
    const lookupTime = playbackTime + CHORD_LOOKAHEAD_SECONDS;

    if (timeline.length === 0) {
        return {
            currentChord: "",
            nextChord: "",
            chordIndex: -1,
        };
    }

    if (lookupTime < timeline[0].time) {
        return {
            currentChord: "",
            nextChord: timeline[0].chord,
            chordIndex: -1,
        };
    }

    for (let index = timeline.length - 1; index >= 0; index -= 1) {
        if (lookupTime >= timeline[index].time) {
            return {
                currentChord: timeline[index].chord,
                nextChord: timeline[index + 1]?.chord || "",
                chordIndex: index,
            };
        }
    }

    return {
        currentChord: "",
        nextChord: timeline[0]?.chord || "",
        chordIndex: -1,
    };
}

function getDisplayReferenceNoteIndex(currentChord: string, songKey: string): number | null {
    const source = currentChord || songKey;
    const match = source.trim().match(/^([A-G](?:#|b)?)/);
    if (!match) {
        return null;
    }

    const noteIndex = DISPLAY_NOTE_INDEX[match[1]];
    return noteIndex === undefined ? null : noteIndex;
}

type ChordLabelMode = "off" | "roman" | "number" | "theory";

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
const ROMAN_MAJOR = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const ROMAN_MINOR = ["i", "ii°", "III", "iv", "v", "VI", "VII"];
const NUMBER_DEGREE = ["1", "2", "3", "4", "5", "6", "7"];
const THEORY_MAJOR = ["Tonic", "Supertonic", "Mediant", "Subdominant", "Dominant", "Submediant", "Leading Tone"];
const THEORY_MINOR = ["Tonic", "Supertonic", "Mediant", "Subdominant", "Dominant", "Submediant", "Subtonic"];

function getChordLabel(chord: string, songKey: string, mode: ChordLabelMode): string {
    if (mode === "off" || !chord || !songKey || songKey === "Unknown") return "";
    const keyMatch = songKey.trim().match(/^([A-G](?:#|b)?)(m)?/);
    if (!keyMatch) return "";
    const keyIdx = DISPLAY_NOTE_INDEX[keyMatch[1]];
    if (keyIdx === undefined) return "";
    const keyIsMinor = !!keyMatch[2];
    const chordMatch = chord.trim().match(/^([A-G](?:#|b)?)/);
    if (!chordMatch) return "";
    const chordIdx = DISPLAY_NOTE_INDEX[chordMatch[1]];
    if (chordIdx === undefined) return "";
    const interval = ((chordIdx - keyIdx) + 12) % 12;
    const scale = keyIsMinor ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;
    const degree = scale.indexOf(interval);
    if (degree === -1) return "";
    if (mode === "roman") return (keyIsMinor ? ROMAN_MINOR : ROMAN_MAJOR)[degree];
    if (mode === "number") return NUMBER_DEGREE[degree];
    return (keyIsMinor ? THEORY_MINOR : THEORY_MAJOR)[degree];
}

// Song helpers normalize localStorage data so the page can survive stale or partial records.
function normalizeSong(song: Partial<Song> | null | undefined, fallbackId = ""): Song {
    const rawBpm = song?.bpm;
    const normalizedBpm =
        typeof rawBpm === "number"
            ? (Number.isFinite(rawBpm) && rawBpm >= 0 ? rawBpm : "--")
            : typeof rawBpm === "string"
                ? (rawBpm.trim() ? rawBpm.trim() : "--")
                : "--";

    return {
        id: typeof song?.id === "string" && song.id.trim() ? song.id : fallbackId,
        fileId: typeof song?.fileId === "string" ? song.fileId : "",
        name: typeof song?.name === "string" && song.name.trim() ? song.name.trim() : "Unknown Song",
        key: typeof song?.key === "string" && song.key.trim() ? song.key.trim() : "Unknown",
        bpm: normalizedBpm,
        analysisStatus:
            song?.analysisStatus === "pending" ||
                song?.analysisStatus === "loading" ||
                song?.analysisStatus === "ready" ||
                song?.analysisStatus === "error"
                ? song.analysisStatus
                : "ready",
    };
}

function formatDisplayedBpmValue(value: number | string | null | undefined): number | string {
    if (typeof value === "number") {
        return Number.isFinite(value) ? Math.round(value) : "--";
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return "--";
        }

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? Math.round(parsed) : trimmed;
    }

    return "--";
}

function readTheorySettings(songId: string): TheorySettings {
    if (typeof window === "undefined") return DEFAULT_THEORY;
    try {
        const stored = localStorage.getItem(`jam-theory-${songId}`);
        if (!stored) return DEFAULT_THEORY;
        const raw = JSON.parse(stored) as Record<string, unknown>;
        // Migrate from old field names
        if ("baseKind" in raw) {
            return {
                layer1Kind: raw.baseKind === "off" ? null : (raw.baseKind as TheorySettings["layer1Kind"]),
                layer1Color: (raw.baseColor as string) ?? DEFAULT_THEORY.layer1Color,
                layer1Interval: null,
                layer2Kind: (raw.overlayKind as TheorySettings["layer2Kind"]) ?? null,
                layer2Color: (raw.overlayColor as string) ?? DEFAULT_THEORY.layer2Color,
                layer2Interval: (raw.overlayInterval as number | null) ?? null,
                layer2Filled: (raw.overlayFilled as boolean) ?? false,
                layer3Kind: (raw.overlay2Kind as TheorySettings["layer3Kind"]) ?? null,
                layer3Color: (raw.overlay2Color as string) ?? DEFAULT_THEORY.layer3Color,
                layer3Interval: (raw.overlay2Interval as number | null) ?? null,
            };
        }
        return raw as TheorySettings;
    } catch { return DEFAULT_THEORY; }
}

function saveTheorySettings(songId: string, settings: TheorySettings): void {
    try { localStorage.setItem(`jam-theory-${songId}`, JSON.stringify(settings)); } catch {}
}

function readSongRecord(id: string): { song: Song; found: boolean } {
    if (typeof window === "undefined") {
        return {
            song: normalizeSong({ ...emptySong, id }, id),
            found: false,
        };
    }

    const stored = localStorage.getItem(SONGS_STORAGE_KEY);
    if (!stored) {
        return {
            song: normalizeSong({ ...emptySong, id }, id),
            found: false,
        };
    }

    try {
        const songs = readSongs();
        const matchedSong = songs.find((song) => song.id === id);

        return {
            song: normalizeSong(matchedSong ?? { ...emptySong, id }, id),
            found: Boolean(matchedSong),
        };
    } catch {
        return {
            song: normalizeSong({ ...emptySong, id }, id),
            found: false,
        };
    }
}

function saveSong(updatedSong: Song) {
    if (typeof window === "undefined") {
        return;
    }

    if (!updatedSong.id) {
        return;
    }

    try {
        const songs = readSongs();
        const normalizedSong = normalizeSong(updatedSong, updatedSong.id);
        const existingIndex = songs.findIndex((song) => song.id === normalizedSong.id);

        const updatedSongs =
            existingIndex === -1
                ? [...songs, normalizedSong]
                : songs.map((song, index) => (index === existingIndex ? normalizedSong : song));

        writeSongs(updatedSongs);
    } catch (error) {
        console.error("Failed to save song", error);
    }
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [tourActive, setTourActive] = useState(false);
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get("tour") === "true") {
            setTourActive(true);
        }
    }, []);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const metronomeAudioContextRef = useRef<AudioContext | null>(null);
    const metronomeBufferRef = useRef<AudioBuffer | null>(null);
    const metronomeIntervalRef = useRef<number | null>(null);
    const skipAudioResetRef = useRef(false);
    const songRecord = useMemo(() => readSongRecord(id), [id]);

    const [songDrafts, setSongDrafts] = useState<Record<string, Song>>({});
    const [audioURL, setAudioURL] = useState("");
    const [videoURL, setVideoURL] = useState<string | null>(null);
    const [videoMode, setVideoMode] = useState(false);
    const [loadedFileId, setLoadedFileId] = useState("");
    const [audioError, setAudioError] = useState("");
    const [ytImporting, setYtImporting] = useState(false);
    const [ytImportError, setYtImportError] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [masterVolume, setMasterVolume] = useState(1);
    const [noteDisplayMode, setNoteDisplayMode] = useState<NoteDisplayMode>("notes");
    const [tempoDisplayMode, setTempoDisplayMode] = useState<"percent" | "bpm">("percent");
    const [metronomeEnabled, setMetronomeEnabled] = useState(false);
    const [metronomeOpen, setMetronomeOpen] = useState(false);
    const [voxRemoval, setVoxRemoval] = useState(false);
    const [voxLoading, setVoxLoading] = useState(false);
    const [voxError, setVoxError] = useState("");
    const [instrumentalURL, setInstrumentalURL] = useState("");
    const [leftPanelOpen, setLeftPanelOpen] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [panelView, setPanelView] = useState<PanelView>("main");
    const [boardColor, setBoardColor] = useState("#fce6c5");
    const [stringColor, setStringColor] = useState("#000000");
    const [markerColor, setMarkerColor] = useState("#777777");
    const [bgColor, setBgColor] = useState("#000000");
    const [bgAccentColor, setBgAccentColor] = useState("#5b21b6");
    const [bgMode, setBgMode] = useState<BgMode>("solid");
    const [fretLabelTextColor, setFretLabelTextColor] = useState<TextColorMode>("black");
    const [noteTextColor, setNoteTextColor] = useState<TextColorMode>("white");
    const [chordDisplayColor, setChordDisplayColor] = useState("#ffffff");
    const [chordLabelMode, setChordLabelMode] = useState<ChordLabelMode>("roman");
    const [controlCenterColor, setControlCenterColor] = useState("#222222");
    const [playheadColor, setPlayheadColor] = useState("#222222");
    const [playbackContentColor, setPlaybackContentColor] = useState("#ffffff");
    const [leftBarColor, setLeftBarColor] = useState("#2f302d");
    const [panelTextMode, setPanelTextMode] = useState<"light" | "dark">("dark");
    const [presets, setPresets] = useState<ColorPreset[]>(() => readPresets());
    const [savingSlot, setSavingSlot] = useState<number | null>(null);
    const [presetNameDraft, setPresetNameDraft] = useState("");
    const [editingName, setEditingName] = useState(false);
    const [volumeOpen, setVolumeOpen] = useState(false);
    const [controlCenterOpen, setControlCenterOpen] = useState(false);
    const [fretDisplayMode, setFretDisplayMode] = useState<"12" | "24">("12");
    const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [feedbackState, submitFeedback] = useForm("maqadgga");
    const [keyOpen, setKeyOpen] = useState(false);
    const [theorySettings, setTheorySettings] = useState<TheorySettings>(() => readTheorySettings(id));
    const [loopMode, setLoopMode] = useState(false);
    const [loopRange, setLoopRange] = useState<LoopRange | null>(null);
    const [loopDraft, setLoopDraft] = useState<LoopRange | null>(null);
    const [metronomeBpmOverride, setMetronomeBpmOverride] = useState<{
        songId: string;
        bpm: number;
    } | null>(null);
    const song = songDrafts[id] ?? songRecord.song;
    const songFound = songRecord.found || Boolean(songDrafts[id]);

    const strings = 6;
    const frets = fretDisplayMode === "24" ? 24 : 12;
    const tuning = ["E", "A", "D", "G", "B", "E"];
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const tuningIndex = tuning.map((note) => notes.indexOf(note));
    const fretMarkers = fretDisplayMode === "24" ? [3, 5, 7, 9, 12, 15, 17, 19, 21, 24] : [3, 5, 7, 9, 12];

    const keyOptions = [
        "Unknown",
        "C", "C#", "D", "D#", "E", "F", "F#",
        "G", "G#", "A", "A#", "B",
        "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m",
        "Gm", "G#m", "Am", "A#m", "Bm",
    ];

    const numericSongBpm =
        typeof song.bpm === "number"
            ? (Number.isFinite(song.bpm) && song.bpm > 0 ? song.bpm : null)
            : typeof song.bpm === "string"
                ? (() => {
                    const parsed = Number(song.bpm);
                    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
                })()
                : null;
    const analysis = useMemo(() => getSongAnalysis(id, { bpm: numericSongBpm }), [id, numericSongBpm]);
    const displayBpm =
        analysis.bpm !== null
            ? formatDisplayedBpmValue(analysis.bpm)
            : formatDisplayedBpmValue(song.bpm);
    const initialMetronomeBpm = useMemo(() => {
        if (typeof displayBpm === "number" && Number.isFinite(displayBpm) && displayBpm > 0) {
            return displayBpm;
        }

        if (typeof song.bpm === "number" && Number.isFinite(song.bpm) && song.bpm > 0) {
            return Math.round(song.bpm);
        }

        if (typeof song.bpm === "string") {
            const parsed = Number(song.bpm);
            if (Number.isFinite(parsed) && parsed > 0) {
                return Math.round(parsed);
            }
        }

        return 100;
    }, [displayBpm, song.bpm]);
    const metronomeBpm =
        metronomeBpmOverride && metronomeBpmOverride.songId === id
            ? metronomeBpmOverride.bpm
            : initialMetronomeBpm;
    const chordTimeline = useMemo(() => normalizeChordTimeline(analysis.chordEvents), [analysis.chordEvents]);
    const progress = duration > 0 ? Math.max(0, Math.min((currentTime / duration) * 100, 100)) : 0;
    const { currentChord, nextChord } = useMemo(
        () => getChordDisplayState(chordTimeline, currentTime),
        [chordTimeline, currentTime]
    );
    const effectiveChord = currentChord || chordTimeline[0]?.chord || "";
    const chordLabel = getChordLabel(currentChord, song.key, chordLabelMode);
    const layers = useMemo(
        () =>
            theorySettingsToLayerConfigs(theorySettings)
                .map((config) => buildLayer(config, { songKey: song.key, currentChord: effectiveChord }))
                .filter((l): l is Layer => l !== null),
        [theorySettings, effectiveChord, song.key]
    );

    const mergedNotes = useMemo(() => mergeLayers(layers), [layers]);
    const mergedNoteMap = useMemo(
        () => new Map(mergedNotes.map((mergedNote) => [mergedNote.note, mergedNote])),
        [mergedNotes]
    );
    const displayReferenceNoteIndex = useMemo(
        () => getDisplayReferenceNoteIndex(currentChord, song.key),
        [currentChord, song.key]
    );

    const getDisplayedFretboardLabel = (noteIndex: number) => {
        if (noteDisplayMode === "notes" || displayReferenceNoteIndex === null) {
            return notes[noteIndex];
        }

        const intervalIndex = ((noteIndex - displayReferenceNoteIndex) % 12 + 12) % 12;
        return INTERVAL_LABELS[intervalIndex];
    };

    const formatTime = (time: number) => {
        if (!Number.isFinite(time) || time < 0) {
            return "0:00";
        }

        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const handleTimelineTouch = (event: React.TouchEvent<HTMLDivElement>) => {
        if (!isAudioAvailable) return;
        const touch = event.touches[0];
        if (!touch) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const percent = Math.max(0, Math.min((touch.clientX - rect.left) / rect.width, 1));
        const time = percent * duration;
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const visibleAudioError =
        songFound && !song.fileId
            ? "Audio file is unavailable for this song."
            : loadedFileId === song.fileId
                ? audioError
                : "";
    const isAudioAvailable = Boolean(audioURL) && loadedFileId === song.fileId && !visibleAudioError;

    const updateSong = useCallback((patch: Partial<Song>) => {
        const nextSong = normalizeSong({ ...song, ...patch }, song.id || id);
        setSongDrafts((currentDrafts) => ({
            ...currentDrafts,
            [id]: nextSong,
        }));
        saveSong(nextSong);
    }, [id, song]);

    const handleYoutubeImport = async () => {
        if (!song.youtubeUrl || ytImporting) return;
        setYtImporting(true);
        setYtImportError("");
        try {
            const res = await fetch("/api/extract-youtube", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: song.youtubeUrl }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { error?: string };
                throw new Error(err.error ?? "Failed to fetch audio");
            }
            const blob = await res.blob();
            const file = new File([blob], "track.mp3", { type: "audio/mpeg" });
            await saveFile(song.fileId, file);
            // reload the audio by briefly clearing the error state
            setAudioError("");
            const url = URL.createObjectURL(file);
            setAudioURL(url);
            setLoadedFileId(song.fileId);
        } catch (err) {
            setYtImportError(err instanceof Error ? err.message : "Failed to fetch audio");
        } finally {
            setYtImporting(false);
        }
    };

    const resetToDefaultColors = () => {
        setBgColor("#000000");
        setBgAccentColor("#5b21b6");
        setBgMode("solid");
        setBoardColor("#fce6c5");
        setStringColor("#000000");
        setMarkerColor("#777777");
        setFretLabelTextColor("black");
        setNoteTextColor("white");
        setChordDisplayColor("#ffffff");
        setControlCenterColor("#222222");
        setPlayheadColor("#222222");
        setPlaybackContentColor("#ffffff");
        setLeftBarColor("#2f302d");
        setPanelTextMode("dark");
    };

    const applyPreset = (preset: ColorPreset) => {
        setBgColor(preset.bgColor);
        setBgAccentColor(preset.bgAccentColor ?? "#5b21b6");
        setBgMode(preset.bgMode);
        setBoardColor(preset.boardColor);
        setStringColor(preset.stringColor);
        setMarkerColor(preset.markerColor);
        setFretLabelTextColor(preset.fretLabelTextColor);
        setNoteTextColor(preset.noteTextColor ?? "white");
        setChordDisplayColor(preset.chordDisplayColor);
        setControlCenterColor(preset.controlCenterColor);
        setPlayheadColor(preset.playheadColor);
        setPlaybackContentColor(preset.playbackContentColor ?? "#ffffff");
        setLeftBarColor(preset.leftBarColor);
        setPanelTextMode(preset.panelTextMode);
    };

    const confirmSavePreset = (slotIndex: number, name: string) => {
        const trimmed = name.trim() || `Preset ${slotIndex + 1}`;
        const newPreset: ColorPreset = {
            id: `${Date.now()}`,
            name: trimmed,
            bgColor,
            bgAccentColor,
            bgMode,
            boardColor,
            stringColor,
            markerColor,
            fretLabelTextColor,
            noteTextColor,
            chordDisplayColor,
            controlCenterColor,
            playheadColor,
            playbackContentColor,
            leftBarColor,
            panelTextMode,
        };
        const next = [...presets];
        next[slotIndex] = newPreset;
        setPresets(next);
        savePresetsToStorage(next);
        setSavingSlot(null);
        setPresetNameDraft("");
    };

    const deletePreset = (slotIndex: number) => {
        const next = [...presets];
        next.splice(slotIndex, 1);
        setPresets(next);
        savePresetsToStorage(next);
    };

    const updatePlaybackRate = (nextRate: number) => {
        const normalizedRate = Math.max(0.5, Math.min(nextRate, 1.5));
        setPlaybackRate(Number(normalizedRate.toFixed(2)));
    };

    useEffect(() => { setTheorySettings(readTheorySettings(id)); }, [id]);
    useEffect(() => { saveTheorySettings(id, theorySettings); }, [id, theorySettings]);

    useEffect(() => {
        if (typeof screen !== "undefined" && "orientation" in screen) {
            (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })
                .lock?.("portrait")
                ?.catch(() => {});
        }
    }, []);

    // Audio file loading lives separately from song metadata so one can fail without killing the page.
    useEffect(() => {
        if (!song.fileId) {
            return;
        }

        let url = "";
        let videoObjectUrl = "";
        let active = true;
        const targetFileId = song.fileId;

        const load = async () => {
            try {
                const file = await getFile(targetFileId);
                if (!active) {
                    return;
                }

                if (!file) {
                    setLoadedFileId(targetFileId);
                    setAudioURL("");
                    setVideoURL(null);
                    setVideoMode(false);
                    if (panelView === "control-center") setPanelView("main");
                    setAudioError("Audio file is unavailable for this song.");
                    return;
                }

                url = URL.createObjectURL(file);
                setLoadedFileId(targetFileId);
                setAudioURL(url);
                setAudioError("");

                if (file.type.startsWith("video/")) {
                    videoObjectUrl = URL.createObjectURL(file);
                    setVideoURL(videoObjectUrl);
                } else {
                    setVideoURL(null);
                    setVideoMode(false);
                    if (panelView === "control-center") setPanelView("main");
                }
            } catch (error) {
                console.error("Failed to load audio file", error);
                if (!active) {
                    return;
                }

                setLoadedFileId(targetFileId);
                setAudioURL("");
                setVideoURL(null);
                setVideoMode(false);
                setAudioError("Audio file could not be loaded.");
            }
        };

        void load();

        return () => {
            active = false;
            if (url) {
                URL.revokeObjectURL(url);
            }
            if (videoObjectUrl) {
                URL.revokeObjectURL(videoObjectUrl);
            }
        };
    }, [song.fileId]);

    // Audio element events drive the transport, chord timing, and playhead UI.
    useEffect(() => {
        if (videoMode) return; // Video element handles transport in video mode
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        const updateTime = () => setCurrentTime(audio.currentTime);
        const setMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onSeek = () => setCurrentTime(audio.currentTime);
        const onEnded = () => {
            setIsPlaying(false);
            setCurrentTime(audio.duration || 0);
        };
        const onSourceReset = () => {
            if (skipAudioResetRef.current) return;
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);
        };

        audio.addEventListener("timeupdate", updateTime);
        audio.addEventListener("loadedmetadata", setMeta);
        audio.addEventListener("durationchange", setMeta);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("seeking", onSeek);
        audio.addEventListener("seeked", onSeek);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("emptied", onSourceReset);
        audio.addEventListener("loadstart", onSourceReset);

        return () => {
            audio.removeEventListener("timeupdate", updateTime);
            audio.removeEventListener("loadedmetadata", setMeta);
            audio.removeEventListener("durationchange", setMeta);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("seeking", onSeek);
            audio.removeEventListener("seeked", onSeek);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("emptied", onSourceReset);
            audio.removeEventListener("loadstart", onSourceReset);
        };
    }, [audioURL, videoMode]);

    // Video element events — mirrors the audio effect, active only in video mode.
    useEffect(() => {
        if (!videoMode) return;
        const video = videoRef.current;
        if (!video) return;

        const updateTime = () => setCurrentTime(video.currentTime);
        const setMeta = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onSeek = () => setCurrentTime(video.currentTime);
        const onEnded = () => {
            setIsPlaying(false);
            setCurrentTime(video.duration || 0);
        };
        const onSourceReset = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);
        };

        video.addEventListener("timeupdate", updateTime);
        video.addEventListener("loadedmetadata", setMeta);
        video.addEventListener("durationchange", setMeta);
        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);
        video.addEventListener("seeking", onSeek);
        video.addEventListener("seeked", onSeek);
        video.addEventListener("ended", onEnded);
        video.addEventListener("emptied", onSourceReset);
        video.addEventListener("loadstart", onSourceReset);

        return () => {
            video.removeEventListener("timeupdate", updateTime);
            video.removeEventListener("loadedmetadata", setMeta);
            video.removeEventListener("durationchange", setMeta);
            video.removeEventListener("play", onPlay);
            video.removeEventListener("pause", onPause);
            video.removeEventListener("seeking", onSeek);
            video.removeEventListener("seeked", onSeek);
            video.removeEventListener("ended", onEnded);
            video.removeEventListener("emptied", onSourceReset);
            video.removeEventListener("loadstart", onSourceReset);
        };
    }, [videoMode, videoURL]);

    useEffect(() => {
        if (!isPlaying) {
            return;
        }

        let frameId = 0;

        const syncPlaybackTime = () => {
            const source = videoRef.current ?? audioRef.current;
            if (!source) {
                return;
            }

            setCurrentTime(source.currentTime);
            frameId = window.requestAnimationFrame(syncPlaybackTime);
        };

        frameId = window.requestAnimationFrame(syncPlaybackTime);

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [isPlaying]);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio) audio.playbackRate = playbackRate;
        const video = videoRef.current;
        if (video) video.playbackRate = playbackRate;
    }, [playbackRate, audioURL, videoURL]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        audio.volume = masterVolume;
    }, [audioURL, masterVolume]);

    useEffect(() => {
        if (!voxError) return;
        const id = setTimeout(() => setVoxError(""), 7000);
        return () => clearTimeout(id);
    }, [voxError]);

    // Clean up instrumental blob URL when song changes or component unmounts
    useEffect(() => {
        return () => {
            if (instrumentalURL) URL.revokeObjectURL(instrumentalURL);
        };
    }, [instrumentalURL]);

    const toggleVoxRemoval = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return;

        const savedTime = audio.currentTime;
        const wasPlaying = !audio.paused;

        const applySrc = (newSrc: string) => {
            skipAudioResetRef.current = true;
            audio.src = newSrc;
            audio.addEventListener("canplay", () => {
                skipAudioResetRef.current = false;
                audio.currentTime = savedTime;
                if (wasPlaying) void audio.play();
            }, { once: true });
        };

        if (voxRemoval) {
            applySrc(audioURL);
            setVoxRemoval(false);
            setInstrumentalURL("");
            return;
        }

        // Try cache first (no pause needed — instant switch)
        const instrKey = `${song.fileId}-instrumental`;
        const cached = await getFile(instrKey);

        if (cached) {
            const url = URL.createObjectURL(cached);
            if (instrumentalURL) URL.revokeObjectURL(instrumentalURL);
            applySrc(url);
            setInstrumentalURL(url);
            setVoxRemoval(true);
            return;
        }

        // Not cached — run Demucs (pause while processing)
        setVoxLoading(true);
        if (wasPlaying) audio.pause();

        try {
            const originalFile = await getFile(song.fileId);
            if (!originalFile) throw new Error("Audio file unavailable");

            const fd = new FormData();
            fd.append("file", originalFile);

            const endpoint = PUBLIC_ANALYSIS_API_URL
                ? `${PUBLIC_ANALYSIS_API_URL}/extract-stems`
                : "/api/extract-stems";

            const res = await fetch(endpoint, { method: "POST", body: fd });
            if (!res.ok) throw new Error("Stem extraction failed — try again.");

            const blob = await res.blob();
            await saveFile(instrKey, new File([blob], "instrumental.wav", { type: "audio/wav" }));

            const url = URL.createObjectURL(blob);
            if (instrumentalURL) URL.revokeObjectURL(instrumentalURL);
            applySrc(url);
            setInstrumentalURL(url);
            setVoxRemoval(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "VOX removal failed";
            setVoxError(msg);
            if (wasPlaying) void audio.play();
        } finally {
            setVoxLoading(false);
        }
    }, [voxRemoval, instrumentalURL, audioURL, song.fileId]);

    const togglePlay = () => {
        const transport = videoRef.current ?? audioRef.current;
        if (!transport || !isAudioAvailable) {
            return;
        }

        if (transport.paused) {
            void transport.play();
        } else {
            transport.pause();
        }
    };

    const handleTourRequestPlay = useCallback(() => {
        const audio = audioRef.current;
        if (audio && isAudioAvailable && audio.paused) {
            void audio.play();
        }
    }, [isAudioAvailable]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault();
                togglePlay();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isAudioAvailable, audioURL, videoMode]);

    const toggleLoopMode = () => {
        setLoopMode((currentMode) => {
            if (currentMode) {
                setLoopRange(null);
                setLoopDraft(null);
            }

            return !currentMode;
        });
    };

    const enterVideoMode = () => {
        audioRef.current?.pause();
        setControlCenterOpen(false);
        setVideoMode(true);
    };

    const exitVideoMode = () => {
        const video = videoRef.current;
        const audio = audioRef.current;
        const savedTime = video?.currentTime ?? 0;
        video?.pause();
        if (audio) {
            skipAudioResetRef.current = true;
            audio.addEventListener("canplay", () => {
                skipAudioResetRef.current = false;
                audio.currentTime = savedTime;
            }, { once: true });
        }
        setVideoMode(false);
    };

    const loadMetronomeBuffer = useCallback(async () => {
        if (metronomeBufferRef.current) {
            return metronomeBufferRef.current;
        }

        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) {
            throw new Error("Web Audio is unavailable in this browser.");
        }

        const context = metronomeAudioContextRef.current ?? new AudioContextCtor();
        metronomeAudioContextRef.current = context;

        const response = await fetch("/metronomes/Perc_MetronomeQuartz_lo.wav");
        if (!response.ok) {
            throw new Error("Metronome sound could not be loaded.");
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
        metronomeBufferRef.current = buffer;
        return buffer;
    }, []);

    const playMetronomeClick = useCallback(async () => {
        const buffer = await loadMetronomeBuffer();
        const context = metronomeAudioContextRef.current;
        if (!context) {
            return;
        }

        if (context.state === "suspended") {
            await context.resume();
        }

        const source = context.createBufferSource();
        const gainNode = context.createGain();
        source.buffer = buffer;
        gainNode.gain.value = 0.85;
        source.connect(gainNode);
        gainNode.connect(context.destination);
        source.start();
    }, [loadMetronomeBuffer]);

    useEffect(() => {
        if (!metronomeEnabled || metronomeBpm <= 0) {
            if (metronomeIntervalRef.current !== null) {
                window.clearInterval(metronomeIntervalRef.current);
                metronomeIntervalRef.current = null;
            }
            return;
        }

        let cancelled = false;
        const intervalMs = Math.max(120, Math.round((60_000 / metronomeBpm)));

        void playMetronomeClick().catch(() => undefined);

        metronomeIntervalRef.current = window.setInterval(() => {
            if (cancelled) {
                return;
            }

            void playMetronomeClick().catch(() => undefined);
        }, intervalMs);

        return () => {
            cancelled = true;
            if (metronomeIntervalRef.current !== null) {
                window.clearInterval(metronomeIntervalRef.current);
                metronomeIntervalRef.current = null;
            }
        };
    }, [metronomeBpm, metronomeEnabled, playMetronomeClick]);

    useEffect(() => {
        return () => {
            if (metronomeIntervalRef.current !== null) {
                window.clearInterval(metronomeIntervalRef.current);
            }

            if (metronomeAudioContextRef.current) {
                void metronomeAudioContextRef.current.close();
                metronomeAudioContextRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!loopMode || !loopRange || !isPlaying) {
            return;
        }

        let frameId = 0;

        const syncLoop = () => {
            const transport = videoRef.current ?? audioRef.current;
            if (!transport) {
                return;
            }

            if (transport.currentTime >= loopRange.end) {
                transport.currentTime = loopRange.start;
                setCurrentTime(loopRange.start);
            }

            frameId = window.requestAnimationFrame(syncLoop);
        };

        frameId = window.requestAnimationFrame(syncLoop);

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [isPlaying, loopMode, loopRange]);

    // When VOX is active in video mode, keep the instrumental audio in sync with the video.
    useEffect(() => {
        if (!videoMode || !voxRemoval || !instrumentalURL) return;
        const video = videoRef.current;
        const audio = audioRef.current;
        if (!video || !audio) return;

        const syncOnSeek = () => { audio.currentTime = video.currentTime; };
        const syncOnPlay = () => {
            audio.currentTime = video.currentTime;
            void audio.play().catch(() => undefined);
        };
        const syncOnPause = () => { audio.pause(); };

        video.addEventListener("seeked", syncOnSeek);
        video.addEventListener("play", syncOnPlay);
        video.addEventListener("pause", syncOnPause);

        return () => {
            video.removeEventListener("seeked", syncOnSeek);
            video.removeEventListener("play", syncOnPlay);
            video.removeEventListener("pause", syncOnPause);
        };
    }, [videoMode, voxRemoval, instrumentalURL, videoURL]);

    const isDarkPanel = panelTextMode === "dark";
    const panel = {
        border:        isDarkPanel ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.10)",
        label:         isDarkPanel ? "#8a8a72"               : "#6b5f52",
        text:          isDarkPanel ? "#dedad2"               : "#3d3028",
        divider:       isDarkPanel ? "rgba(255,255,255,0.07)": "rgba(0,0,0,0.08)",
        toggleBg:      isDarkPanel ? "rgba(0,0,0,0.35)"      : "rgba(0,0,0,0.08)",
        toggleBorder:  isDarkPanel ? "rgba(255,255,255,0.10)": "rgba(0,0,0,0.08)",
        activeBg:      isDarkPanel ? "#f0ebe0"               : "#1a1410",
        activeText:    isDarkPanel ? "#1a1410"               : "#f0ebe0",
        inactiveText:  isDarkPanel ? "rgba(255,255,255,0.38)": "#8a7d6a",
        rowHover:      isDarkPanel ? "rgba(255,255,255,0.06)": "rgba(0,0,0,0.05)",
        rowBorder:     isDarkPanel ? "rgba(255,255,255,0.06)": "rgba(0,0,0,0.06)",
        swatchBorder:  isDarkPanel ? "rgba(255,255,255,0.22)": "rgba(0,0,0,0.18)",
        chevron:       isDarkPanel ? "rgba(255,255,255,0.30)": "rgba(0,0,0,0.25)",
    };

    return (
        <div className="relative h-screen overflow-hidden" style={{ fontFamily: "'IBM Plex Mono', monospace", backgroundColor: bgMode === "gradient" ? "#000000" : bgColor, color: "white" }}>
          <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');`}</style>
            {bgMode === "gradient" && (
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: `linear-gradient(180deg, ${bgAccentColor}a3 0%, ${bgAccentColor}42 30%, ${bgAccentColor}13 60%, transparent 85%)`,
                    }}
                />
            )}
            <audio key={`${id}:${song.fileId || "no-file"}`} ref={audioRef} src={
                videoMode
                    ? (voxRemoval && instrumentalURL ? instrumentalURL : undefined)
                    : (voxRemoval && instrumentalURL ? instrumentalURL : (isAudioAvailable ? audioURL : undefined))
            } />

            {/* YouTube import overlay — shown when song has no audio but has a YouTube URL */}
            {visibleAudioError && song.youtubeUrl && !isAudioAvailable && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(7,6,16,0.88)", backdropFilter: "blur(12px)" }}>
                    <div className="flex flex-col items-center gap-5 text-center px-8 max-w-md">
                        <div style={{ color: "rgba(155,110,240,0.6)" }}>
                            <svg viewBox="0 0 24 24" width={44} height={44} fill="currentColor">
                                <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v2c0 2 .3 4.1.3 4.1s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.2 21.5 12 21.5 12 21.5s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.1v-2C23.3 9.1 23 7 23 7zM9.7 15.5V8.4l8.1 3.6-8.1 3.5z" />
                            </svg>
                        </div>
                        <div>
                            <div style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 22, color: "#ffffff", marginBottom: 8 }}>Fetch audio from YouTube?</div>
                            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, color: "rgba(165,118,248,0.55)", letterSpacing: "0.08em", lineHeight: 1.6 }}>
                                This song was loaded from the community library. Grab the audio to start jamming.
                            </div>
                        </div>
                        {ytImportError && (
                            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, color: "rgba(255,100,100,0.8)", letterSpacing: "0.06em" }}>{ytImportError}</div>
                        )}
                        <div className="flex flex-col items-center gap-3 w-full">
                            <button
                                type="button"
                                onClick={handleYoutubeImport}
                                disabled={ytImporting}
                                style={{ width: "100%", background: "rgba(10,6,22,0.97)", border: "1.5px solid rgba(130,60,220,0.65)", boxShadow: "0 0 14px rgba(110,40,210,0.5), 0 6px 20px rgba(0,0,0,0.5)", fontFamily: "'Courier Prime', monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: "white", borderRadius: 10, padding: "12px 24px", cursor: ytImporting ? "wait" : "pointer" }}
                            >
                                {ytImporting ? "FETCHING AUDIO…" : "FETCH AUDIO"}
                            </button>
                            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "rgba(165,118,248,0.35)", letterSpacing: "0.1em" }}>
                                ~20–60 SEC · SERVER PROCESSES AUDIO
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Backdrop for right customization panel */}
            {panelOpen && (
                <div
                    className="absolute inset-0 z-[39] hidden min-[900px]:block"
                    onClick={() => setPanelOpen(false)}
                />
            )}

            {/* Left panel + handle (slide together) */}
            <div
                className="absolute top-0 z-40 h-full transition-all duration-300 hidden min-[900px]:block"
                style={{ right: panelOpen ? "0px" : "-240px" }}
            >
                {/* Panel content */}
                <div className="h-full w-[240px] overflow-hidden border-l transition-colors duration-300" style={{ background: leftBarColor, borderColor: panel.border }}>
                    <div className="flex h-full flex-col overflow-y-auto">

                        {panelView === "main" ? (
                            /* ── Main settings menu ── */
                            <div className="flex flex-col px-4 pt-5 pb-4 gap-1">
                                {/* Header */}
                                <div className="mb-3 text-[13px] font-semibold uppercase tracking-[0.24em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.label }}>
                                    Color Options
                                </div>

                                {/* Component nav rows */}
                                {([
                                    { view: "page-bg",        label: "Page Background",  dot: bgMode === "gradient" ? bgAccentColor : bgColor },
                                    { view: "fretboard",      label: "Fretboard",        dot: boardColor },
                                    ...(videoURL ? [{ view: "control-center" as PanelView, label: "Control Center", dot: controlCenterColor }] : []),
                                    { view: "playback",       label: "Playback Controls",dot: playheadColor },
                                    { view: "chord-display",  label: "Chord Display",    dot: chordDisplayColor === "transparent" ? "#888888" : chordDisplayColor },
                                ] as { view: PanelView; label: string; dot: string }[]).map(({ view, label, dot }) => (
                                    <button
                                        key={view}
                                        type="button"
                                        onClick={() => setPanelView(view)}
                                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors"
                                        style={{ border: `1px solid ${panel.rowBorder}` }}
                                        onMouseEnter={e => (e.currentTarget.style.background = panel.rowHover)}
                                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: dot, border: `1px solid ${panel.swatchBorder}` }} />
                                            <span className="text-[12px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.text }}>{label}</span>
                                        </div>
                                        <span className="text-[13px]" style={{ color: panel.chevron }}>›</span>
                                    </button>
                                ))}

                                {/* Divider */}
                                <div className="my-3" style={{ height: 1, background: panel.divider }} />

                                {/* Presets section */}
                                <div className="mb-2 text-[13px] font-semibold uppercase tracking-[0.24em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.label }}>
                                    Presets
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    {[0, 1, 2].map((slotIndex) => {
                                        const preset = presets[slotIndex];
                                        if (savingSlot === slotIndex) {
                                            return (
                                                <div key={slotIndex} className="flex flex-col gap-1.5 rounded-lg p-2" style={{ border: `1px solid ${panel.rowBorder}`, background: panel.rowHover }}>
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Preset name…"
                                                        value={presetNameDraft}
                                                        onChange={e => setPresetNameDraft(e.target.value)}
                                                        onKeyDown={e => { if (e.key === "Enter") confirmSavePreset(slotIndex, presetNameDraft); if (e.key === "Escape") { setSavingSlot(null); setPresetNameDraft(""); } }}
                                                        className="w-full rounded bg-transparent px-1 py-0.5 text-[11px] outline-none"
                                                        style={{ color: panel.text, border: `1px solid ${panel.swatchBorder}`, fontFamily: "'IBM Plex Mono', monospace" }}
                                                    />
                                                    <div className="flex gap-1.5">
                                                        <button type="button" onClick={() => confirmSavePreset(slotIndex, presetNameDraft)} className="flex-1 rounded px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition" style={{ fontFamily: "'Rajdhani', sans-serif", background: panel.activeBg, color: panel.activeText }}>Save</button>
                                                        <button type="button" onClick={() => { setSavingSlot(null); setPresetNameDraft(""); }} className="rounded px-2 py-1 text-[10px] transition" style={{ color: panel.inactiveText }}>✕</button>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        if (preset) {
                                            return (
                                                <div key={slotIndex} className="flex items-center gap-1 rounded-lg px-3 py-2" style={{ border: `1px solid ${panel.rowBorder}` }}>
                                                    <button type="button" onClick={() => applyPreset(preset)} className="flex-1 truncate text-left text-[12px] font-semibold transition" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.text }}
                                                        onMouseEnter={e => ((e.target as HTMLElement).style.opacity = "0.7")}
                                                        onMouseLeave={e => ((e.target as HTMLElement).style.opacity = "1")}
                                                    >
                                                        {preset.name}
                                                    </button>
                                                    <button type="button" onClick={() => deletePreset(slotIndex)} className="shrink-0 px-1 text-[11px] transition" style={{ color: panel.inactiveText }}
                                                        onMouseEnter={e => ((e.target as HTMLElement).style.color = panel.text)}
                                                        onMouseLeave={e => ((e.target as HTMLElement).style.color = panel.inactiveText)}
                                                    >✕</button>
                                                </div>
                                            );
                                        }
                                        return (
                                            <button key={slotIndex} type="button" onClick={() => { setSavingSlot(slotIndex); setPresetNameDraft(""); }} className="rounded-lg px-3 py-2 text-left text-[11px] transition-colors" style={{ border: `1px dashed ${panel.swatchBorder}`, color: panel.inactiveText, fontFamily: "'Rajdhani', sans-serif" }}
                                                onMouseEnter={e => (e.currentTarget.style.color = panel.text)}
                                                onMouseLeave={e => (e.currentTarget.style.color = panel.inactiveText)}
                                            >
                                                + Save Current
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Divider */}
                                <div className="my-3" style={{ height: 1, background: panel.divider }} />

                                {/* Reset to defaults */}
                                <button
                                    type="button"
                                    onClick={resetToDefaultColors}
                                    className="w-full rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-70"
                                    style={{
                                        fontFamily: "'Rajdhani', sans-serif",
                                        color: panel.inactiveText,
                                        border: `1px dashed ${panel.swatchBorder}`,
                                    }}
                                >
                                    Reset to Default
                                </button>
                            </div>
                        ) : (
                            /* ── Sub-view ── */
                            <div className="flex flex-col px-4 pt-5 pb-4">
                                {/* Back + title */}
                                <button type="button" onClick={() => setPanelView("main")} className="mb-4 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.inactiveText }}
                                    onMouseEnter={e => (e.currentTarget.style.color = panel.text)}
                                    onMouseLeave={e => (e.currentTarget.style.color = panel.inactiveText)}
                                >
                                    ‹ Back
                                </button>
                                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.label }}>
                                    {{
                                        "page-bg":        "Page Background",
                                        "fretboard":      "Fretboard",
                                        ...(videoURL ? { "control-center": "Control Center" } : {}),
                                        "playback":       "Playback Controls",
                                        "chord-display":  "Chord Display",
                                    }[panelView]}
                                </div>

                                {/* ── Page Background ── */}
                                {panelView === "page-bg" && (
                                    <div className="flex flex-col gap-3">
                                        {/* Option A: Color Accent */}
                                        <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ border: `1px solid ${bgMode === "gradient" ? panel.text : panel.rowBorder}`, background: bgMode === "gradient" ? panel.rowHover : "transparent" }}>
                                            <button type="button" onClick={() => setBgMode("gradient")} className="flex items-center gap-2 text-left">
                                                <div className="h-3 w-3 shrink-0 rounded-full border-2 transition-all" style={{ borderColor: panel.text, background: bgMode === "gradient" ? panel.text : "transparent" }} />
                                                <div>
                                                    <div className="text-[12px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.text }}>Color Accent</div>
                                                    <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: panel.label }}>dark bg + glow</div>
                                                </div>
                                            </button>
                                            <ColorWheelPicker value={bgAccentColor} label="Accent Color" onChange={(c) => { setBgAccentColor(c); setBgMode("gradient"); }} trigger={(onClick) => (
                                                <button type="button" onClick={onClick} className="h-5 w-5 rounded-full transition hover:scale-110" style={{ backgroundColor: bgAccentColor, border: `2px solid ${panel.swatchBorder}` }} aria-label="Pick accent color" />
                                            )} />
                                        </div>
                                        {/* Option B: Full Color */}
                                        <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ border: `1px solid ${bgMode === "solid" ? panel.text : panel.rowBorder}`, background: bgMode === "solid" ? panel.rowHover : "transparent" }}>
                                            <button type="button" onClick={() => setBgMode("solid")} className="flex items-center gap-2 text-left">
                                                <div className="h-3 w-3 shrink-0 rounded-full border-2 transition-all" style={{ borderColor: panel.text, background: bgMode === "solid" ? panel.text : "transparent" }} />
                                                <div>
                                                    <div className="text-[12px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.text }}>Full Color</div>
                                                    <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: panel.label }}>replace background</div>
                                                </div>
                                            </button>
                                            <ColorWheelPicker value={bgColor} label="Background Color" onChange={(c) => { setBgColor(c); setBgMode("solid"); }} trigger={(onClick) => (
                                                <button type="button" onClick={onClick} className="h-5 w-5 rounded-full transition hover:scale-110" style={{ backgroundColor: bgColor, border: `2px solid ${panel.swatchBorder}` }} aria-label="Pick background color" />
                                            )} />
                                        </div>
                                    </div>
                                )}

                                {/* ── Fretboard ── */}
                                {panelView === "fretboard" && (
                                    <div className="flex flex-col gap-3">
                                        {([
                                            { label: "Board",   value: boardColor,  onChange: setBoardColor,  key: "board" },
                                            { label: "Strings", value: stringColor, onChange: setStringColor, key: "strings" },
                                            { label: "Markers", value: markerColor, onChange: setMarkerColor, key: "markers" },
                                        ]).map(({ label, value, onChange, key }) => (
                                            <div key={key} className="flex items-center justify-between">
                                                <span className="text-[12px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.text }}>{label}</span>
                                                <ColorWheelPicker value={value} label={label} onChange={onChange} trigger={(onClick) => (
                                                    <button type="button" onClick={onClick} className="h-5 w-5 rounded-full transition hover:scale-110" style={{ backgroundColor: value, border: `2px solid ${panel.swatchBorder}` }} aria-label={`Pick ${label} color`} />
                                                )} />
                                            </div>
                                        ))}
                                        {/* Label text toggle */}
                                        <div>
                                            <div className="mb-2 text-[9px] uppercase tracking-[0.18em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.label }}>Label Text</div>
                                            <div className="flex rounded-lg p-0.5" style={{ background: panel.toggleBg, border: `1px solid ${panel.toggleBorder}` }}>
                                                {(["white", "black"] as TextColorMode[]).map((mode) => (
                                                    <button key={mode} type="button" onClick={() => setFretLabelTextColor(mode)} className="flex-1 rounded-md py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-all duration-200" style={{ fontFamily: "'Rajdhani', sans-serif", background: fretLabelTextColor === mode ? panel.activeBg : "transparent", color: fretLabelTextColor === mode ? panel.activeText : panel.inactiveText }}>
                                                        {mode === "white" ? "White" : "Black"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Note label color toggle */}
                                        <div>
                                            <div className="mb-2 text-[9px] uppercase tracking-[0.18em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.label }}>Note Labels</div>
                                            <div className="flex rounded-lg p-0.5" style={{ background: panel.toggleBg, border: `1px solid ${panel.toggleBorder}` }}>
                                                {(["white", "black"] as TextColorMode[]).map((mode) => (
                                                    <button key={mode} type="button" onClick={() => setNoteTextColor(mode)} className="flex-1 rounded-md py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-all duration-200" style={{ fontFamily: "'Rajdhani', sans-serif", background: noteTextColor === mode ? panel.activeBg : "transparent", color: noteTextColor === mode ? panel.activeText : panel.inactiveText }}>
                                                        {mode === "white" ? "White" : "Black"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── Control Center ── */}
                                {videoURL && panelView === "control-center" && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.text }}>Bar Color</span>
                                        <ColorWheelPicker value={controlCenterColor} label="Control Center" onChange={setControlCenterColor} trigger={(onClick) => (
                                            <button type="button" onClick={onClick} className="h-5 w-5 rounded-full transition hover:scale-110" style={{ backgroundColor: controlCenterColor, border: `2px solid ${panel.swatchBorder}` }} aria-label="Pick control center color" />
                                        )} />
                                    </div>
                                )}

                                {/* ── Playback Controls ── */}
                                {panelView === "playback" && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[12px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.text }}>Container</span>
                                            <ColorWheelPicker value={playheadColor} label="Playback Container" onChange={setPlayheadColor} trigger={(onClick) => (
                                                <button type="button" onClick={onClick} className="h-5 w-5 rounded-full transition hover:scale-110" style={{ backgroundColor: playheadColor, border: `2px solid ${panel.swatchBorder}` }} aria-label="Pick playback bar color" />
                                            )} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[12px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.text }}>Content</span>
                                            <ColorWheelPicker value={playbackContentColor} label="Playback Content" onChange={setPlaybackContentColor} trigger={(onClick) => (
                                                <button type="button" onClick={onClick} className="h-5 w-5 rounded-full transition hover:scale-110" style={{ backgroundColor: playbackContentColor, border: `2px solid ${panel.swatchBorder}` }} aria-label="Pick playback content color" />
                                            )} />
                                        </div>
                                    </div>
                                )}

                                {/* ── Chord Display ── */}
                                {panelView === "chord-display" && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: panel.text }}>Chord Color</span>
                                        <ColorWheelPicker value={chordDisplayColor} label="Chord Display" onChange={setChordDisplayColor} trigger={(onClick) => (
                                            <button type="button" onClick={onClick} className="h-5 w-5 rounded-full transition hover:scale-110" style={{ backgroundColor: chordDisplayColor, border: `2px solid ${panel.swatchBorder}` }} aria-label="Pick chord display color" />
                                        )} />
                                    </div>
                                )}

                            </div>
                        )}

                    </div>
                </div>

                {/* Handle — rides on the left edge of the panel */}
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setPanelOpen(!panelOpen); }}
                >
                    <div
                        className="flex h-[40vh] w-[28px] items-center justify-center rounded-l-xl select-none"
                        style={{
                            background: leftBarColor,
                            borderTop: "1.5px solid #f4f4f5",
                            borderLeft: "1.5px solid #f4f4f5",
                            borderBottom: "1.5px solid #f4f4f5",
                            color: panel.text,
                        }}
                    >
                        {panelOpen ? "▶" : "◀"}
                    </div>
                </div>
            </div>

            {/* Hamburger button — desktop, right of JAM logo, z-50 to stay above content */}
            <button
                type="button"
                onClick={() => setLeftPanelOpen(true)}
                className={`absolute top-[18px] left-[136px] z-50 flex-col items-center justify-center gap-[5px] rounded-lg p-2 transition-opacity hover:opacity-70 ${leftPanelOpen ? "hidden" : "hidden min-[900px]:flex"}`}
                aria-label="Open menu"
                style={{ color: "rgba(255,255,255,0.5)" }}
            >
                <span className="block h-[2px] w-[18px] rounded-full bg-current" />
                <span className="block h-[2px] w-[18px] rounded-full bg-current" />
                <span className="block h-[2px] w-[18px] rounded-full bg-current" />
            </button>

            {/* Left menu panel */}
            <LeftMenuPanel
                isOpen={leftPanelOpen}
                onClose={() => setLeftPanelOpen(false)}
                panelColors={panel}
                leftBarColor={leftBarColor}
                theorySettings={theorySettings}
                onTheoryChange={setTheorySettings}
                songName={song.name}
                songId={id}
                onStartTour={() => setTourActive(true)}
                chordLabelMode={chordLabelMode}
                onChordLabelModeChange={setChordLabelMode}
            />

            <div className="hidden min-[900px]:flex relative h-full flex-col px-8 pt-0 pb-2">
                {/* Header / app branding */}
                <div className="flex items-center pb-2 pt-2 gap-3">
                    <div className="cursor-pointer select-none">
                        <svg viewBox="0 0 540 300" xmlns="http://www.w3.org/2000/svg" className="h-auto w-[100px]" aria-label="JAM">
                            <defs>
                                <filter id="j-glow" x="-20%" y="-30%" width="140%" height="160%">
                                    <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            </defs>
                            <text x="270" y="210" fontFamily="'Playfair Display', serif" fontWeight="900" fontSize={190} fill="rgba(255,255,255,0.12)" textAnchor="middle" letterSpacing={16} filter="url(#j-glow)">JAM</text>
                            <text x="270" y="210" fontFamily="'Playfair Display', serif" fontWeight="900" fontSize={190} fill="#ffffff" textAnchor="middle" letterSpacing={16}>JAM</text>
                        </svg>
                    </div>
                </div>

                <div className="-mt-14 flex flex-1 flex-col">
                    {!songFound ? (
                        /* Missing-song fallback state */
                        <div className="flex flex-1 items-center justify-center px-8">
                            <div className="w-full max-w-[720px] rounded-3xl border border-white/12 bg-black/35 px-8 py-10 text-center shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
                                <div className="text-3xl font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Song not found</div>
                                <p className="mt-3 text-base text-white/62">
                                    This jam page could not find a saved song record for the current id.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Top section: video mode = stable three-column row; normal mode = Key/BPM + big chord */}
                            {videoMode && videoURL ? (
                                <div className="relative flex items-start w-full gap-2" style={{ marginBottom: "-11px" }}>
                                    {/* Left column: spacer only — button is absolutely positioned in the outer div */}
                                    <div className="flex-shrink-0" style={{ width: "180px", height: "300px" }} />
                                    {/* Key / BPM — same as normal mode, floated above Control Center */}
                                    <div style={{ position: "absolute", top: "67px", left: "246px", zIndex: 30 }}>
                                        <div className="flex w-[220px] flex-col items-start gap-2">
                                            <div className="relative flex w-full items-center justify-start">
                                                <span className="mr-3 text-lg" style={{ color: "rgba(255,255,255,0.55)", width: "54px", display: "inline-block" }}>Key:</span>
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setKeyOpen(!keyOpen); }}
                                                        className="min-w-[120px] cursor-pointer rounded border-2 px-4 py-1 text-center text-lg border-white bg-black text-white shadow-[0_0_0_2px_rgba(255,255,255,0.2),0_0_14px_rgba(255,255,255,0.14)]"
                                                    >
                                                        {song.key}
                                                    </button>
                                                    {keyOpen && <div className="fixed inset-0 z-40" onClick={() => setKeyOpen(false)} />}
                                                    {keyOpen && (
                                                        <div className="absolute left-0 z-50 mt-2 rounded-xl border p-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)] border-white/12" style={{ width: 220, background: "#0f0f0f" }}>
                                                            <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: "rgba(255,255,255,0.55)" }}>Select Root Note</div>
                                                            <div className="grid grid-cols-4 gap-1.5">
                                                                {keyOptions.filter(k => k !== "Unknown" && !k.includes("m")).map((note) => (
                                                                    <button key={note} type="button" onClick={() => { updateSong({ key: note }); setKeyOpen(false); }} className="rounded-lg border py-2 text-sm font-semibold transition border-white/12 bg-white/5 text-white hover:border-white/40 hover:bg-white/15" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{note}</button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-start w-full">
                                                <span className="mr-3 text-lg" style={{ color: "rgba(255,255,255,0.55)", width: "54px", display: "inline-block" }}>BPM:</span>
                                                <input
                                                    type="number"
                                                    className="min-w-[120px] rounded border-2 px-4 py-1 text-center text-lg border-white bg-black text-white shadow-[0_0_0_2px_rgba(255,255,255,0.2),0_0_14px_rgba(255,255,255,0.14)]"
                                                    value={displayBpm === "--" ? "" : displayBpm}
                                                    onChange={(e) => updateSong({ bpm: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Control Center button: floats freely, no effect on other elements */}
                                    <button
                                        type="button"
                                        onClick={() => setControlCenterOpen((v) => !v)}
                                        className="flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] border transition-colors"
                                        style={{
                                            position: "absolute",
                                            bottom: "46px",
                                            left: "293px",
                                            background: controlCenterColor,
                                            color: controlCenterOpen ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)",
                                            borderColor: controlCenterOpen ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.10)",
                                            fontFamily: "'Rajdhani', sans-serif",
                                        }}
                                    >
                                        Control Center
                                    </button>
                                    {/* Center column: Video — fixed 300px tall, max 575px wide */}
                                    <div className="flex-1 min-w-0 flex justify-center">
                                        <div className="overflow-hidden rounded-xl" style={{ height: "300px", width: "100%", maxWidth: "575px" }}>
                                            <VideoPanel videoRef={videoRef} videoURL={videoURL} muted={voxRemoval && !!instrumentalURL} />
                                        </div>
                                    </div>
                                    {/* Right column: current chord, next chord, exit — shifted left to center on video/chord boundary */}
                                    <div className="flex-shrink-0 relative flex flex-col items-center gap-1 select-none pointer-events-none" style={{ width: "220px", left: "-230px" }}>
                                        <div className="w-full text-center font-bold leading-none" style={{ fontSize: "clamp(5rem,12vw,185px)", fontFamily: "'Playfair Display', serif", color: chordDisplayColor }}>
                                            {currentChord || "—"}
                                        </div>
                                        {chordLabel && (
                                            <div className="w-full text-left" style={{
                                                fontFamily: "'Rajdhani', sans-serif",
                                                fontWeight: 700,
                                                color: chordDisplayColor,
                                                opacity: 0.6,
                                                lineHeight: 1,
                                                fontSize: chordLabel.length <= 2
                                                    ? "clamp(1rem,2.5vw,32px)"
                                                    : chordLabel.length <= 4
                                                        ? "clamp(0.6rem,1.5vw,20px)"
                                                        : chordLabel.length <= 7
                                                            ? "clamp(0.5rem,0.9vw,12px)"
                                                            : "clamp(0.4rem,0.7vw,10px)",
                                            }}>
                                                {chordLabel}
                                            </div>
                                        )}
                                        <div className="w-full text-center leading-none" style={{ fontSize: "clamp(2.5rem,6.5vw,104px)", fontFamily: "'Playfair Display', serif", color: chordDisplayColor, opacity: 0.45, minHeight: "1.2em" }}>
                                            {nextChord && nextChord !== currentChord ? nextChord : ""}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ backgroundColor: "transparent" }}>
                                    {/* Top-right row: Key/BPM in normal mode */}
                                    <div className="relative z-30 mt-1 mb-0 flex justify-end">
                                        <div className="mt-1 mb-0 flex w-[220px] flex-col items-end gap-2">
                                            <div className="relative flex w-full items-center justify-end">
                                                <span className="mr-3 text-lg" style={{ color: "rgba(255,255,255,0.55)" }}>Key:</span>
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setKeyOpen(!keyOpen); }}
                                                        className="min-w-[120px] cursor-pointer rounded border-2 px-4 py-1 text-center text-lg border-white bg-black text-white shadow-[0_0_0_2px_rgba(255,255,255,0.2),0_0_14px_rgba(255,255,255,0.14)]"
                                                    >
                                                        {song.key}
                                                    </button>
                                                    {keyOpen && <div className="fixed inset-0 z-40" onClick={() => setKeyOpen(false)} />}
                                                    {keyOpen && (
                                                        <div className="absolute right-0 z-50 mt-2 rounded-xl border p-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)] border-white/12" style={{ width: 220, background: "#0f0f0f" }}>
                                                            <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: "rgba(255,255,255,0.55)" }}>Select Root Note</div>
                                                            <div className="grid grid-cols-4 gap-1.5">
                                                                {keyOptions.filter(k => k !== "Unknown" && !k.includes("m")).map((note) => (
                                                                    <button key={note} type="button" onClick={() => { updateSong({ key: note }); setKeyOpen(false); }} className="rounded-lg border py-2 text-sm font-semibold transition border-white/12 bg-white/5 text-white hover:border-white/40 hover:bg-white/15" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{note}</button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end w-full">
                                                <span className="mr-3 text-lg" style={{ color: "rgba(255,255,255,0.55)" }}>BPM:</span>
                                                <input
                                                    type="number"
                                                    className="min-w-[120px] rounded border-2 px-4 py-1 text-center text-lg border-white bg-black text-white shadow-[0_0_0_2px_rgba(255,255,255,0.2),0_0_14px_rgba(255,255,255,0.14)]"
                                                    value={displayBpm === "--" ? "" : displayBpm}
                                                    onChange={(e) => updateSong({ bpm: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Main chord area: big chord text in normal mode */}
                                    <div className="-mt-14 flex flex-col">
                                        <div data-tour="chords" className="pointer-events-none mb-6 mt-[-72px] flex items-start justify-center gap-10 px-4">
                                            <div className="relative">
                                                <div className="max-w-[70vw] truncate text-[clamp(7.5rem,15vw,248px)] font-bold leading-none drop-shadow-[0_10px_24px_rgba(0,0,0,0.25)]" style={{ color: chordDisplayColor }}>
                                                    {currentChord || "—"}
                                                </div>
                                                {chordLabel && (
                                                    <div className="absolute pointer-events-none" style={{ left: "-5rem", bottom: "3.75rem",
                                                        fontFamily: "'Rajdhani', sans-serif",
                                                        fontWeight: 700,
                                                        color: chordDisplayColor,
                                                        opacity: 0.6,
                                                        lineHeight: 1,
                                                        fontSize: chordLabel.length <= 2
                                                            ? "clamp(1.75rem,3.5vw,45px)"
                                                            : chordLabel.length <= 4
                                                                ? "clamp(1rem,2vw,28px)"
                                                                : chordLabel.length <= 7
                                                                    ? "clamp(0.65rem,1.2vw,16px)"
                                                                    : "clamp(0.5rem,0.9vw,12px)",
                                                    }}>
                                                        {chordLabel}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-16 max-w-[26vw] truncate text-[clamp(3.5rem,7vw,108px)] leading-none" style={{ color: chordDisplayColor ? `${chordDisplayColor}66` : "rgba(255,255,255,0.40)" }}>
                                                {nextChord}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Fretboard + controls */}
                            <div className={videoMode ? "flex flex-col" : "-mt-5 flex flex-col"}>
                                <div className={videoMode ? "flex flex-col" : "-mt-5 flex flex-col"}>
                                    {(!videoMode || controlCenterOpen) && (
                                        <OverlayControls
                                            barColor={controlCenterColor}
                                            audioError={visibleAudioError}
                                            theorySettings={theorySettings}
                                            onTheoryChange={setTheorySettings}
                                            loopMode={loopMode}
                                            metronomeBpm={metronomeBpm}
                                            metronomeEnabled={metronomeEnabled}
                                            metronomeOpen={metronomeOpen}
                                            noteDisplayMode={noteDisplayMode}
                                            onDecreaseTempo={() => updatePlaybackRate(playbackRate - 0.1)}
                                            onIncreaseTempo={() => updatePlaybackRate(playbackRate + 0.1)}
                                            onDecreaseMetronomeBpm={() =>
                                                setMetronomeBpmOverride({
                                                    songId: id,
                                                    bpm: Math.max(30, metronomeBpm - 1),
                                                })
                                            }
                                            onTempoDisplayModeChange={setTempoDisplayMode}
                                            onIncreaseMetronomeBpm={() =>
                                                setMetronomeBpmOverride({
                                                    songId: id,
                                                    bpm: Math.min(260, metronomeBpm + 1),
                                                })
                                            }
                                            onToggleLoopMode={toggleLoopMode}
                                            onToggleMetronome={() => setMetronomeEnabled((current) => !current)}
                                            onToggleMetronomeOpen={() => setMetronomeOpen((current) => !current)}
                                            onToggleNoteDisplayMode={() =>
                                                setNoteDisplayMode((currentMode) =>
                                                    currentMode === "notes" ? "intervals" : "notes"
                                                )
                                            }
                                            voxRemoval={voxRemoval}
                                            voxLoading={voxLoading}
                                            voxError={voxError}
                                            onToggleVoxRemoval={() => { void toggleVoxRemoval(); }}
                                            playbackRate={playbackRate}
                                            tempoDisplayMode={tempoDisplayMode}
                                            baseBpm={displayBpm === "--" ? null : typeof displayBpm === "number" ? displayBpm : Number(displayBpm) || null}
                                        />
                                    )}

                                    <div data-tour="fretboard">
                                    <Fretboard
                                        boardColorOverride={boardColor}
                                        stringColorOverride={stringColor}
                                        markerColorOverride={markerColor}
                                        labelTextColor={fretLabelTextColor}
                                        noteTextColor={noteTextColor}
                                        fretMarkers={fretMarkers}
                                        frets={frets}
                                        getDisplayedFretboardLabel={getDisplayedFretboardLabel}
                                        mergedNoteMap={mergedNoteMap}
                                        overlayFilled={theorySettings.layer2Filled}
                                        strings={strings}
                                        tuning={tuning}
                                        tuningIndex={tuningIndex}
                                        fretDisplayMode={fretDisplayMode}
                                        onToggleFretDisplay={() => setFretDisplayMode(m => m === "12" ? "24" : "12")}
                                    />
                                    </div>

                                    <PlaybackControls
                                        barColor={playheadColor}
                                        contentColor={playbackContentColor}
                                        currentTime={currentTime}
                                        duration={duration}
                                        editingName={editingName}
                                        formatTime={formatTime}
                                        isAudioAvailable={isAudioAvailable}
                                        isPlaying={isPlaying}
                                        loopDraft={loopDraft}
                                        loopMode={loopMode}
                                        loopRange={loopRange}
                                        masterVolume={masterVolume}
                                        onNameBlur={() => setEditingName(false)}
                                        onNameChange={(name) => updateSong({ name })}
                                        onNameContextMenu={(event) => {
                                            event.preventDefault();
                                            setEditingName(true);
                                        }}
                                        onLoopEdgeMouseDown={(edge, event) => {
                                            if (!isAudioAvailable || !loopRange) {
                                                return;
                                            }

                                            event.preventDefault();
                                            event.stopPropagation();

                                            const rect = event.currentTarget.parentElement?.getBoundingClientRect();
                                            if (!rect) {
                                                return;
                                            }

                                            const minimumLoopLength = 0.15;
                                            const getClampedTime = (clientX: number) => {
                                                const percent = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
                                                return Math.max(0, Math.min(percent * duration, duration));
                                            };

                                            setLoopDraft(loopRange);

                                            const move = (mouseEvent: MouseEvent) => {
                                                const nextTime = getClampedTime(mouseEvent.clientX);

                                                setLoopDraft((currentDraft) => {
                                                    const activeRange = currentDraft ?? loopRange;

                                                    if (edge === "start") {
                                                        return {
                                                            start: Math.min(nextTime, activeRange.end - minimumLoopLength),
                                                            end: activeRange.end,
                                                        };
                                                    }

                                                    return {
                                                        start: activeRange.start,
                                                        end: Math.max(nextTime, activeRange.start + minimumLoopLength),
                                                    };
                                                });
                                            };

                                            move(event.nativeEvent);

                                            window.addEventListener("mousemove", move);
                                            window.addEventListener(
                                                "mouseup",
                                                () => {
                                                    window.removeEventListener("mousemove", move);
                                                    setLoopDraft((currentDraft) => {
                                                        if (currentDraft) {
                                                            setLoopRange(currentDraft);
                                                        }

                                                        return null;
                                                    });
                                                },
                                                { once: true }
                                            );
                                        }}
                                        onLoopLaneMouseDown={(event) => {
                                            if (!isAudioAvailable) {
                                                return;
                                            }

                                            const rect = event.currentTarget.getBoundingClientRect();
                                            const getClampedTime = (clientX: number) => {
                                                const percent = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
                                                return Math.max(0, Math.min(percent * duration, duration));
                                            };

                                            const loopStart = getClampedTime(event.clientX);
                                            setLoopDraft({ start: loopStart, end: loopStart });

                                            const move = (mouseEvent: MouseEvent) => {
                                                const currentLoopTime = getClampedTime(mouseEvent.clientX);
                                                const normalizedRange = {
                                                    start: Math.min(loopStart, currentLoopTime),
                                                    end: Math.max(loopStart, currentLoopTime),
                                                };

                                                setLoopDraft(normalizedRange);
                                            };

                                            move(event.nativeEvent);

                                            window.addEventListener("mousemove", move);
                                            window.addEventListener(
                                                "mouseup",
                                                () => {
                                                    window.removeEventListener("mousemove", move);
                                                    setLoopDraft((currentDraft) => {
                                                        const audio = audioRef.current;

                                                        if (currentDraft && currentDraft.end - currentDraft.start >= 0.15) {
                                                            setLoopRange(currentDraft);
                                                            const loopTransport = videoRef.current ?? audio;
                                                            if (loopTransport) {
                                                                loopTransport.currentTime = currentDraft.start;
                                                            }
                                                            setCurrentTime(currentDraft.start);
                                                        } else {
                                                            setLoopRange(null);
                                                        }

                                                        return null;
                                                    });
                                                },
                                                { once: true }
                                            );
                                        }}
                                        onTimelineMouseDown={(event) => {
                                            if (!isAudioAvailable) {
                                                return;
                                            }

                                            const rect = event.currentTarget.getBoundingClientRect();
                                            const getClampedTime = (clientX: number) => {
                                                const percent = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
                                                return Math.max(0, Math.min(percent * duration, duration));
                                            };

                                            const move = (mouseEvent: MouseEvent) => {
                                                const transport = videoRef.current ?? audioRef.current;
                                                if (!transport) return;

                                                const nextTime = getClampedTime(mouseEvent.clientX);
                                                transport.currentTime = nextTime;
                                                setCurrentTime(nextTime);
                                            };

                                            move(event.nativeEvent);

                                            window.addEventListener("mousemove", move);
                                            window.addEventListener(
                                                "mouseup",
                                                () => {
                                                    window.removeEventListener("mousemove", move);
                                                },
                                                { once: true }
                                            );
                                        }}
                                        onTogglePlay={togglePlay}
                                        onToggleVolumeOpen={() => setVolumeOpen((current) => !current)}
                                        onVolumeChange={setMasterVolume}
                                        progress={progress}
                                        songName={song.name}
                                        volumeOpen={volumeOpen}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Video / Regular mode toggle (fixed bottom-left) ── */}
            {videoURL && (
                <button
                    type="button"
                    onClick={() => videoMode ? exitVideoMode() : enterVideoMode()}
                    className="fixed bottom-20 left-[58px] z-50 hidden min-[900px]:flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-all hover:border-white/40 hover:text-white"
                    style={{ fontFamily: "'Rajdhani', sans-serif", color: "rgba(255,255,255,0.80)", background: "rgba(255,255,255,0.06)", boxShadow: "0 0 10px rgba(255,255,255,0.25), 0 0 22px rgba(255,255,255,0.10)" }}
                >
                    {videoMode ? "Regular Mode" : "Video Mode"}
                </button>
            )}

            {/* ── Feedback button (fixed bottom-right) ── */}
            <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="fixed bottom-20 right-5 z-50 hidden min-[900px]:flex items-center gap-2 rounded-lg border border-white/30 bg-black/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 transition-all hover:text-white hover:border-white/60 backdrop-blur-sm"
                style={{ fontFamily: "'Rajdhani', sans-serif", boxShadow: "0 0 10px rgba(255,255,255,0.25), 0 0 22px rgba(255,255,255,0.10)" }}
            >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Share feedback
            </button>

            {/* ── Feedback modal ── */}
            {feedbackOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
                    onClick={(e) => { if (e.target === e.currentTarget) setFeedbackOpen(false); }}
                >
                    <div
                        className="w-full max-w-[480px] mx-4 rounded-2xl border border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
                        style={{ background: "#111111", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                        {feedbackState.succeeded ? (
                            <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
                                <div className="text-2xl font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Thanks!</div>
                                <p className="text-[13px] text-white/55">Your feedback helps make JAM better.</p>
                                <button
                                    type="button"
                                    onClick={() => setFeedbackOpen(false)}
                                    className="mt-2 rounded-lg px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition"
                                    style={{ fontFamily: "'Rajdhani', sans-serif", background: "#ffffff", color: "#111111" }}
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={submitFeedback} className="flex flex-col px-6 py-6 gap-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-[16px] font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: "0.06em" }}>Got thoughts? We&apos;re listening.</div>
                                        <div className="mt-0.5 text-[11px] text-white/40">Feature requests, bugs, ideas — all welcome.</div>
                                    </div>
                                    <button type="button" onClick={() => setFeedbackOpen(false)} className="text-white/30 hover:text-white/70 transition text-lg leading-none ml-4">✕</button>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <textarea
                                        autoFocus
                                        id="message"
                                        name="message"
                                        placeholder="Tell us what's on your mind…"
                                        rows={5}
                                        required
                                        className="w-full resize-none rounded-lg border border-white/12 bg-white/5 px-4 py-3 text-[12px] text-white placeholder-white/25 outline-none focus:border-white/25 transition"
                                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                    />
                                    <ValidationError field="message" errors={feedbackState.errors} className="text-[11px] text-red-400" />
                                </div>
                                <button
                                    type="submit"
                                    disabled={feedbackState.submitting}
                                    className="rounded-lg py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:opacity-40"
                                    style={{ fontFamily: "'Rajdhani', sans-serif", background: "#ffffff", color: "#111111" }}
                                >
                                    {feedbackState.submitting ? "Sending…" : "Send Feedback"}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ── Mobile layout (phones only, desktop untouched above) ── */}
            <div className="flex min-[900px]:hidden h-full flex-col overflow-hidden">

                {/* Mobile header — JAM logo + settings button */}
                <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
                    <svg viewBox="0 0 540 300" xmlns="http://www.w3.org/2000/svg" className="h-auto w-[72px]" aria-label="JAM">
                        <defs>
                            <filter id="m-glow" x="-20%" y="-30%" width="140%" height="160%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        </defs>
                        <text x="270" y="210" fontFamily="'Playfair Display', serif" fontWeight="900" fontSize={190} fill="rgba(255,255,255,0.10)" textAnchor="middle" letterSpacing={16} filter="url(#m-glow)">JAM</text>
                        <text x="270" y="210" fontFamily="'Playfair Display', serif" fontWeight="900" fontSize={190} fill="#ffffff" textAnchor="middle" letterSpacing={16}>JAM</text>
                    </svg>

                    <button
                        type="button"
                        onClick={() => setMobileSettingsOpen(true)}
                        className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-lg border border-white/25 bg-black/40"
                        aria-label="Settings"
                        data-tour="layers-btn"
                    >
                        <span className="block h-[2px] w-4 rounded-full bg-white/75" />
                        <span className="block h-[2px] w-4 rounded-full bg-white/75" />
                        <span className="block h-[2px] w-4 rounded-full bg-white/75" />
                    </button>
                </div>

                {/* Chord display */}
                <div className="flex h-[26%] flex-col items-center justify-end pb-3 px-4">
                    <div data-tour="chords" className="flex flex-col items-center">
                    <div
                        className="text-[clamp(6rem,29vw,12rem)] font-bold leading-none text-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                        style={{ color: chordDisplayColor || "#ffffff", fontFamily: "'Playfair Display', serif" }}
                    >
                        {currentChord || "—"}
                    </div>
                    {chordLabel && (
                        <div className="w-full text-center" style={{
                            fontFamily: "'Rajdhani', sans-serif",
                            fontWeight: 700,
                            color: chordDisplayColor || "#ffffff",
                            opacity: 0.6,
                            lineHeight: 1,
                            fontSize: chordLabel.length <= 2
                                ? "clamp(0.75rem,4vw,1.5rem)"
                                : chordLabel.length <= 4
                                    ? "clamp(0.5rem,2.5vw,1rem)"
                                    : "clamp(0.4rem,1.75vw,0.6rem)",
                        }}>
                            {chordLabel}
                        </div>
                    )}
                    <div
                        className="mt-2 text-[clamp(2.4rem,12vw,5rem)] leading-none text-center"
                        style={{ color: chordDisplayColor ? `${chordDisplayColor}66` : "rgba(255,255,255,0.4)", fontFamily: "'Playfair Display', serif" }}
                    >
                        {nextChord || ""}
                    </div>
                    </div>
                </div>

                {/* Fretboard — flex-1, pushed to bottom, horizontal scroll only */}
                <div className="flex flex-col flex-1 overflow-hidden min-h-0 justify-end pb-2" data-tour="fretboard">
                    <div className="overflow-x-auto overflow-y-hidden">
                        <div style={{ minWidth: "200vw" }}>
                            <Fretboard
                                compact
                                boardColorOverride={boardColor}
                                stringColorOverride={stringColor}
                                markerColorOverride={markerColor}
                                labelTextColor={fretLabelTextColor}
                                noteTextColor={noteTextColor}
                                fretMarkers={fretMarkers}
                                frets={frets}
                                getDisplayedFretboardLabel={getDisplayedFretboardLabel}
                                mergedNoteMap={mergedNoteMap}
                                overlayFilled={theorySettings.layer2Filled}
                                strings={strings}
                                tuning={tuning}
                                tuningIndex={tuningIndex}
                            />
                        </div>
                    </div>
                </div>

                {/* Playback controls — compact fixed height */}
                <div className="shrink-0">
                    <MobilePlaybackControls
                        barColor={playheadColor}
                        contentColor={playbackContentColor}
                        currentTime={currentTime}
                        duration={duration}
                        formatTime={formatTime}
                        isAudioAvailable={isAudioAvailable}
                        isPlaying={isPlaying}
                        progress={progress}
                        songName={song.name}
                        onTimelineTouchStart={handleTimelineTouch}
                        onTimelineTouchMove={handleTimelineTouch}
                        onTogglePlay={togglePlay}
                    />
                </div>

                {/* Mobile fretboard settings sheet */}
                <MobileFretboardSettings
                    isOpen={mobileSettingsOpen}
                    onClose={() => setMobileSettingsOpen(false)}
                    theorySettings={theorySettings}
                    onTheoryChange={setTheorySettings}
                    noteDisplayMode={noteDisplayMode}
                    onToggleNoteDisplayMode={() =>
                        setNoteDisplayMode((currentMode) =>
                            currentMode === "notes" ? "intervals" : "notes"
                        )
                    }
                    bgMode={bgMode}
                    bgColor={bgColor}
                    bgAccentColor={bgAccentColor}
                    boardColor={boardColor}
                    stringColor={stringColor}
                    markerColor={markerColor}
                    fretLabelTextColor={fretLabelTextColor}
                    noteTextColor={noteTextColor}
                    playheadColor={playheadColor}
                    chordDisplayColor={chordDisplayColor}
                    setBgMode={setBgMode}
                    setBgColor={setBgColor}
                    setBgAccentColor={setBgAccentColor}
                    setBoardColor={setBoardColor}
                    setStringColor={setStringColor}
                    setMarkerColor={setMarkerColor}
                    setFretLabelTextColor={setFretLabelTextColor}
                    setNoteTextColor={setNoteTextColor}
                    setPlayheadColor={setPlayheadColor}
                    setChordDisplayColor={setChordDisplayColor}
                    onResetToDefault={resetToDefaultColors}
                    onStartTour={() => { setMobileSettingsOpen(false); setTourActive(true); }}
                    onFeedback={() => { setMobileSettingsOpen(false); setFeedbackOpen(true); }}
                />
            </div>

            <OnboardingTour active={tourActive} onRequestPlay={handleTourRequestPlay} />
        </div>
    );
}
