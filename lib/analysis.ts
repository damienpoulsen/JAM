export type AnalysisChordEvent = {
    time: number;
    chord: string;
};

export type SongAnalysis = {
    songId: string;
    bpm: number | null;
    beatStartTime: number | null;
    detectedKey: string | null;
    chordEvents: AnalysisChordEvent[];
    source: "manual" | "ai";
    version: number;
};

export type SongAnalysisOverrides = {
    bpm?: number | null;
    beatStartTime?: number | null;
    detectedKey?: string | null;
    chordEvents?: AnalysisChordEvent[];
    source?: SongAnalysis["source"];
    version?: number;
};

export const SONG_ANALYSIS_STORAGE_KEY = "song-analysis";
export const CURRENT_ANALYSIS_VERSION = 3;

function normalizeChordEvents(events: AnalysisChordEvent[] | undefined): AnalysisChordEvent[] {
    if (!events) {
        return [];
    }

    return events
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

export function getSongAnalysis(songId: string, overrides: SongAnalysisOverrides = {}): SongAnalysis {
    const storedAnalysis = readStoredSongAnalysis(songId);

    return {
        songId,
        bpm: overrides.bpm ?? storedAnalysis?.bpm ?? null,
        beatStartTime: overrides.beatStartTime ?? storedAnalysis?.beatStartTime ?? null,
        detectedKey: overrides.detectedKey ?? storedAnalysis?.detectedKey ?? null,
        chordEvents: normalizeChordEvents(overrides.chordEvents ?? storedAnalysis?.chordEvents),
        source: overrides.source ?? storedAnalysis?.source ?? "manual",
        version: overrides.version ?? storedAnalysis?.version ?? CURRENT_ANALYSIS_VERSION,
    };
}

export function readStoredSongAnalyses(): SongAnalysis[] {
    if (typeof window === "undefined") {
        return [];
    }

    const stored = window.localStorage.getItem(SONG_ANALYSIS_STORAGE_KEY);
    if (!stored) {
        return [];
    }

    try {
        const parsed = JSON.parse(stored) as SongAnalysis[];
        return parsed.map((analysis) => ({
            songId: analysis.songId,
            bpm: typeof analysis.bpm === "number" && Number.isFinite(analysis.bpm) ? analysis.bpm : null,
            beatStartTime:
                typeof analysis.beatStartTime === "number" && Number.isFinite(analysis.beatStartTime)
                    ? analysis.beatStartTime
                    : null,
            detectedKey: typeof analysis.detectedKey === "string" && analysis.detectedKey.trim()
                ? analysis.detectedKey.trim()
                : null,
            chordEvents: normalizeChordEvents(analysis.chordEvents),
            source: analysis.source === "ai" || analysis.source === "manual" ? analysis.source : "manual",
            version:
                typeof analysis.version === "number" && Number.isFinite(analysis.version)
                    ? analysis.version
                    : 1,
        }));
    } catch {
        return [];
    }
}

export function readStoredSongAnalysis(songId: string): SongAnalysis | null {
    return readStoredSongAnalyses().find((analysis) => analysis.songId === songId) ?? null;
}

export function writeStoredSongAnalyses(analyses: SongAnalysis[]) {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(SONG_ANALYSIS_STORAGE_KEY, JSON.stringify(analyses));
}

export function saveSongAnalysis(nextAnalysis: SongAnalysis) {
    const analyses = readStoredSongAnalyses();
    const existingIndex = analyses.findIndex((analysis) => analysis.songId === nextAnalysis.songId);
    const normalizedAnalysis = {
        ...nextAnalysis,
        bpm: typeof nextAnalysis.bpm === "number" && Number.isFinite(nextAnalysis.bpm) ? nextAnalysis.bpm : null,
        beatStartTime:
            typeof nextAnalysis.beatStartTime === "number" && Number.isFinite(nextAnalysis.beatStartTime)
                ? nextAnalysis.beatStartTime
                : null,
        detectedKey:
            typeof nextAnalysis.detectedKey === "string" && nextAnalysis.detectedKey.trim()
                ? nextAnalysis.detectedKey.trim()
                : null,
        chordEvents: normalizeChordEvents(nextAnalysis.chordEvents),
        version:
            typeof nextAnalysis.version === "number" && Number.isFinite(nextAnalysis.version)
                ? nextAnalysis.version
                : CURRENT_ANALYSIS_VERSION,
    };

    const updatedAnalyses =
        existingIndex === -1
            ? [...analyses, normalizedAnalysis]
            : analyses.map((analysis, index) => (index === existingIndex ? normalizedAnalysis : analysis));

    writeStoredSongAnalyses(updatedAnalyses);
}
