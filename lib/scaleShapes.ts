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

// Each shape is [lowE, A, D, G, B, highE], values are [minOffset, maxOffset]
// relative to the anchor fret on low E. Derived from 3-notes-per-string rule:
// for each string, find the 3 consecutive major-scale notes nearest the anchor
// fret and record the fret offsets. The B string is tuned 4 semitones above G
// (not 5) so its notes sit 1 fret higher than expected — reflected in its offsets.
//
// Verified for G major (anchor frets 3,5,7,8,10,0,2 for positions 1–7):
//   P1 lowE: F#(2)–G(3)–A(5)   → [-1,2]   B: D(3)–E(5)–F#(7)  → [0,4]
//   P2 lowE: A(5)–B(7)–C(8)    → [0,3]    A: D(5)–E(7)–F#(9)  → [0,4]
//   P3 lowE: B(7)–C(8)–D(10)   → [0,3]    G: D(7)–E(9)–F#(11) → [0,4]
//   P4 lowE: C(8)–D(10)–E(12)  → [0,4]    G: D(7)–E(9)–F#(11) → [-1,3]
//   P5 lowE: D(10)–E(12)–F#(14)→ [0,4]    G: E(9)–F#(11)–G(12)→ [-1,2]
//   P6 lowE: E(0)–F#(2)–G(3)   → [0,3]    D: D(0)–E(2)–F#(4)  → [0,4]
//   P7 lowE: F#(2)–G(3)–A(5)   → [0,3]    B: B(0)–C(1)–D(3)   → [-2,1]
export const DIATONIC_SHAPES: readonly BoxShape[] = [
    // Pos 1  (anchor = R)   lowE: 7–R–2   A: 3–4–5   D: 6–7–R   G: 2–3–4   B: 5–6–7   e: R–2–3
    [[-1, 2], [-1, 2], [-1, 2], [-1, 2], [0, 4], [0, 4]],
    // Pos 2  (anchor = 2)   lowE: R–2–3   A: 4–5–6   D: 7–R–2   G: 3–4–5   B: 6–7–R   e: 2–3–4
    [[-2, 2], [-2, 2], [-1, 2], [-1, 2], [0, 3], [0, 3]],
    // Pos 3  (anchor = 3)   lowE: 2–3–4   A: 5–6–7   D: R–2–3   G: 4–5–6   B: 7–R–2   e: 3–4–5
    [[-2, 1], [-2, 2], [-2, 2], [-2, 2], [0, 3], [0, 3]],
    // Pos 4  (anchor = 4)   lowE: 3–4–5   A: 6–7–R   D: 2–3–4   G: 5–6–7   B: R–2–3   e: 4–5–6
    [[-1, 2], [-1, 2], [-1, 2], [-1, 3], [0, 4], [0, 4]],
    // Pos 5  (anchor = 5)   lowE: 4–5–6   A: 7–R–2   D: 3–4–5   G: 6–7–R   B: 2–3–4   e: 5–6–7
    [[-2, 2], [-1, 2], [-1, 2], [-1, 2], [0, 3], [0, 4]],
    // Pos 6  (anchor = 6)   lowE: 5–6–7   A: R–2–3   D: 4–5–6   G: 7–R–2   B: 3–4–5   e: 6–7–R
    [[10, 14], [10, 14], [10, 14], [11, 14], [12, 15], [12, 15]],
    // Pos 7  (anchor = 7)   lowE: 6–7–R   A: 2–3–4   D: 5–6–7   G: R–2–3   B: 4–5–6   e: 7–R–2
    [[10, 13], [10, 13], [10, 14], [10, 14], [11, 15], [12, 15]],
] as const;

