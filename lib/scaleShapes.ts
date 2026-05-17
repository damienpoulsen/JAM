/**
 * Per-string fret-offset shapes for each scale position, sourced from
 * discoverguitaronline.com diagrams.
 *
 * Each BoxShape is [lowE, A, D, G, B, highE].
 * Each string entry is [minOffset, maxOffset] relative to the anchor fret
 * (the position's characteristic note on the low-E string).
 *
 * Anchor fret = ((root + anchorInterval - str0Tuning) % 12 + 12) % 12
 * where anchorInterval comes from the scale's interval array at degree (pos-1).
 */

export type StringRange = readonly [number, number]; // [minOffset, maxOffset]
export type BoxShape = readonly [StringRange, StringRange, StringRange, StringRange, StringRange, StringRange];

// ─── Minor Pentatonic (5 boxes) ──────────────────────────────────────────────
// Anchor intervals: [0, 3, 5, 7, 10]  (R, b3, 4, 5, b7)
// Source: discoverguitaronline.com/diagrams/view/5
//
// Box 1 — root on low E and high e
// Box 2 — root on D and B strings
// Box 3 — root on A and G strings (via octave)
// Box 4 — root on G and low E (via octave)
// Box 5 — root on G and A strings

export const MINOR_PENTA_SHAPES: readonly BoxShape[] = [
    // Box 1  (anchor = R)
    [[0, 3], [0, 2], [0, 2], [0, 2], [0, 3], [0, 3]],
    // Box 2  (anchor = b3)
    [[0, 2], [-1, 2], [-1, 2], [-1, 1], [0, 2], [0, 2]],
    // Box 3  (anchor = 4)
    [[0, 2], [0, 2], [0, 2], [-1, 2], [0, 3], [0, 2]],
    // Box 4  (anchor = 5)
    [[0, 3], [0, 3], [0, 2], [0, 2], [1, 3], [0, 3]],
    // Box 5  (anchor = b7)
    [[0, 2], [0, 2], [-1, 2], [-1, 2], [-2, 0], [0, 2]],
] as const;

// ─── Major Pentatonic (5 boxes) ──────────────────────────────────────────────
// Anchor intervals: [0, 2, 4, 7, 9]  (R, 2, 3, 5, 6)
// Source: discoverguitaronline.com/diagrams/view/53
//
// Major penta shares the same 5 physical shapes as minor penta — they are the
// same note set rotated.  Major box N uses the same shape as minor box (N+1)%5.

export const MAJOR_PENTA_SHAPES: readonly BoxShape[] = [
    // Box 1  (anchor = R)   ≡ minor box 2
    [[0, 2], [-1, 2], [-1, 2], [-1, 1], [0, 2], [0, 2]],
    // Box 2  (anchor = 2)   ≡ minor box 3
    [[0, 2], [0, 2], [0, 2], [-1, 2], [0, 3], [0, 2]],
    // Box 3  (anchor = 3)   ≡ minor box 4
    [[0, 3], [0, 3], [0, 2], [0, 2], [1, 3], [0, 3]],
    // Box 4  (anchor = 5)   ≡ minor box 5
    [[0, 2], [0, 2], [-1, 2], [-1, 2], [-2, 0], [0, 2]],
    // Box 5  (anchor = 6)   ≡ minor box 1
    [[0, 3], [0, 2], [0, 2], [0, 2], [0, 3], [0, 3]],
] as const;

// ─── Diatonic scales (7 positions) ───────────────────────────────────────────
// Major and natural minor share the same 7 physical shapes (rotations of each
// other).  Dorian and Mixolydian also share these shapes since they are modes
// of the same parent scale.
//
// Source: discoverguitaronline.com/diagrams/view/1 (major)
//         discoverguitaronline.com/diagrams/view/2 (natural minor)
//         discoverguitaronline.com/diagrams/view/11 (dorian)
//         discoverguitaronline.com/diagrams/view/13 (mixolydian)
//
// Anchor intervals for MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
// Each position includes 2–3 notes per string across a 4-fret window.
// The B string (index 4) is tuned a semitone short of standard, so its
// highest note sits 1–2 frets above the other strings' upper bound.

export const DIATONIC_SHAPES: readonly BoxShape[] = [
    // Pos 1  (anchor = R / degree 1)
    // lowE: 7th–R–2nd  A: 4th–5th–6th  D: 1st–2nd–3rd  G: same  B: 5th–6th–7th  e: 7th–R–2nd
    [[-1, 2], [-1, 2], [-1, 2], [-1, 2], [0, 4], [-1, 2]],
    // Pos 2  (anchor = 2 / degree 2)
    // lowE: 2nd–3rd–4th
    [[0, 3], [0, 2], [0, 2], [-1, 2], [0, 4], [0, 3]],
    // Pos 3  (anchor = 3 / degree 3)
    [[0, 2], [0, 2], [-1, 2], [-1, 2], [0, 3], [0, 2]],
    // Pos 4  (anchor = 4 / degree 4)
    [[0, 3], [-1, 2], [-1, 2], [0, 2], [0, 3], [0, 3]],
    // Pos 5  (anchor = 5 / degree 5)
    [[0, 2], [0, 2], [0, 2], [-1, 2], [0, 3], [0, 2]],
    // Pos 6  (anchor = 6 / degree 6)
    [[0, 3], [0, 3], [0, 2], [0, 2], [1, 3], [0, 3]],
    // Pos 7  (anchor = 7 / degree 7)
    [[0, 2], [0, 2], [-1, 2], [-1, 2], [-1, 1], [0, 2]],
] as const;

export function getShapesForSystem(
    patternSystem: "pentatonic" | "diatonic",
    isMinor: boolean,
): readonly BoxShape[] {
    if (patternSystem === "pentatonic") {
        return isMinor ? MINOR_PENTA_SHAPES : MAJOR_PENTA_SHAPES;
    }
    return DIATONIC_SHAPES;
}
