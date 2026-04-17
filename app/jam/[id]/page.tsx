"use client";

import { use } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChordDisplay from "./components/ChordDisplay";
import ColorWheelPicker from "./components/ColorWheelPicker";
import Fretboard from "./components/Fretboard";
import OverlayControls from "./components/OverlayControls";
import PlaybackControls from "./components/PlaybackControls";
import MobileFretboardSettings from "./components/MobileFretboardSettings";
import MobilePlaybackControls from "./components/MobilePlaybackControls";
import {
    buildLayer,
    LAYER_OPTIONS,
    normalizeLayerConfig,
    type LayerConfig,
    type LayerSlot,
} from "@/lib/layers";
import { mergeLayers } from "../../../lib/layerManager";
import { getSongAnalysis, type AnalysisChordEvent } from "../../../lib/analysis";
import { getFile } from "../../../lib/db";
import { readSongs, SONGS_STORAGE_KEY, type Song, writeSongs } from "../../../lib/songs";

const emptySong: Song = {
    name: "",
    bpm: 70,
    key: "Unknown",
    id: "",
    fileId: "",
    analysisStatus: "ready",
};

const SLOT_ORDER: LayerSlot[] = ["primary", "secondary", "tertiary"];
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

function getChordDisplayState(timeline: AnalysisChordEvent[], playbackTime: number) {
    if (timeline.length === 0) {
        return {
            currentChord: "",
            nextChord: "",
            chordIndex: -1,
        };
    }

    if (playbackTime < timeline[0].time) {
        return {
            currentChord: "",
            nextChord: timeline[0].chord,
            chordIndex: -1,
        };
    }

    for (let index = timeline.length - 1; index >= 0; index -= 1) {
        if (playbackTime >= timeline[index].time) {
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
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const metronomeAudioContextRef = useRef<AudioContext | null>(null);
    const metronomeBufferRef = useRef<AudioBuffer | null>(null);
    const metronomeIntervalRef = useRef<number | null>(null);
    const songRecord = useMemo(() => readSongRecord(id), [id]);

    const [songDrafts, setSongDrafts] = useState<Record<string, Song>>({});
    const [audioURL, setAudioURL] = useState("");
    const [loadedFileId, setLoadedFileId] = useState("");
    const [audioError, setAudioError] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [masterVolume, setMasterVolume] = useState(1);
    const [noteDisplayMode, setNoteDisplayMode] = useState<NoteDisplayMode>("notes");
    const [tempoDisplayMode, setTempoDisplayMode] = useState<"percent" | "bpm">("percent");
    const [metronomeEnabled, setMetronomeEnabled] = useState(false);
    const [metronomeOpen, setMetronomeOpen] = useState(false);
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
    const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
    const [keyOpen, setKeyOpen] = useState(false);
    const [layersOpen, setLayersOpen] = useState(false);
    const [layerConfigs, setLayerConfigs] = useState<LayerConfig[]>(() => [
        normalizeLayerConfig({ slot: "primary", kind: "pentatonic", color: "#000000" }, "primary"),
    ]);
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
    const frets = 12;
    const tuning = ["E", "A", "D", "G", "B", "E"];
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const tuningIndex = tuning.map((note) => notes.indexOf(note));
    const fretMarkers = [3, 5, 7, 9, 12];

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
    const normalizedLayerConfigs = useMemo(
        () => layerConfigs.map((config, index) => normalizeLayerConfig(config, SLOT_ORDER[index] ?? "tertiary")),
        [layerConfigs]
    );

    // Theory overlay pipeline: selected layer config -> built pitch classes -> merged display notes.
    const layers = useMemo(
        () =>
            normalizedLayerConfigs
                .map((config) =>
                    buildLayer(config, {
                        songKey: song.key,
                        currentChord,
                    })
                )
                .filter((layer) => layer !== null),
        [currentChord, normalizedLayerConfigs, song.key]
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

    const getLayerBorderColor = (fillLayers: (typeof mergedNotes)[number]["layers"]) =>
        fillLayers[1]?.style.fill ?? fillLayers[0]?.style.borderColor ?? "#f8fafc";
    const getLayerBorderStyle = (fillLayers: (typeof mergedNotes)[number]["layers"], borderWidth: number) =>
        fillLayers.length > 1
            ? `${borderWidth}px solid ${getLayerBorderColor(fillLayers)}`
            : "none";
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

    const updateLayerConfig = <K extends keyof LayerConfig>(
        slot: LayerSlot,
        key: K,
        value: LayerConfig[K]
    ) => {
        setLayerConfigs((currentLayers) =>
            currentLayers.map((layer) =>
                layer.slot === slot
                    ? normalizeLayerConfig({ ...layer, [key]: value }, layer.slot)
                    : layer
            )
        );
    };

    const reindexLayerSlots = (configs: LayerConfig[]) =>
        configs.map((config, index) => ({
            ...normalizeLayerConfig(config, SLOT_ORDER[index]),
            slot: SLOT_ORDER[index],
        }));

    const addLayer = () => {
        setLayerConfigs((currentLayers) => {
            if (currentLayers.length >= SLOT_ORDER.length) {
                return currentLayers;
            }

            return [
                ...currentLayers,
                {
                    slot: SLOT_ORDER[currentLayers.length],
                    kind: "off",
                    color: "#22c55e",
                }
            ];
        });
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

    const removeLayer = (slot: LayerSlot) => {
        setLayerConfigs((currentLayers) => {
            if (currentLayers.length <= 1) {
                return currentLayers;
            }

            const filteredLayers = currentLayers.filter((layer) => layer.slot !== slot);
            return reindexLayerSlots(filteredLayers);
        });
    };

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
                    setAudioError("Audio file is unavailable for this song.");
                    return;
                }

                url = URL.createObjectURL(file);
                setLoadedFileId(targetFileId);
                setAudioURL(url);
                setAudioError("");
            } catch (error) {
                console.error("Failed to load audio file", error);
                if (!active) {
                    return;
                }

                setLoadedFileId(targetFileId);
                setAudioURL("");
                setAudioError("Audio file could not be loaded.");
            }
        };

        void load();

        return () => {
            active = false;
            if (url) {
                URL.revokeObjectURL(url);
            }
        };
    }, [song.fileId]);

    // Audio element events drive the transport, chord timing, and playhead UI.
    useEffect(() => {
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
    }, [audioURL]);

    useEffect(() => {
        if (!isPlaying) {
            return;
        }

        let frameId = 0;

        const syncPlaybackTime = () => {
            const audio = audioRef.current;
            if (!audio) {
                return;
            }

            setCurrentTime(audio.currentTime);
            frameId = window.requestAnimationFrame(syncPlaybackTime);
        };

        frameId = window.requestAnimationFrame(syncPlaybackTime);

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [isPlaying]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        audio.playbackRate = playbackRate;
    }, [playbackRate, audioURL]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        audio.volume = masterVolume;
    }, [audioURL, masterVolume]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio || !isAudioAvailable) {
            return;
        }

        if (audio.paused) {
            void audio.play();
        } else {
            audio.pause();
        }
    };

    const toggleLoopMode = () => {
        setLoopMode((currentMode) => {
            if (currentMode) {
                setLoopRange(null);
                setLoopDraft(null);
            }

            return !currentMode;
        });
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
            const audio = audioRef.current;
            if (!audio) {
                return;
            }

            if (audio.currentTime >= loopRange.end) {
                audio.currentTime = loopRange.start;
                setCurrentTime(loopRange.start);
            }

            frameId = window.requestAnimationFrame(syncLoop);
        };

        frameId = window.requestAnimationFrame(syncLoop);

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [isPlaying, loopMode, loopRange]);

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
            <audio key={`${id}:${song.fileId || "no-file"}`} ref={audioRef} src={isAudioAvailable ? audioURL : undefined} />

            {/* Left panel + handle (slide together) */}
            <div
                className="absolute top-0 left-0 z-40 h-full transition-all duration-300 hidden min-[900px]:block"
                style={{ transform: panelOpen ? "translateX(0)" : "translateX(-240px)" }}
            >
                {/* Panel content */}
                <div className="h-full w-[240px] overflow-hidden border-r transition-colors duration-300" style={{ background: leftBarColor, borderColor: panel.border }}>
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
                                    { view: "control-center", label: "Control Center",   dot: controlCenterColor },
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
                                        "control-center": "Control Center",
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
                                {panelView === "control-center" && (
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

                {/* Handle — rides on the right edge of the panel */}
                <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setPanelOpen(!panelOpen); }}
                >
                    <div
                        className="flex h-[40vh] w-[28px] items-center justify-center rounded-r-xl select-none"
                        style={{
                            background: leftBarColor,
                            borderTop: "1.5px solid #f4f4f5",
                            borderRight: "1.5px solid #f4f4f5",
                            borderBottom: "1.5px solid #f4f4f5",
                            color: panel.text,
                        }}
                    >
                        {panelOpen ? "◀" : "▶"}
                    </div>
                </div>
            </div>

            <div className="hidden min-[900px]:flex relative h-full flex-col px-8 pt-0 pb-2">
                {/* Header / app branding */}
                <div className="flex items-center justify-between pb-2 pt-2">
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
                            <div style={{ backgroundColor: "transparent" }}>
                            <ChordDisplay
                                isDark={true}
                                chordTextColor={chordDisplayColor}
                                bpm={displayBpm}
                                currentChord={currentChord}
                                keyOpen={keyOpen}
                                keyOptions={keyOptions}
                                nextChord={nextChord}
                                onBpmChange={(nextValue) => {
                                    updateSong({
                                        bpm: nextValue,
                                    });
                                }}
                                onKeySelect={(keyOption) => {
                                    updateSong({ key: keyOption });
                                    setKeyOpen(false);
                                }}
                                onToggleKeyOpen={() => setKeyOpen(!keyOpen)}
                                songKey={song.key}
                            />
                            </div>

                            <div className="-mt-5 flex flex-col">

                                <div className="-mt-5 flex flex-col">
                                    <OverlayControls
                                        barColor={controlCenterColor}
                                        audioError={visibleAudioError}
                                        canAddLayer={normalizedLayerConfigs.length < SLOT_ORDER.length}
                                        layerConfigs={normalizedLayerConfigs}
                                        layersOpen={layersOpen}
                                        loopMode={loopMode}
                                        metronomeBpm={metronomeBpm}
                                        metronomeEnabled={metronomeEnabled}
                                        metronomeOpen={metronomeOpen}
                                        noteDisplayMode={noteDisplayMode}
                                        onAddLayer={addLayer}
                                        onDecreaseTempo={() => updatePlaybackRate(playbackRate - 0.1)}
                                        onIncreaseTempo={() => updatePlaybackRate(playbackRate + 0.1)}
                                        onLayerColorChange={(slot, color) => updateLayerConfig(slot, "color", color)}
                                        onLayerKindChange={(slot, kind) => updateLayerConfig(slot, "kind", kind)}
                                        onDecreaseMetronomeBpm={() =>
                                            setMetronomeBpmOverride({
                                                songId: id,
                                                bpm: Math.max(30, metronomeBpm - 1),
                                            })
                                        }
                                        onRemoveLayer={removeLayer}
                                        onTempoDisplayModeChange={setTempoDisplayMode}
                                        onIncreaseMetronomeBpm={() =>
                                            setMetronomeBpmOverride({
                                                songId: id,
                                                bpm: Math.min(260, metronomeBpm + 1),
                                            })
                                        }
                                        onToggleLayersOpen={() => setLayersOpen((current) => !current)}
                                        onToggleLoopMode={toggleLoopMode}
                                        onToggleMetronome={() => setMetronomeEnabled((current) => !current)}
                                        onToggleMetronomeOpen={() => setMetronomeOpen((current) => !current)}
                                        onToggleNoteDisplayMode={() =>
                                            setNoteDisplayMode((currentMode) =>
                                                currentMode === "notes" ? "intervals" : "notes"
                                            )
                                        }
                                        playbackRate={playbackRate}
                                        tempoDisplayMode={tempoDisplayMode}
                                        baseBpm={displayBpm === "--" ? null : typeof displayBpm === "number" ? displayBpm : Number(displayBpm) || null}
                                    />

                                    <Fretboard
                                        boardColorOverride={boardColor}
                                        stringColorOverride={stringColor}
                                        markerColorOverride={markerColor}
                                        labelTextColor={fretLabelTextColor}
                                        noteTextColor={noteTextColor}
                                        fretMarkers={fretMarkers}
                                        frets={frets}
                                        getDisplayedFretboardLabel={getDisplayedFretboardLabel}
                                        getLayerBorderStyle={getLayerBorderStyle}
                                        mergedNoteMap={mergedNoteMap}
                                        strings={strings}
                                        tuning={tuning}
                                        tuningIndex={tuningIndex}
                                    />

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
                                                            if (audio) {
                                                                audio.currentTime = currentDraft.start;
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
                                                const audio = audioRef.current;
                                                if (!audio) return;

                                                const nextTime = getClampedTime(mouseEvent.clientX);
                                                audio.currentTime = nextTime;
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

            {/* ── Mobile layout (phones only, desktop untouched above) ── */}
            <div className="flex min-[900px]:hidden h-full flex-col overflow-hidden">

                {/* Settings button — absolute top right */}
                <button
                    type="button"
                    onClick={() => setMobileSettingsOpen(true)}
                    className="absolute top-4 right-4 z-30 flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-lg border border-white/25 bg-black/40"
                    aria-label="Settings"
                >
                    <span className="block h-[2px] w-4 rounded-full bg-white/75" />
                    <span className="block h-[2px] w-4 rounded-full bg-white/75" />
                    <span className="block h-[2px] w-4 rounded-full bg-white/75" />
                </button>

                {/* Chord display — top ~28%, pushed toward bottom of section */}
                <div className="flex h-[28%] flex-col items-center justify-end pb-3 px-4">
                    <div
                        className="text-[clamp(6rem,29vw,12rem)] font-bold leading-none text-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                        style={{ color: chordDisplayColor || "#ffffff", fontFamily: "'Playfair Display', serif" }}
                    >
                        {currentChord || "—"}
                    </div>
                    <div
                        className="mt-2 text-[clamp(2.4rem,12vw,5rem)] leading-none text-center"
                        style={{ color: chordDisplayColor ? `${chordDisplayColor}66` : "rgba(255,255,255,0.4)", fontFamily: "'Playfair Display', serif" }}
                    >
                        {nextChord || ""}
                    </div>
                </div>

                {/* Fretboard — flex-1, pushed to bottom, horizontal scroll only */}
                <div className="flex flex-col flex-1 overflow-hidden min-h-0 justify-end pb-2">
                    {/* Theory layer select */}
                    <div className="flex shrink-0 items-center px-3 pb-1">
                        <select
                            value={normalizedLayerConfigs[0]?.kind ?? "off"}
                            onChange={(e) => updateLayerConfig("primary", "kind", e.target.value as LayerConfig["kind"])}
                            className="rounded-lg border border-white/25 bg-black/60 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/85 outline-none"
                            style={{ fontFamily: "'Rajdhani', sans-serif" }}
                        >
                            {LAYER_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
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
                                getLayerBorderStyle={getLayerBorderStyle}
                                mergedNoteMap={mergedNoteMap}
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
                    canAddLayer={normalizedLayerConfigs.length < SLOT_ORDER.length}
                    layerConfigs={normalizedLayerConfigs}
                    noteDisplayMode={noteDisplayMode}
                    onAddLayer={addLayer}
                    onRemoveLayer={removeLayer}
                    onLayerColorChange={(slot, color) => updateLayerConfig(slot, "color", color)}
                    onLayerKindChange={(slot, kind) => updateLayerConfig(slot, "kind", kind)}
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
                />
            </div>
        </div>
    );
}