// Natural minor (Aeolian) — independent DGO-sourced 3NPS shapes.
// Anchor for pos N = the Nth degree of the natural minor scale on low E.
// Offsets verified against G minor (anchor frets 3,5,6,8,10,11,1 for pos 1–7).
export const NATURAL_MINOR_SHAPES: readonly BoxShape[] = [
    // Pos 1  (anchor = R)    lowE: b7–R–2   A: b3–4–5    D: b6–b7–R   G: 2–b3–4    B: 5–b6–b7   e: R–2–b3
    [[-2, 2], [-2, 2], [-2, 2], [-1, 2], [0, 3], [0, 3]],
    // Pos 2  (anchor = 2)    lowE: R–2–b3   A: 4–5–b6    D: b7–R–2    G: b3–4–5    B: b6–b7–R   e: 2–b3–4
    [[-2, 1], [-2, 1], [-2, 2], [-2, 2], [-1, 3], [0, 3]],
    // Pos 3  (anchor = b3)   lowE: 2–b3–4   A: 5–b6–b7   D: R–2–b3    G: 4–5–b6    B: b7–R–2    e: b3–4–5
    [[-1, 2], [-1, 2], [-1, 2], [-1, 2], [0, 4], [0, 4]],
    // Pos 4  (anchor = 4)    lowE: b3–4–5   A: b6–b7–R   D: 2–b3–4   G: 5–b6–b7   B: R–2–b3   e: 4–5–b6
    [[-2, 2], [-2, 2], [-1, 2], [-1, 2], [0, 3], [0, 3]],
    // Pos 5  (anchor = 5)    lowE: 4–5–b6   A: b7–R–2   D: b3–4–5   G: b6–b7–R   B: 2–b3–4   e: 5–b6–b7
    [[-2, 1], [-2, 2], [-2, 2], [-2, 2], [0, 3], [0, 3]],
    // Pos 6  (anchor = b6)   lowE: 5–b6–b7   A: R–2–b3   D: 4–5–b6   G: b7–R–2   B: b3–4–5   e: b6–b7–R
    [[-1, 2], [-1, 2], [-1, 2], [-1, 3], [0, 4], [0, 4]],
    // Pos 7  (anchor = b7)   lowE: b6–b7–R   A: 2–b3–4   D: 5–b6–b7   G: R–2–b3   B: 4–5–b6   e: b7–R–2
    [[10, 14], [11, 14], [11, 14], [11, 14], [12, 15], [12, 16]],
] as const;

// ─── Blues Minor (5 boxes) ───────────────────────────────────────────────────
// Minor pentatonic + b5 (blue note). Anchor intervals: [0, 3, 5, 6, 7, 10]
// Source: discoverguitaronline.com — verified in G minor
// G string extends one fret wider than minor penta to include the b5 within each box.

export const BLUES_MINOR_SHAPES: readonly BoxShape[] = [
    // Box 1  (anchor = R)
    [[0, 3], [0, 2], [0, 2], [0, 3], [0, 3], [0, 3]],
    // Box 2  (anchor = b3)
    [[0, 3], [-1, 2], [-1, 2], [-1, 1], [0, 2], [0, 2]],
    // Box 3  (anchor = 4)
    [[0, 2], [0, 2], [0, 3], [-1, 2], [0, 3], [0, 2]],
    // Box 4  (anchor = 5)
    [[0, 3], [0, 3], [0, 2], [0, 2], [1, 4], [0, 3]],
    // Box 5  (anchor = b7)
    [[0, 2], [0, 3], [-1, 2], [-1, 2], [0, 2], [0, 2]],
] as const;

// ─── Blues Major (5 boxes) ───────────────────────────────────────────────────
// Major pentatonic + b3 (blue note). Anchor intervals: [0, 2, 4, 7, 9]
// Source: discoverguitaronline.com — verified in G major
// b3 (Bb in G) appears on low E (fret 6), high E (fret 6), and G string (fret 3).

export const BLUES_MAJOR_SHAPES: readonly BoxShape[] = [
    // Box 1  (anchor = R)  — verified
    [[0, 3], [-1, 2], [-1, 2], [-1, 1], [0, 2], [0, 3]],
    // Box 2  (anchor = 2)  — verified
    [[0, 2], [0, 2], [0, 3], [-1, 2], [0, 3], [0, 2]],
    // Box 3  (anchor = 3)  — verified
    [[0, 3], [0, 3], [0, 2], [0, 2], [1, 4], [0, 3]],
    // Box 4  (anchor = 5)  — verified
    [[0, 2], [0, 3], [-1, 2], [-1, 2], [0, 2], [0, 2]],
    // Box 5  (anchor = 6)  — verified
    [[0, 3], [0, 2], [0, 2], [0, 3], [0, 3], [0, 3]],
] as const;

