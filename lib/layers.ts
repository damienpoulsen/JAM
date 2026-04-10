import { chordTones } from "./music";

export type LayerSlot = "primary" | "secondary" | "tertiary";

export type LayerKind =
    | "off"
    | "song-root"
    | "song-scale"
    | "current-chord"
    | "chord-triad"
    | "pentatonic";

export type LayerOption = {
    value: LayerKind;
    label: string;
};

export type LayerConfig = {
    slot: LayerSlot;
    kind: LayerKind;
    color: string;
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
    style: {
        fill: string;
        borderColor: string;
        textColor: string;
        opacity: number;
        borderWidth: number;
    };
};

const VALID_LAYER_KINDS: LayerKind[] = [
    "off",
    "song-root",
    "song-scale",
    "current-chord",
    "chord-triad",
    "pentatonic",
];

const VALID_LAYER_SLOTS: LayerSlot[] = ["primary", "secondary", "tertiary"];

const NOTE_INDEX: Record<string, number> = {
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

const SLOT_STYLE: Record<
    LayerSlot,
    { priority: number; opacity: number; borderWidth: number; textColor: string }
> = {
    primary: {
        priority: 1,
        opacity: 1,
        borderWidth: 3,
        textColor: "#ffffff",
    },
    secondary: {
        priority: 2,
        opacity: 1,
        borderWidth: 2,
        textColor: "#f8fafc",
    },
    tertiary: {
        priority: 3,
        opacity: 1,
        borderWidth: 1,
        textColor: "#f8fafc",
    },
};

const SCALE_INTERVALS = {
    "major-scale": [0, 2, 4, 5, 7, 9, 11],
    "natural-minor": [0, 2, 3, 5, 7, 8, 10],
    "major-pentatonic": [0, 2, 4, 7, 9],
    "minor-pentatonic": [0, 3, 5, 7, 10],
} as const;

export const LAYER_OPTIONS: LayerOption[] = [
    { value: "off", label: "Off" },
    { value: "current-chord", label: "Chord Tones" },
    { value: "chord-triad", label: "Chord Triad" },
    { value: "song-root", label: "Root Note" },
    { value: "song-scale", label: "Song Scale" },
    { value: "pentatonic", label: "Pentatonic" },
];

export function normalizeLayerConfig(config: Partial<LayerConfig>, fallbackSlot: LayerSlot): LayerConfig {
    const slot = VALID_LAYER_SLOTS.includes(config.slot as LayerSlot) ? (config.slot as LayerSlot) : fallbackSlot;
    const kind = VALID_LAYER_KINDS.includes(config.kind as LayerKind) ? (config.kind as LayerKind) : "off";
    const color =
        typeof config.color === "string" && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(config.color)
            ? config.color
            : "#22c55e";

    return {
        slot,
        kind,
        color,
    };
}

function normalizeNotes(notes: number[]): number[] {
    return Array.from(
        new Set(notes.filter((note) => Number.isFinite(note)).map((note) => ((note % 12) + 12) % 12))
    ).sort((a, b) => a - b);
}

function normalizeChordQualitySuffix(suffix: string): string {
    return suffix
        .trim()
        .toLowerCase()
        .replace(/^:/, "")
        .split("/")[0]
        .trim();
}

function parsePitch(value: string): { root: string; noteIndex: number; isMinor: boolean } | null {
    const match = value.trim().match(/^([A-G](?:#|b)?)(.*)$/);
    if (!match) {
        return null;
    }

    const [, root, suffix] = match;
    const noteIndex = NOTE_INDEX[root];
    if (noteIndex === undefined) {
        return null;
    }

    const normalizedSuffix = normalizeChordQualitySuffix(suffix);
    const isMinor = isMinorSuffix(normalizedSuffix) && !isMajorSuffix(normalizedSuffix);

    return {
        root,
        noteIndex,
        isMinor,
    };
}

function getChordSuffix(chordName: string): string {
    const parsed = parsePitch(chordName);
    if (!parsed) {
        return "";
    }

    return normalizeChordQualitySuffix(chordName.slice(parsed.root.length));
}

function isMinorSuffix(suffix: string): boolean {
    return (
        suffix === "m" ||
        suffix.startsWith("m ") ||
        suffix.startsWith("m7") ||
        suffix.startsWith("m9") ||
        suffix.startsWith("m11") ||
        suffix.startsWith("m13") ||
        suffix.startsWith("min") ||
        suffix.startsWith("minor")
    );
}

function isMajorSuffix(suffix: string): boolean {
    return suffix.startsWith("maj") || suffix.startsWith("major");
}

function buildScale(rootNote: number, intervals: readonly number[]): number[] {
    return normalizeNotes(intervals.map((interval) => rootNote + interval));
}

function getChordNotes(chordName: string): number[] {
    const parsed = parsePitch(chordName);
    if (!parsed) {
        return chordTones[chordName] || [];
    }

    const suffix = getChordSuffix(chordName);

    if (suffix.startsWith("maj7")) {
        return buildScale(parsed.noteIndex, [0, 4, 7, 11]);
    }

    if (suffix === "6") {
        return buildScale(parsed.noteIndex, [0, 4, 7, 9]);
    }

    if (suffix === "9" || suffix === "11" || suffix === "13" || suffix === "7") {
        return buildScale(parsed.noteIndex, [0, 4, 7, 10]);
    }

    if (suffix.startsWith("m6")) {
        return buildScale(parsed.noteIndex, [0, 3, 7, 9]);
    }

    if (
        suffix.startsWith("m7") ||
        suffix.startsWith("m9") ||
        suffix.startsWith("m11") ||
        suffix.startsWith("m13") ||
        suffix.startsWith("min7") ||
        suffix.startsWith("minor7")
    ) {
        return buildScale(parsed.noteIndex, [0, 3, 7, 10]);
    }

    if (suffix.startsWith("dim")) {
        return buildScale(parsed.noteIndex, [0, 3, 6]);
    }

    if (suffix.startsWith("aug") || suffix.includes("#5")) {
        return buildScale(parsed.noteIndex, [0, 4, 8]);
    }

    if (suffix.startsWith("sus2")) {
        return buildScale(parsed.noteIndex, [0, 2, 7]);
    }

    if (suffix === "sus" || suffix.startsWith("sus4")) {
        return buildScale(parsed.noteIndex, [0, 5, 7]);
    }

    if (isMinorSuffix(suffix)) {
        return buildScale(parsed.noteIndex, [0, 3, 7]);
    }

    return buildScale(parsed.noteIndex, [0, 4, 7]);
}

function getChordTriadNotes(chordName: string): number[] {
    const parsed = parsePitch(chordName);
    if (!parsed) {
        return [];
    }

    const suffix = getChordSuffix(chordName);

    if (suffix.startsWith("dim")) {
        return buildScale(parsed.noteIndex, [0, 3, 6]);
    }

    if (suffix.startsWith("aug") || suffix.includes("#5")) {
        return buildScale(parsed.noteIndex, [0, 4, 8]);
    }

    if (suffix.startsWith("sus2")) {
        return buildScale(parsed.noteIndex, [0, 2, 7]);
    }

    if (suffix === "sus" || suffix.startsWith("sus4")) {
        return buildScale(parsed.noteIndex, [0, 5, 7]);
    }

    if (isMinorSuffix(suffix) && !isMajorSuffix(suffix)) {
        return buildScale(parsed.noteIndex, [0, 3, 7]);
    }

    return buildScale(parsed.noteIndex, [0, 4, 7]);
}

function getKeyContextPitch(songKey: string, currentChord: string) {
    return parsePitch(songKey) ?? parsePitch(currentChord);
}

function getSongScale(songKey: string, currentChord: string): number[] {
    const parsed = getKeyContextPitch(songKey, currentChord);
    if (!parsed) {
        return [];
    }

    return parsed.isMinor
        ? buildScale(parsed.noteIndex, SCALE_INTERVALS["natural-minor"])
        : buildScale(parsed.noteIndex, SCALE_INTERVALS["major-scale"]);
}

function getAdaptivePentatonic(songKey: string, currentChord: string): number[] {
    const parsed = parsePitch(currentChord) ?? parsePitch(songKey);
    if (!parsed) {
        return [];
    }

    if (parsed.isMinor) {
        return buildScale(parsed.noteIndex, SCALE_INTERVALS["minor-pentatonic"]);
    }

    return buildScale(parsed.noteIndex, SCALE_INTERVALS["major-pentatonic"]);
}

export function buildLayer(config: LayerConfig, context: LayerContext): Layer | null {
    if (config.kind === "off") {
        return null;
    }

    const chordPitch = parsePitch(context.currentChord);
    const rootPitch = chordPitch ?? parsePitch(context.songKey);
    const slotStyle = SLOT_STYLE[config.slot];
    let notes: number[] = [];
    let label = "Layer";

    switch (config.kind) {
        case "song-root":
            notes = rootPitch ? [rootPitch.noteIndex] : [];
            label = "Root Note";
            break;
        case "song-scale":
            notes = getSongScale(context.songKey, context.currentChord);
            label = "Song Scale";
            break;
        case "current-chord":
            notes = getChordNotes(context.currentChord);
            label = context.currentChord || "Chord Tones";
            break;
        case "chord-triad":
            notes = getChordTriadNotes(context.currentChord);
            label = context.currentChord ? `${context.currentChord} Triad` : "Chord Triad";
            break;
        case "pentatonic":
            notes = getAdaptivePentatonic(context.songKey, context.currentChord);
            label = "Pentatonic";
            break;
    }

    const normalizedNotes = normalizeNotes(notes);
    if (normalizedNotes.length === 0) {
        return null;
    }

    return {
        id: `${config.slot}-${config.kind}`,
        name: label,
        notes: normalizedNotes,
        priority: slotStyle.priority,
        style: {
            fill: config.color,
            borderColor: "#f8fafc",
            textColor: slotStyle.textColor,
            opacity: slotStyle.opacity,
            borderWidth: slotStyle.borderWidth,
        },
    };
}
