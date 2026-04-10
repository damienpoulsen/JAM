export type Song = {
    id: string;
    fileId: string;
    name: string;
    key: string;
    bpm: number | string;
    analysisStatus?: "pending" | "loading" | "ready" | "error";
};

export const SONGS_STORAGE_KEY = "songs";

export function readSongs(): Song[] {
    if (typeof window === "undefined") {
        return [];
    }

    const stored = window.localStorage.getItem(SONGS_STORAGE_KEY);
    if (!stored) {
        return [];
    }

    try {
        return (JSON.parse(stored) as Song[]).map((song) => ({
            ...song,
            analysisStatus:
                song.analysisStatus === "pending" ||
                song.analysisStatus === "loading" ||
                song.analysisStatus === "ready" ||
                song.analysisStatus === "error"
                    ? song.analysisStatus
                    : "ready",
        }));
    } catch {
        return [];
    }
}

export function writeSongs(songs: Song[]) {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(songs));
}