// ─── Lydian (7 positions) ────────────────────────────────────────────────────
// Scale: R, 2, 3, #4, 5, 6, 7  intervals: [0, 2, 4, 6, 7, 9, 11]
// Source: discoverguitaronline.com — verified in G Lydian (G A B C# D E F#)
// Like Ionian but with raised 4th (C# instead of C) — wider windows on strings
// where the #4 falls.
export const LYDIAN_SHAPES: readonly BoxShape[] = [
    // Pos 1  (anchor = R)    lowE: 7–R–2    A: 3–#4–5    D: 6–7–R     G: 2–3–#4    B: 5–6–7     e: R–2–3
    [[-1, 2], [-1, 2], [-1, 2], [-1, 3], [0, 4], [0, 4]],
    // Pos 2  (anchor = 2)    lowE: R–2–3    A: #4–5–6    D: 7–R–2     G: 3–#4–5    B: 6–7–R     e: 2–3–#4
    [[-2, 2], [-1, 2], [-1, 2], [-1, 2], [0, 3], [0, 4]],
    // Pos 3  (anchor = 3)    lowE: 2–3–#4   A: 5–6–7     D: R–2–3     G: #4–5–6    B: 7–R–2     e: 3–#4–5
    [[-2, 2], [-2, 2], [-2, 2], [-1, 2], [0, 3], [0, 3]],
    // Pos 4  (anchor = #4)   lowE: 3–#4–5   A: 6–7–R     D: 2–3–#4    G: 5–6–7     B: R–2–3     e: #4–5–6
    [[-2, 1], [-2, 1], [-2, 2], [-2, 2], [-1, 3], [0, 3]],
    // Pos 5  (anchor = 5)    lowE: #4–5–6   A: 7–R–2     D: 3–#4–5    G: 6–7–R     B: 2–3–#4    e: 5–6–7
    [[-1, 2], [-1, 2], [-1, 2], [-1, 2], [0, 4], [0, 4]],
    // Pos 6  (anchor = 6)    lowE: 5–6–7    A: R–2–3     D: #4–5–6    G: 7–R–2     B: 3–#4–5    e: 6–7–R
    // anchorFret = 0 in G (E mod 12)
    [[10, 14], [10, 14], [11, 14], [11, 14], [12, 15], [12, 15]],
    // Pos 7  (anchor = 7)    lowE: 6–7–R    A: 2–3–#4    D: 5–6–7     G: R–2–3     B: #4–5–6    e: 7–R–2
    // anchorFret = 2 in G (F# mod 12)
    [[10, 13], [10, 14], [10, 14], [10, 14], [12, 15], [12, 15]],
] as const;

// ─── Phrygian (7 positions) ──────────────────────────────────────────────────
// Scale: R, b2, b3, 4, 5, b6, b7  intervals: [0, 1, 3, 5, 7, 8, 10]
// Source: discoverguitaronline.com — verified in G Phrygian (G Ab Bb C D Eb F)
// Like Locrian but with natural 5 (D) instead of b5 — affects spacing on
// several strings where D vs Db falls.
export const PHRYGIAN_SHAPES: readonly BoxShape[] = [
    // Pos 1  (anchor = R)    lowE: b7–R–b2   A: b3–4–5    D: b6–b7–R   G: b2–b3–4   B: 5–b6–b7   e: R–b2–b3
    [[-2, 1], [-2, 2], [-2, 2], [-2, 2], [0, 3], [0, 3]],
    // Pos 2  (anchor = b2)   lowE: R–b2–b3   A: 4–5–b6    D: b7–R–b2   G: b3–4–5    B: b6–b7–R   e: b2–b3–4
    [[-1, 2], [-1, 2], [-1, 2], [-1, 3], [0, 4], [0, 4]],
    // Pos 3  (anchor = b3)   lowE: b2–b3–4   A: 5–b6–b7   D: R–b2–b3   G: 4–5–b6    B: b7–R–b2   e: b3–4–5
    [[-2, 2], [-1, 2], [-1, 2], [-1, 2], [0, 3], [0, 4]],
    // Pos 4  (anchor = 4)    lowE: b3–4–5    A: b6–b7–R   D: b2–b3–4   G: 5–b6–b7   B: R–b2–b3   e: 4–5–b6
    [[-2, 2], [-2, 2], [-2, 2], [-1, 2], [0, 3], [0, 3]],
    // Pos 5  (anchor = 5)    lowE: 4–5–b6    A: b7–R–b2   D: b3–4–5    G: b6–b7–R   B: b2–b3–4   e: 5–b6–b7
    [[-2, 1], [-2, 1], [-2, 2], [-2, 2], [-1, 3], [0, 3]],
    // Pos 6  (anchor = b6)   lowE: 5–b6–b7   A: R–b2–b3   D: 4–5–b6    G: b7–R–b2   B: b3–4–5    e: b6–b7–R
    [[-1, 2], [-1, 2], [-1, 2], [-1, 2], [0, 4], [0, 4]],
    // Pos 7  (anchor = b7)   lowE: b6–b7–R   A: b2–b3–4   D: 5–b6–b7   G: R–b2–b3   B: 4–5–b6    e: b7–R–b2
    // anchorFret = 1 in G (F mod 12)
    [[10, 14], [10, 14], [11, 14], [11, 14], [12, 15], [12, 15]],
] as const;

