import { chordTones } from "./music";

export type LayerSlot = "primary" | "secondary" | "tertiary";

export type LayerKind =
    | "off"
    | "song-key"
    | "key-pentatonic"
    | "chord-pentatonic"
    | "chord-scale"
    | "root-notes"
    | "triads"
    | "chord-tones"
    | "interval";

export type LayerRole = "base" | "overlay" | "overlay2";

export type TheorySettings = {
    layer1Kind: LayerKind | null;
    layer1Color: string;
    layer1Interval: number | null;
    layer2Kind: LayerKind | null;
    layer2Color: string;
    layer2Interval: number | null;
    layer2Filled: boolean;
    layer3Kind: LayerKind | null;
    layer3Color: string;
    layer3Interval: number | null;
};

export type FocusAreaPatternSystem = "pentatonic" | "diatonic";

export type FocusArea = {
    patternSystem: FocusAreaPatternSystem | null;
    activePositions: number[];
    customFretRange: { startFret: number; endFret: number } | null;
};

export const DEFAULT_FOCUS_AREA: FocusArea = {
    patternSystem: null,
    activePositions: [],
    customFretRange: null,
};

export function getFocusAreaPatternSystem(layer1Kind: LayerKind | null): FocusAreaPatternSystem | null {
    if (layer1Kind === "key-pentatonic" || layer1Kind === "chord-pentatonic") return "pentatonic";
    if (layer1Kind === "song-key" || layer1Kind === "chord-scale") return "diatonic";
    return null;
}

export type LayerConfig = {
    slot: LayerSlot;
    kind: LayerKind;
    color: string;
    interval?: number;
    role: LayerRole;
};

export type LayerContext = {
    songKey: string;
    currentChord: string;
};

export type Layer = {
    id: string;
    name: string;
    notes: number[];
    priority: number;
    role: LayerRole;
    style: {
        fill: string;
        textColor: string;
        opacity: number;
    };
};

export const BLANK_THEORY: TheorySettings = {
    layer1Kind: null,
    layer1Color: "#3b82f6",
    layer1Interval: null,
    layer2Kind: null,
    layer2Color: "#22c55e",
    layer2Interval: null,
    layer2Filled: false,
    layer3Kind: null,
    layer3Color: "#f59e0b",
    layer3Interval: null,
};

export const DEFAULT_THEORY: TheorySettings = {
    layer1Kind: "key-pentatonic",
    layer1Color: "#3b82f6",
    layer1Interval: null,
    layer2Kind: "chord-tones",
    layer2Color: "#22c55e",
    layer2Interval: null,
    layer2Filled: false,
    layer3Kind: null,
    layer3Color: "#f59e0b",
    layer3Interval: null,
};

export const BASE_KIND_VALUES: ReadonlyArray<LayerKind> = [
    "song-key", "chord-pentatonic", "key-pentatonic", "chord-scale",
];

export function isBaseKind(kind: LayerKind | null): boolean {
    return kind !== null && (BASE_KIND_VALUES as readonly LayerKind[]).includes(kind);
}

export const LAYER_GROUPS: ReadonlyArray<{
    label: string;
    options: ReadonlyArray<{ value: LayerKind; label: string }>;
}> = [
    {
        label: "BASE LAYERS",
        options: [
            { value: "song-key",         label: "Diatonic Scale" },
            { value: "chord-pentatonic", label: "Chord Pentatonics" },
            { value: "key-pentatonic",   label: "Key Pentatonic" },
            { value: "chord-scale",      label: "Chord Scale" },
        ],
    },
    {
        label: "OVERLAYS",
        options: [
            { value: "chord-tones", label: "Chord Tones" },
            { value: "triads",      label: "Triads" },
            { value: "root-notes",  label: "Root Notes" },
            { value: "interval",    label: "Interval..." },
        ],
    },
];

