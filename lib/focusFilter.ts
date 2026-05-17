import { type FocusArea, getFocusAreaPatternSystem, type LayerKind } from "./layers";
import { getShapesForSystem } from "./scaleShapes";

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

const MINOR_PENTA    = [0, 3, 5, 7, 10] as const;
const MAJOR_PENTA    = [0, 2, 4, 7,  9] as const;
const MAJOR_SCALE    = [0, 2, 4, 5, 7, 9, 11] as const;
const NATURAL_MINOR  = [0, 2, 3, 5, 7, 8, 10] as const;

function getAnchorIntervals(patternSystem: "pentatonic" | "diatonic", isMinor: boolean) {
    if (patternSystem === "pentatonic") return isMinor ? MINOR_PENTA : MAJOR_PENTA;
    return isMinor ? NATURAL_MINOR : MAJOR_SCALE;
}

function parseChordRootForFocus(chordName: string): { root: number; isMinor: boolean } | null {
    const match = chordName.trim().match(/^([A-G](?:#|b)?)(.*)/);
    if (!match) return null;
    const root = NOTE_NAME_TO_INDEX[match[1]];
    if (root === undefined) return null;
    const suffix = match[2].trim().toLowerCase().split("/")[0].trim();
    const isMinor = suffix.length > 0 && suffix[0] === "m" && !suffix.startsWith("maj");
    return { root, isMinor };
}

/**
 * fretNum: 0 = open string, 1–24 = fretted position.
 * hasBaseLayer: true when the note belongs to a scale/base layer (strict),
 *               false when it is only an overlay (chord tones / triads → +1 fret tolerance).
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
            const tol = hasBase ? 0 : 1;
            return fretNum >= startFret - tol && fretNum <= endFret + tol;
        };
    }

    // Pattern-based positions (boxes / diatonic positions)
    const patternSystem = getFocusAreaPatternSystem(layer1Kind);
    if (!patternSystem || focusArea.activePositions.length === 0) return () => true;

    const isChordBased = layer1Kind === "chord-pentatonic" || layer1Kind === "chord-scale";
    const rootString = isChordBased ? (currentChord || songKey) : songKey;
    const parsed = isChordBased
        ? parseChordRootForFocus(rootString)
        : parseSongKeyRoot(rootString);
    if (!parsed) return () => true;

    const intervals = getAnchorIntervals(patternSystem, parsed.isMinor);
    const shapes = getShapesForSystem(patternSystem, parsed.isMinor);
    const maxPos = intervals.length;

    // Pre-compute per-position anchor frets and shapes
    const posData = focusArea.activePositions
        .filter((pos) => pos >= 1 && pos <= maxPos)
        .map((pos) => {
            const degreeIdx = pos - 1;
            const anchorNote = (parsed.root + intervals[degreeIdx]) % 12;
            const anchorFret = ((anchorNote - str0Tuning) % 12 + 12) % 12;
            const shape = shapes[degreeIdx];
            return { anchorFret, shape };
        });

    return (si, fretNum, hasBase) => {
        const tol = hasBase ? 0 : 1;
        for (const { anchorFret, shape } of posData) {
            const [minOff, maxOff] = shape[si] ?? shape[0];
            const lo = anchorFret + minOff;
            const hi = anchorFret + maxOff;
            if (fretNum >= lo - tol && fretNum <= hi + tol) return true;
            // Octave-up check (same shape 12 frets higher) — always strict, no tolerance
            if (fretNum >= lo + 12 && fretNum <= hi + 12) return true;
        }
        return false;
    };
}