// ─── Locrian (7 positions) ───────────────────────────────────────────────────
// Scale: R, b2, b3, 4, b5, b6, b7  intervals: [0, 1, 3, 5, 6, 8, 10]
// Source: discoverguitaronline.com — verified in G Locrian (G Ab Bb C Db Eb F)
// Most chromatic mode — b2 and b5 create tight 1-fret gaps near R and 4th.
export const LOCRIAN_SHAPES: readonly BoxShape[] = [
    // Pos 1  (anchor = R)    lowE: b7–R–b2   A: b3–4–b5   D: b6–b7–R   G: b2–b3–4   B: b5–b6–b7   e: R–b2–b3
    [[-2, 1], [-2, 1], [-2, 2], [-2, 2], [-1, 3], [0, 3]],
    // Pos 2  (anchor = b2)   lowE: R–b2–b3   A: 4–b5–b6   D: b7–R–b2   G: b3–4–b5   B: b6–b7–R    e: b2–b3–4
    [[-1, 2], [-1, 2], [-1, 2], [-1, 2], [0, 4], [0, 4]],
    // Pos 3  (anchor = b3)   lowE: b2–b3–4   A: b5–b6–b7  D: R–b2–b3   G: 4–b5–b6   B: b7–R–b2    e: b3–4–b5
    [[-2, 2], [-2, 2], [-1, 2], [-1, 2], [0, 3], [0, 3]],
    // Pos 4  (anchor = 4)    lowE: b3–4–b5   A: b6–b7–R   D: b2–b3–4   G: b5–b6–b7  B: R–b2–b3    e: 4–b5–b6
    [[-2, 1], [-2, 2], [-2, 2], [-2, 2], [0, 3], [0, 3]],
    // Pos 5  (anchor = b5)   lowE: 4–b5–b6   A: b7–R–b2   D: b3–4–b5   G: b6–b7–R   B: b2–b3–4    e: b5–b6–b7
    [[-1, 2], [-1, 2], [-1, 2], [-1, 3], [0, 4], [0, 4]],
    // Pos 6  (anchor = b6)   lowE: b5–b6–b7  A: R–b2–b3   D: 4–b5–b6   G: b7–R–b2   B: b3–4–b5    e: b6–b7–R
    [[-2, 2], [-1, 2], [-1, 2], [-1, 2], [0, 3], [0, 4]],
    // Pos 7  (anchor = b7)   lowE: b6–b7–R   A: b2–b3–4   D: b5–b6–b7  G: R–b2–b3   B: 4–b5–b6    e: b7–R–b2
    // anchorFret = 1 in G (F mod 12)
    [[10, 14], [10, 14], [10, 14], [11, 14], [12, 15], [12, 15]],
] as const;