export const INTERVAL_OPTIONS: { semitones: number; label: string }[] = [
    { semitones: 1,  label: "b2" },
    { semitones: 2,  label: "2"  },
    { semitones: 3,  label: "b3" },
    { semitones: 4,  label: "3"  },
    { semitones: 5,  label: "4"  },
    { semitones: 6,  label: "b5" },
    { semitones: 7,  label: "5"  },
    { semitones: 8,  label: "b6" },
    { semitones: 9,  label: "6"  },
    { semitones: 10, label: "b7" },
    { semitones: 11, label: "7"  },
];

const SLOT_STYLE: Record<LayerSlot, { priority: number; opacity: number; textColor: string }> = {
    primary:   { priority: 1, opacity: 1, textColor: "#ffffff" },
    secondary: { priority: 2, opacity: 1, textColor: "#f8fafc" },
    tertiary:  { priority: 3, opacity: 1, textColor: "#f8fafc" },
};

const NOTE_INDEX: Record<string, number> = {
    C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4,
    F: 5, "E#": 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9,
    "A#": 10, Bb: 10, B: 11, Cb: 11,
};

const SCALE_INTERVALS = {
    major:           [0, 2, 4, 5, 7, 9, 11] as const,
    dorian:          [0, 2, 3, 5, 7, 9, 10] as const,
    mixolydian:      [0, 2, 4, 5, 7, 9, 10] as const,
    "natural-minor": [0, 2, 3, 5, 7, 8, 10] as const,
    locrian:         [0, 1, 3, 5, 6, 8, 10] as const,
    "major-penta":   [0, 2, 4, 7, 9]        as const,
    "minor-penta":   [0, 3, 5, 7, 10]       as const,
};

function normalizeNotes(notes: number[]): number[] {
    return Array.from(
        new Set(notes.filter(Number.isFinite).map((n) => ((n % 12) + 12) % 12))
    ).sort((a, b) => a - b);
}

function normalizeChordSuffix(suffix: string): string {
    return suffix.trim().toLowerCase().replace(/^:/, "").split("/")[0].trim();
}

