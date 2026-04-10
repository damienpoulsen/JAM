// 🎸 basic chord tone mapping (triads + some 7ths)

export const chordTones: Record<string, number[]> = {
    // MAJOR TRIADS
    "C": [0, 4, 7],
    "D": [2, 6, 9],
    "E": [4, 8, 11],
    "F": [5, 9, 0],
    "G": [7, 11, 2],
    "A": [9, 1, 4],
    "B": [11, 3, 6],

    // MINOR TRIADS
    "Cm": [0, 3, 7],
    "Dm": [2, 5, 9],
    "Em": [4, 7, 11],
    "Fm": [5, 8, 0],
    "Gm": [7, 10, 2],
    "Am": [9, 0, 4],
    "Bm": [11, 2, 6],

    // MAJ7
    "Gmaj7": [7, 11, 2, 6],
    "Cmaj7": [0, 4, 7, 11],

    // DOMINANT 7
    "E7": [4, 8, 11, 2],
    "A7": [9, 1, 4, 7],

    // YOUR SONG
    "Fmaj": [5, 9, 0],
};