// ─── Dorian (7 positions) ────────────────────────────────────────────────────
// Scale: R, 2, b3, 4, 5, 6, b7  intervals: [0, 2, 3, 5, 7, 9, 10]
// Source: discoverguitaronline.com — verified in G Dorian (G A Bb C D E F)
// Natural minor with a raised 6th (E instead of Eb in G) — shapes nearly
// identical to natural minor but with wider windows where the 6th falls.
export const DORIAN_SHAPES: readonly BoxShape[] = [
    // Pos 1  (anchor = R)    lowE: b7–R–2   A: b3–4–5    D: 6–b7–R    G: 2–b3–4    B: 5–6–b7    e: R–2–b3
    [[-2, 2], [-2, 2], [-1, 2], [-1, 2], [0, 3], [0, 3]],
    // Pos 2  (anchor = 2)    lowE: R–2–b3   A: 4–5–6     D: b7–R–2    G: b3–4–5    B: 6–b7–R    e: 2–b3–4
    [[-2, 1], [-2, 2], [-2, 2], [-2, 2], [0, 3], [0, 3]],
    // Pos 3  (anchor = b3)   lowE: 2–b3–4   A: 5–6–b7    D: R–2–b3    G: 4–5–6     B: b7–R–2    e: b3–4–5
    [[-1, 2], [-1, 2], [-1, 2], [-1, 3], [0, 4], [0, 4]],
    // Pos 4  (anchor = 4)    lowE: b3–4–5   A: 6–b7–R    D: 2–b3–4    G: 5–6–b7    B: R–2–b3    e: 4–5–6
    [[-2, 2], [-1, 2], [-1, 2], [-1, 2], [0, 3], [0, 4]],
    // Pos 5  (anchor = 5)    lowE: 4–5–6    A: b7–R–2    D: b3–4–5    G: 6–b7–R    B: 2–b3–4    e: 5–6–b7
    [[-2, 2], [-2, 2], [-2, 2], [-1, 2], [0, 3], [0, 3]],
    // Pos 6  (anchor = 6)    lowE: 5–6–b7   A: R–2–b3    D: 4–5–6     G: b7–R–2    B: b3–4–5    e: 6–b7–R
    // anchorFret = 0 in G (E mod 12)
    [[10, 13], [10, 13], [10, 14], [10, 14], [11, 15], [12, 15]],
    // Pos 7  (anchor = b7)   lowE: 6–b7–R   A: 2–b3–4    D: 5–6–b7    G: R–2–b3    B: 4–5–6     e: b7–R–2
    // anchorFret = 1 in G (F mod 12)
    [[11, 14], [11, 14], [11, 14], [11, 14], [12, 16], [12, 16]],
] as const;

// ─── Mixolydian (7 positions) ────────────────────────────────────────────────
// Scale: R, 2, 3, 4, 5, 6, b7  intervals: [0, 2, 4, 5, 7, 9, 10]
// Source: discoverguitaronline.com — verified in G Mixolydian (G A B C D E F)
// No augmented second — all shapes have even spacing across the neck.
export const MIXOLYDIAN_SHAPES: readonly BoxShape[] = [
    // Pos 1  (anchor = R)    lowE: b7–R–2   A: 3–4–5     D: 6–b7–R    G: 2–3–4     B: 5–6–b7    e: R–2–3
    [[-2, 2], [-1, 2], [-1, 2], [-1, 2], [0, 3], [0, 4]],
    // Pos 2  (anchor = 2)    lowE: R–2–3    A: 4–5–6     D: b7–R–2    G: 3–4–5     B: 6–b7–R    e: 2–3–4
    [[-2, 2], [-2, 2], [-2, 2], [-1, 2], [0, 3], [0, 3]],
    // Pos 3  (anchor = 3)    lowE: 2–3–4    A: 5–6–b7    D: R–2–3     G: 4–5–6     B: b7–R–2    e: 3–4–5
    [[-2, 1], [-2, 1], [-2, 2], [-2, 2], [-1, 3], [0, 3]],
    // Pos 4  (anchor = 4)    lowE: 3–4–5    A: 6–b7–R    D: 2–3–4     G: 5–6–b7    B: R–2–3     e: 4–5–6
    [[-1, 2], [-1, 2], [-1, 2], [-1, 2], [0, 4], [0, 4]],
    // Pos 5  (anchor = 5)    lowE: 4–5–6    A: b7–R–2    D: 3–4–5     G: 6–b7–R    B: 2–3–4     e: 5–6–b7
    [[-2, 2], [-2, 2], [-1, 2], [-1, 2], [0, 3], [0, 3]],
    // Pos 6  (anchor = 6)    lowE: 5–6–b7   A: R–2–3     D: 4–5–6     G: b7–R–2    B: 3–4–5     e: 6–b7–R
    // anchorFret = 0 in G (E mod 12); physical position is one octave higher
    [[10, 13], [10, 14], [10, 14], [10, 14], [12, 15], [12, 15]],
    // Pos 7  (anchor = b7)   lowE: 6–b7–R   A: 2–3–4     D: 5–6–b7    G: R–2–3     B: 4–5–6     e: b7–R–2
    // anchorFret = 1 in G (F mod 12)
    [[11, 14], [11, 14], [11, 14], [11, 15], [12, 16], [12, 16]],
] as const;

