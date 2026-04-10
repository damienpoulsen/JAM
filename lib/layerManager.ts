import { Layer } from "./layers";

export type MergedNote = {
    note: number;
    layers: Layer[];
    topLayer: Layer;
};

export function mergeLayers(layers: Layer[]): MergedNote[] {
    const noteMap: Record<number, Layer[]> = {};

    layers.forEach((layer) => {
        layer.notes.forEach((note) => {
            if (!noteMap[note]) {
                noteMap[note] = [];
            }

            noteMap[note].push(layer);
        });
    });

    return Object.entries(noteMap).map(([note, noteLayers]) => {
        const sortedLayers = [...noteLayers].sort((a, b) => a.priority - b.priority);

        return {
            note: Number(note),
            layers: sortedLayers,
            topLayer: sortedLayers[0],
        };
    });
}
