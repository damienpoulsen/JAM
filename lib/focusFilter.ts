import { type FocusArea, getFocusAreaPatternSystem, type LayerKind } from "./layers";

const NOTE_NAME_TO_INDEX: Record<string, number> = {
    C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4,
    F: 5, "E#": 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9,
    "A#": 10, Bb: 10, B: 11, Cb: 11,
};

export function parseSongKeyRoot(songKey: string): { root: number; isMinor: boolean } | null {
    const match = songKey.trim().match(/^([A-G](?:#|b)?)(m)?/);
    if (!match) return null;
    const root = NOTE_NAME_TO_INDEX[match[1]];
    if (root === undefined) return null;
    return { root, isMinor: match[2] === "m" };
}

// Intervals for each scale type (semitones from root)
const MINOR_PENTA    = [0, 3, 5, 7, 10] as const;
const MAJOR_PENTA    = [0, 2, 4, 7,  9] as const;
const MAJOR_SCALE    = [0, 2, 4, 5, 7, 9, 11] as const;
const NATURAL_MINOR  = [0, 2, 3, 5, 7, 8, 10] as const;

// Span values that capture all notes per box/position.
//   Pentatonic span=3 → window [anchor-1, anchor+3]  (2 notes/string, fits cleanly)
//   Diatonic   span=4 → window [anchor-1, anchor+4]  (3 notes/string, fits cleanly)
//
// The B string (index 4) is tuned a semitone short of the standard 5-semitone gap
// (G→B = 4 semitones instead of 5), so its notes sit 1 fret higher than the
// pattern on other strings.  We add bStringBonus=1 to the end boundary for
// string 4 only — this keeps Position 7 / Box-end notes intact without
// bleeding into the next position on the other five strings.
const BOX_SPAN: Record<"pentatonic" | "diatonic", number> = {
    pentatonic: 3,
    diatonic: 4,
};

function computePatternRanges(
    root: number,
    activePositions: number[],
    patternSystem: "pentatonic" | "diatonic",
    isMinor: boolean,
    str0Tuning: number,
): [number, number][] {
    const intervals = patternSystem === "pentatonic"
        ? (isMinor ? MINOR_PENTA : MAJOR_PENTA)
        : (isMinor ? NATURAL_MINOR : MAJOR_SCALE);

    const span = BOX_SPAN[patternSystem];

    return activePositions.map((pos) => {
        const degreeIdx = Math.max(0, Math.min(pos - 1, intervals.length - 1));
        const anchorNote = (root + intervals[degreeIdx]) % 12;
        // Lowest fret where anchor note appears on string 0
        const anchorFret = ((anchorNote - str0Tuning) % 12 + 12) % 12;
        return [anchorFret - 1, anchorFret + span] as [number, number];
    });
}

function parseChordRootForFocus(chordName: string): { root: number; isMinor: boolean } | null {
    const match = chordName.trim().match(/^([A-G](?:#|b)?)(.*)/);
    if (!match) return null;
    const root = NOTE_NAME_TO_INDEX[match[1]];
    if (root === undefined) return null;
    const suffix = match[2].trim().toLowerCase().split("/")[0].trim();
    // "maj…"/"major…" = major; any other "m…" prefix = minor
    const isMinor = suffix.length > 0 && suffix[0] === "m" && !suffix.startsWith("maj");
    return { root, isMinor };
}

function fretInRanges(fretNum: number, ranges: [number, number][], tolerance: number): boolean {
    for (const [start, end] of ranges) {
        // Primary position: scale notes use strict match; overlays get ±2 fret shape-completion window
        if (fretNum >= start - tolerance && fretNum <= end + tolerance) return true;
        // Octave-up on a 24-fret board: always strict — no tolerance, prevents notes
        // far from the box lighting up just because the interval wraps to the same pitch class
        if (fretNum >= start + 12 && fretNum <= end + 12) return true;
    }
    return false;
}

/**
 * fretNum: 0 = open string, 1–24 = fretted position.
 * hasBaseLayer: true when the note belongs to a scale/base layer (strict),
 *               false when it is only an overlay (chord tones / triads → +2 fret tolerance).
 */
export type FretVisibilityFn = (stringIndex: number, fretNum: number, hasBaseLayer: boolean) => boolean;

export function buildFretVisibilityFn(
    focusArea: FocusArea,
    layer1Kind: LayerKind | null,
    songKey: string,
    currentChord: string,
    tuningIndex: number[],
): FretVisibilityFn {
    // Full Neck — show everything (default behaviour)
    if (focusArea.activePositions.length === 0 && !focusArea.customFretRange) {
        return () => true;
    }

    const str0Tuning = tuningIndex[0];

    // Custom fret range
    if (focusArea.customFretRange) {
        const { startFret, endFret } = focusArea.customFretRange;
        return (_si, fretNum, hasBase) => {
            const tol = hasBase ? 0 : 3;
            return fretNum >= startFret - tol && fretNum <= endFret + tol;
        };
    }

    // Pattern-based positions (boxes / diatonic positions)
    const patternSystem = getFocusAreaPatternSystem(layer1Kind);
    if (!patternSystem || focusArea.activePositions.length === 0) return () => true;

    // Chord-based layers (chord-pentatonic, chord-scale) anchor the box on the
    // current chord root so the position follows the chord as it changes.
    // Key-based layers (key-pentatonic, song-key) stay locked to the song key.
    const isChordBased = layer1Kind === "chord-pentatonic" || layer1Kind === "chord-scale";
    const rootString = isChordBased ? (currentChord || songKey) : songKey;
    const parsed = isChordBased
        ? parseChordRootForFocus(rootString)
        : parseSongKeyRoot(rootString);
    if (!parsed) return () => true;

    const ranges = computePatternRanges(
        parsed.root,
        focusArea.activePositions,
        patternSystem,
        parsed.isMinor,
        str0Tuning,
    );

    return (si, fretNum, hasBase) => {
        const tol = hasBase ? 0 : 3;
        const bBonus = si === 4 ? 1 : 0;
        for (const [start, end] of ranges) {
            if (fretNum >= start - tol && fretNum <= end + bBonus + tol) return true;
            if (fretNum >= start + 12 && fretNum <= end + bBonus + 12) return true;
        }
        return false;
    };
}
