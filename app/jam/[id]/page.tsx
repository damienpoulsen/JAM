"use client";

import Image from "next/image";
import { use } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChordDisplay from "./components/ChordDisplay";
import Fretboard from "./components/Fretboard";
import OverlayControls from "./components/OverlayControls";
import PlaybackControls from "./components/PlaybackControls";
import {
    buildLayer,
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
type FretboardTheme = "light" | "dark";

function getThemeLayerColors(theme: FretboardTheme) {
    if (theme === "dark") {
        return {
            pentatonic: "#8b5cf6",
            root: "#7dd3fc",
        };
    }

    return {
        pentatonic: "#111111",
        root: "#a855f7",
    };
}

function getDefaultLayerConfigs(theme: FretboardTheme): LayerConfig[] {
    const colors = getThemeLayerColors(theme);

    return [
        normalizeLayerConfig({ slot: "primary", kind: "pentatonic", color: colors.pentatonic }, "primary"),
        normalizeLayerConfig({ slot: "secondary", kind: "song-root", color: colors.root }, "secondary"),
    ];
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
    const [fretboardTheme, setFretboardTheme] = useState<FretboardTheme>("dark");
    const [editingName, setEditingName] = useState(false);
    const [volumeOpen, setVolumeOpen] = useState(false);
    const [keyOpen, setKeyOpen] = useState(false);
    const [layersOpen, setLayersOpen] = useState(false);
    const [layerConfigs, setLayerConfigs] = useState<LayerConfig[]>(() => getDefaultLayerConfigs("dark"));
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

    const toggleFretboardTheme = () => {
        setFretboardTheme((currentTheme) => {
            const nextTheme: FretboardTheme = currentTheme === "light" ? "dark" : "light";
            const themeColors = getThemeLayerColors(nextTheme);

            setLayerConfigs((currentLayers) =>
                currentLayers.map((layer) => {
                    if (layer.kind === "pentatonic") {
                        return normalizeLayerConfig({ ...layer, color: themeColors.pentatonic }, layer.slot);
                    }

                    if (layer.kind === "song-root") {
                        return normalizeLayerConfig({ ...layer, color: themeColors.root }, layer.slot);
                    }

                    return layer;
                })
            );

            return nextTheme;
        });
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

    return (
        <div className="relative h-screen overflow-hidden bg-black text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_22%),linear-gradient(180deg,rgba(0,0,0,0.98)_0%,rgba(0,0,0,1)_100%),repeating-radial-gradient(circle_at_center,rgba(255,255,255,0.018)_0_1px,transparent_1px_4px)] opacity-95" />
            <audio key={`${id}:${song.fileId || "no-file"}`} ref={audioRef} src={isAudioAvailable ? audioURL : undefined} />

            {/* Left slide-out handle */}
            <div
                onClick={() => setPanelOpen(!panelOpen)}
                className="absolute left-0 top-1/2 z-40 -translate-y-1/2 cursor-pointer"
            >
                <div className="flex h-[56vh] w-[32px] items-center justify-center rounded-r-xl border-y border-r border-white/10 bg-[#111111] text-white/70">
                    ▶
                </div>
            </div>

            <div
                className={`absolute top-0 left-0 z-30 h-full bg-[#0d0d0d] transition-all duration-300 ${panelOpen ? "w-[12.5%] pointer-events-auto" : "w-0 pointer-events-none"} overflow-hidden border-r border-white/6`}
            >
                <div className="flex h-full flex-col px-4 pt-7">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
                        Display
                    </div>

                    <button
                        type="button"
                        onClick={toggleFretboardTheme}
                        className={`w-full rounded-xl border px-4 py-3 text-left shadow-[0_16px_30px_rgba(0,0,0,0.28)] transition ${fretboardTheme === "dark"
                                ? "border-sky-200/60 bg-[#1d232d] hover:bg-[#242b36]"
                                : "border-white/12 bg-[#171717] hover:border-white/22 hover:bg-[#1d1d1d]"
                            }`}
                    >
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/48">
                            Light vs Dark
                        </div>
                        <div className="text-sm font-semibold text-white">
                            {fretboardTheme === "light" ? "Light Mode" : "Dark Mode"}
                        </div>
                    </button>
                </div>
            </div>

            <div className="relative h-full flex flex-col px-8 pt-0 pb-2">
                {/* Header / app branding */}
                <div className="flex items-center justify-between pb-2 pt-2">
                    <div className="cursor-pointer select-none">
                        <Image
                            src="/jam-logo-vibrant-1.png"
                            alt="Jam logo"
                            width={220}
                            height={122}
                            priority
                            className="h-auto w-[122px]"
                        />
                    </div>
                </div>

                <div className="-mt-14 flex flex-1 flex-col">
                    {!songFound ? (
                        /* Missing-song fallback state */
                        <div className="flex flex-1 items-center justify-center px-8">
                            <div className="w-full max-w-[720px] rounded-3xl border border-white/12 bg-black/35 px-8 py-10 text-center shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
                                <div className="text-3xl font-bold text-white">Song not found</div>
                                <p className="mt-3 text-base text-white/62">
                                    This jam page could not find a saved song record for the current id.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <ChordDisplay
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

                            <div className="-mt-5 flex flex-col">

                                <div className="-mt-5 flex flex-col">
                                    <OverlayControls
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
                                        key={fretboardTheme}
                                        fretboardTheme={fretboardTheme}
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
        </div>
    );
}