function parsePitch(value: string): { root: string; noteIndex: number; isMinor: boolean } | null {
    const match = value.trim().match(/^([A-G](?:#|b)?)(.*)/);
    if (!match) return null;
    const [, root, rawSuffix] = match;
    const noteIndex = NOTE_INDEX[root];
    if (noteIndex === undefined) return null;
    const suffix = normalizeChordSuffix(rawSuffix);
    const isMinor = isMinorSuffix(suffix) && !isMajorSuffix(suffix);
    return { root, noteIndex, isMinor };
}

function getChordSuffix(chordName: string): string {
    const parsed = parsePitch(chordName);
    if (!parsed) return "";
    return normalizeChordSuffix(chordName.slice(parsed.root.length));
}

function isMinorSuffix(s: string): boolean {
    return (
        s === "m" || s.startsWith("m ") || s.startsWith("mb") ||
        s.startsWith("m6") || s.startsWith("m7") || s.startsWith("m9") ||
        s.startsWith("m11") || s.startsWith("m13") ||
        s.startsWith("min") || s.startsWith("minor")
    );
}

function isMajorSuffix(s: string): boolean {
    return s.startsWith("maj") || s.startsWith("major");
}

function buildScale(root: number, intervals: readonly number[]): number[] {
    return normalizeNotes(intervals.map((i) => root + i));
}

function getKeyContextPitch(songKey: string, currentChord: string) {
    return parsePitch(songKey) ?? parsePitch(currentChord);
}

// ─── Scale generators ────────────────────────────────────────────────────────

function getSongKeyScale(songKey: string, currentChord: string): number[] {
    const p = getKeyContextPitch(songKey, currentChord);
    if (!p) return [];
    return p.isMinor
        ? buildScale(p.noteIndex, SCALE_INTERVALS["natural-minor"])
        : buildScale(p.noteIndex, SCALE_INTERVALS.major);
}

function getKeyPentatonic(songKey: string, currentChord: string): number[] {
    const p = getKeyContextPitch(songKey, currentChord);
    if (!p) return [];
    return p.isMinor
        ? buildScale(p.noteIndex, SCALE_INTERVALS["minor-penta"])
        : buildScale(p.noteIndex, SCALE_INTERVALS["major-penta"]);
}

function getChordPentatonic(currentChord: string, songKey: string): number[] {
    const p = parsePitch(currentChord) ?? parsePitch(songKey);
    if (!p) return [];
    return p.isMinor
        ? buildScale(p.noteIndex, SCALE_INTERVALS["minor-penta"])
        : buildScale(p.noteIndex, SCALE_INTERVALS["major-penta"]);
}

function getChordScale(currentChord: string, songKey: string): number[] {
    const p = parsePitch(currentChord) ?? parsePitch(songKey);
    if (!p) return [];
    const s = getChordSuffix(currentChord);

    // Dominant 7 family → Mixolydian
    if (s === "7" || s === "9" || s === "11" || s === "13" ||
        s.startsWith("7sus") || s.startsWith("9sus")) {
        return buildScale(p.noteIndex, SCALE_INTERVALS.mixolydian);
    }
    // Major 7 family → Ionian
    if (isMajorSuffix(s)) {
        return buildScale(p.noteIndex, SCALE_INTERVALS.major);
    }
    // Minor 7 extensions → Dorian
    if (s.startsWith("m7") || s.startsWith("m9") || s.startsWith("m11") || s.startsWith("m13")) {
        return buildScale(p.noteIndex, SCALE_INTERVALS.dorian);
    }
    // Half-diminished (m7b5) → Locrian
    if (s.includes("b5") && (s.includes("m") || s.startsWith("dim"))) {
        return buildScale(p.noteIndex, SCALE_INTERVALS.locrian);
    }
    // Diminished → stacked minor-3rds (dim7 tones)
    if (s.startsWith("dim")) {
        return buildScale(p.noteIndex, [0, 3, 6, 9]);
    }
    // Augmented → augmented tones only
    if (s.startsWith("aug") || s.includes("#5")) {
        return buildScale(p.noteIndex, [0, 4, 8]);
    }
    // Sus4 → Mixolydian (resolves to dominant context)
    if (s === "sus" || s.startsWith("sus4")) {
        return buildScale(p.noteIndex, SCALE_INTERVALS.mixolydian);
    }
    // Sus2 → Ionian
    if (s.startsWith("sus2")) {
        return buildScale(p.noteIndex, SCALE_INTERVALS.major);
    }
    // Minor triad → Dorian
    if (isMinorSuffix(s) && !isMajorSuffix(s)) {
        return buildScale(p.noteIndex, SCALE_INTERVALS.dorian);
    }
    // Default: major triad → Ionian
    return buildScale(p.noteIndex, SCALE_INTERVALS.major);
}

// ─── Chord tone generators ───────────────────────────────────────────────────

function getChordToneNotes(chordName: string): number[] {
    const p = parsePitch(chordName);
    if (!p) return chordTones[chordName] ?? [];
    const s = getChordSuffix(chordName);
    if (s.startsWith("maj7"))                          return buildScale(p.noteIndex, [0, 4, 7, 11]);
    if (s === "6")                                     return buildScale(p.noteIndex, [0, 4, 7, 9]);
    if (s === "7" || s === "9" || s === "11" || s === "13") return buildScale(p.noteIndex, [0, 4, 7, 10]);
    if (s.startsWith("m6"))                            return buildScale(p.noteIndex, [0, 3, 7, 9]);
    if (s.startsWith("m7") || s.startsWith("m9") || s.startsWith("m11") || s.startsWith("m13") ||
        s.startsWith("min7") || s.startsWith("minor7")) return buildScale(p.noteIndex, [0, 3, 7, 10]);
    if (s.startsWith("dim"))                           return buildScale(p.noteIndex, [0, 3, 6]);
    if (s.startsWith("aug") || s.includes("#5"))       return buildScale(p.noteIndex, [0, 4, 8]);
    if (s.startsWith("sus2"))                          return buildScale(p.noteIndex, [0, 2, 7]);
    if (s === "sus" || s.startsWith("sus4"))           return buildScale(p.noteIndex, [0, 5, 7]);
    if (isMinorSuffix(s))                              return buildScale(p.noteIndex, [0, 3, 7]);
    return buildScale(p.noteIndex, [0, 4, 7]);
}

function getTriadNotes(chordName: string): number[] {
    const p = parsePitch(chordName);
    if (!p) return [];
    const s = getChordSuffix(chordName);
    if (s.startsWith("dim"))                    return buildScale(p.noteIndex, [0, 3, 6]);
    if (s.startsWith("aug") || s.includes("#5")) return buildScale(p.noteIndex, [0, 4, 8]);
    if (s.startsWith("sus2"))                   return buildScale(p.noteIndex, [0, 2, 7]);
    if (s === "sus" || s.startsWith("sus4"))    return buildScale(p.noteIndex, [0, 5, 7]);
    if (isMinorSuffix(s) && !isMajorSuffix(s)) return buildScale(p.noteIndex, [0, 3, 7]);
    return buildScale(p.noteIndex, [0, 4, 7]);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function theorySettingsToLayerConfigs(settings: TheorySettings): LayerConfig[] {
    const configs: LayerConfig[] = [];

    if (settings.layer3Kind) {
        configs.push({
            slot: "primary",
            role: "overlay2",
            kind: settings.layer3Kind,
            color: settings.layer3Color,
            ...(settings.layer3Kind === "interval" && settings.layer3Interval !== null
                ? { interval: settings.layer3Interval }
                : {}),
        });
    }

    if (settings.layer2Kind) {
        configs.push({
            slot: "secondary",
            role: "overlay",
            kind: settings.layer2Kind,
            color: settings.layer2Color,
            ...(settings.layer2Kind === "interval" && settings.layer2Interval !== null
                ? { interval: settings.layer2Interval }
                : {}),
        });
    }

    if (settings.layer1Kind) {
        configs.push({
            slot: "tertiary",
            role: "base",
            kind: settings.layer1Kind,
            color: settings.layer1Color,
            ...(settings.layer1Kind === "interval" && settings.layer1Interval !== null
                ? { interval: settings.layer1Interval }
                : {}),
        });
    }

    return configs;
}

export function buildLayer(config: LayerConfig, context: LayerContext): Layer | null {
    if (config.kind === "off") return null;

    const chordPitch = parsePitch(context.currentChord);
    const rootPitch = chordPitch ?? parsePitch(context.songKey);
    const slotStyle = SLOT_STYLE[config.slot];
    let notes: number[] = [];
    let label = "Layer";

    switch (config.kind) {
        case "song-key":
            notes = getSongKeyScale(context.songKey, context.currentChord);
            label = "Song Key";
            break;
        case "key-pentatonic":
            notes = getKeyPentatonic(context.songKey, context.currentChord);
            label = "Key Pentatonic";
            break;
        case "chord-pentatonic":
            notes = getChordPentatonic(context.currentChord, context.songKey);
            label = "Chord Pentatonic";
            break;
        case "chord-scale":
            notes = getChordScale(context.currentChord, context.songKey);
            label = "Chord Scale";
            break;
        case "root-notes":
            notes = rootPitch ? [rootPitch.noteIndex] : [];
            label = "Root";
            break;
        case "triads":
            notes = getTriadNotes(context.currentChord);
            label = "Triads";
            break;
        case "chord-tones":
            notes = getChordToneNotes(context.currentChord);
            label = context.currentChord || "Chord Tones";
            break;
        case "interval": {
            const semitones = config.interval ?? 0;
            notes = rootPitch ? [((rootPitch.noteIndex + semitones) % 12 + 12) % 12] : [];
            label = "Interval";
            break;
        }
    }

    const normalizedNotes = normalizeNotes(notes);
    if (normalizedNotes.length === 0) return null;

    return {
        id: `${config.slot}-${config.kind}`,
        name: label,
        notes: normalizedNotes,
        priority: slotStyle.priority,
        role: config.role ?? "base",
        style: {
            fill: config.color,
            textColor: slotStyle.textColor,
            opacity: slotStyle.opacity,
        },
    };
}
