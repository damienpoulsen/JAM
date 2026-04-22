import { Layer } from "./layers";

export type MergedNote = {
    note: number;
    baseLayer: Layer | undefined;
    overlayLayer: Layer | undefined;
    overlay2Layer: Layer | undefined;
};

export function mergeLayers(layers: Layer[]): MergedNote[] {
    const noteMap: Record<number, { base?: Layer; overlay?: Layer; overlay2?: Layer }> = {};

    for (const layer of layers) {
        for (const note of layer.notes) {
            if (!noteMap[note]) noteMap[note] = {};
            if (layer.role === "base")     noteMap[note].base    = layer;
            if (layer.role === "overlay")  noteMap[note].overlay = layer;
            if (layer.role === "overlay2") noteMap[note].overlay2 = layer;
        }
    }

    return Object.entries(noteMap).map(([note, entry]) => ({
        note: Number(note),
        baseLayer: entry.base,
        overlayLayer: entry.overlay,
        overlay2Layer: entry.overlay2,
    }));
}