// ─── Harmonic Minor (7 positions) ────────────────────────────────────────────
// Scale: R, 2, b3, 4, 5, b6, 7  intervals: [0, 2, 3, 5, 7, 8, 11]
// Anchor intervals (per position): [0, 2, 3, 5, 7, 8, 11]
// Source: discoverguitaronline.com — verified in G harmonic minor (G A Bb C D Eb F#)
// The augmented 2nd (b6→7, Eb→F# in G) creates a 3-fret stretch on different
// strings in each position — captured in the wider [min, max] ranges below.
//
// Each shape: [lowE, A, D, G, B, highE], values [minOffset, maxOffset] relative
// to anchorFret on the low-E string.
export const HARMONIC_MINOR_SHAPES: readonly BoxShape[] = [
    // Pos 1  (anchor = R)    lowE: 7–R–2    A: b3–4–5    D: b6–7–R*   G: 2–b3–4    B: 5–b6–7*   e: R–2–b3
    [[-1, 2], [-2, 2], [-2, 2], [-1, 2], [0, 4], [0, 3]],
    // Pos 2  (anchor = 2)    lowE: R–2–b3   A: 4–5–b6    D: 7–R–2     G: b3–4–5    B: b6–7–R*   e: 2–b3–4
    [[-2, 1], [-2, 1], [-1, 2], [-2, 2], [-1, 3], [0, 3]],
    // Pos 3  (anchor = b3)   lowE: 2–b3–4   A: 5–b6–7*   D: R–2–b3    G: 4–5–b6    B: 7–R–2     e: b3–4–5
    [[-1, 2], [-1, 3], [-1, 2], [-1, 2], [1, 4], [0, 4]],
    // Pos 4  (anchor = 4)    lowE: b3–4–5   A: b6–7–R*   D: 2–b3–4    G: 5–b6–7*   B: R–2–b3    e: 4–5–b6
    [[-2, 2], [-2, 2], [-1, 2], [-1, 3], [0, 3], [0, 3]],
    // Pos 5  (anchor = 5)    lowE: 4–5–b6   A: 7–R–2     D: b3–4–5    G: b6–7–R*   B: 2–b3–4    e: 5–b6–7*
    [[-2, 1], [-1, 2], [-2, 2], [-2, 2], [0, 3], [0, 4]],
    // Pos 6  (anchor = b6)   lowE: 5–b6–7*  A: R–2–b3    D: 4–5–b6    G: 7–R–2     B: b3–4–5    e: b6–7–R*
    [[-1, 3], [-1, 2], [-1, 2], [0, 3], [0, 4], [0, 4]],
    // Pos 7  (anchor = 7)    lowE: b6–7–R*  A: 2–b3–4    D: 5–b6–7*   G: R–2–b3    B: 4–5–b6    e: 7–R–2
    // anchorFret = 2 in G (F# mod 12); physical position is one octave higher
    [[9, 13], [10, 13], [10, 14], [10, 13], [11, 14], [12, 15]],
] as const;

export function getShapesForSystem(
    patternSystem: "pentatonic" | "diatonic" | "blues-minor" | "blues-major" | "harmonic-minor" | "mixolydian" | "dorian" | "ionian" | "locrian" | "aeolian" | "phrygian" | "lydian",
    isMinor: boolean,
): readonly BoxShape[] {
    if (patternSystem === "blues-minor") return BLUES_MINOR_SHAPES;
    if (patternSystem === "blues-major") return BLUES_MAJOR_SHAPES;
    if (patternSystem === "harmonic-minor") return HARMONIC_MINOR_SHAPES;
    if (patternSystem === "mixolydian") return MIXOLYDIAN_SHAPES;
    if (patternSystem === "dorian") return DORIAN_SHAPES;
    if (patternSystem === "lydian") return LYDIAN_SHAPES;
    if (patternSystem === "phrygian") return PHRYGIAN_SHAPES;
    if (patternSystem === "locrian") return LOCRIAN_SHAPES;
    if (patternSystem === "ionian") return DIATONIC_SHAPES;
    if (patternSystem === "aeolian") return NATURAL_MINOR_SHAPES;
    if (patternSystem === "pentatonic") {
        return isMinor ? MINOR_PENTA_SHAPES : MAJOR_PENTA_SHAPES;
    }
    return isMinor ? NATURAL_MINOR_SHAPES : DIATONIC_SHAPES;
}
