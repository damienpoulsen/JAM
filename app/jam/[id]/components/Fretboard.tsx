"use client";

import type { MergedNote } from "@/lib/layerManager";
import type { Layer } from "@/lib/layers";

function hexLuminance(hex: string): number {
    const h = hex.replace("#", "");
    if (h.length !== 6) return 0.5;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

type FretboardProps = {
    boardColorOverride?: string;
    stringColorOverride?: string;
    markerColorOverride?: string;
    labelTextColor?: "white" | "black";
    noteTextColor?: "white" | "black";
    compact?: boolean;
    fretMarkers: number[];
    frets: number;
    getDisplayedFretboardLabel: (noteIndex: number) => string;
    mergedNoteMap: Map<number, MergedNote>;
    overlayFilled: boolean;
    strings: number;
    tuning: string[];
    tuningIndex: number[];
};

function NoteCircle({
    baseLayer,
    overlayLayer,
    overlay2Layer,
    overlayFilled,
    effectiveTextColor,
    label,
    size,
}: {
    baseLayer: Layer | undefined;
    overlayLayer: Layer | undefined;
    overlay2Layer: Layer | undefined;
    overlayFilled: boolean;
    effectiveTextColor: string | undefined;
    label: string;
    size: number;
}) {
    const hasBoth = !!(baseLayer && overlayLayer);

    // Fill is always the base layer — unless overlay is flipped and both exist
    const fillLayer = (overlayFilled && hasBoth) ? overlayLayer! : (baseLayer ?? overlayLayer ?? overlay2Layer);
    if (!fillLayer) return null;

    // Ring only appears when a note belongs to both base and overlay
    const ringLayer = hasBoth ? (overlayFilled ? baseLayer : overlayLayer) : undefined;
    // Arc only appears on the ring — 15% at the bottom
    const arcLayer = ringLayer ? overlay2Layer : undefined;

    const fill = fillLayer.style.fill;
    const textColor = effectiveTextColor ?? fillLayer.style.textColor;
    const ringThickness = 4;

    let ringBg: string | null = null;
    let ringGlow: string | undefined;
    if (ringLayer) {
        const rc = ringLayer.style.fill;
        ringGlow = `0 0 10px 2px ${rc}70`;
        ringBg = arcLayer
            ? `conic-gradient(${rc} 0deg 153deg, ${arcLayer.style.fill} 153deg 207deg, ${rc} 207deg 360deg)`
            : rc;
    }

    const inner = (
        <div
            className="flex items-center justify-center rounded-full font-bold shadow-[0_0_8px_rgba(15,23,42,0.4)]"
            style={{
                fontFamily: "'Rajdhani', sans-serif",
                width: size,
                height: size,
                fontSize: size <= 32 ? 11 : 14,
                backgroundColor: fill,
                color: textColor,
                flexShrink: 0,
            }}
        >
            {label}
        </div>
    );

    if (!ringBg) return inner;

    return (
        <div
            className="flex items-center justify-center rounded-full"
            style={{
                width: size + ringThickness * 2,
                height: size + ringThickness * 2,
                background: ringBg,
                boxShadow: ringGlow,
                flexShrink: 0,
            }}
        >
            {inner}
        </div>
    );
}

export default function Fretboard({
    boardColorOverride,
    stringColorOverride,
    markerColorOverride,
    labelTextColor,
    noteTextColor,
    compact,
    fretMarkers,
    frets,
    getDisplayedFretboardLabel,
    mergedNoteMap,
    overlayFilled,
    strings,
    tuning,
    tuningIndex,
}: FretboardProps) {
    const stringsHeightPx = compact ? 260 : 332;
    const noteSize = compact ? 28 : 36;
    const boardBackground = boardColorOverride ?? "#0f1115";
    const isDarkBoard = hexLuminance(boardBackground) < 0.45;
    const boardBorder = isDarkBoard ? "#f4f4f5" : "#000000";
    const boardGlow = isDarkBoard ? "0 18px 40px rgba(0,0,0,0.52)" : "0 18px 40px rgba(0,0,0,0.16)";
    const innerGradient = isDarkBoard
        ? "linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))"
        : "linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0.06))";
    const stringColor = stringColorOverride ?? (isDarkBoard ? "#ffffff" : "#000000");
    const markerColor = markerColorOverride ?? (isDarkBoard ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.45)");
    const effectiveLabelMode = labelTextColor ?? (isDarkBoard ? "white" : "black");
    const labelColor = effectiveLabelMode === "white" ? "rgba(255,255,255,0.86)" : "rgba(0,0,0,0.8)";
    const openNoteFallbackFill = boardBackground;
    const openNoteFallbackText = isDarkBoard ? "#f5f5f5" : "#111111";
    const openNoteFallbackBorder = isDarkBoard ? "2px solid #f5f5f5" : "2px solid #111111";
    const effectiveNoteTextColor = noteTextColor === "black" ? "#111111" : noteTextColor === "white" ? "#ffffff" : undefined;

    return (
        <div className={`mt-0 flex flex-1 items-start justify-center ${compact ? "mb-0" : "mb-6"}`}>
            <div className="w-[98%] max-w-[1600px]">
                <div
                    className="relative rounded-[24px] border-[3px] px-10 pt-5 pb-2"
                    style={{ borderColor: boardBorder, backgroundColor: boardBackground, boxShadow: boardGlow }}
                >
                    <div className="flex">
                        {/* Open string notes */}
                        <div className="relative mr-6 w-9" style={{ height: `${stringsHeightPx}px` }}>
                            {[...tuning].reverse().map((note, index) => {
                                const stringIndex = strings - index - 1;
                                const openNoteIndex = tuningIndex[stringIndex];
                                const noteData = mergedNoteMap.get(openNoteIndex);

                                return (
                                    <div
                                        key={`${note}-${index}`}
                                        className="absolute left-0 flex w-full -translate-y-1/2 items-center justify-center"
                                        style={{ top: `${(index + 0.5) * (100 / strings)}%` }}
                                    >
                                        {noteData ? (
                                            <NoteCircle
                                                baseLayer={noteData.baseLayer}
                                                overlayLayer={noteData.overlayLayer}
                                                overlay2Layer={noteData.overlay2Layer}
                                                overlayFilled={overlayFilled}
                                                effectiveTextColor={effectiveNoteTextColor}
                                                label={getDisplayedFretboardLabel(openNoteIndex)}
                                                size={noteSize}
                                            />
                                        ) : (
                                            <div
                                                className="flex items-center justify-center rounded-full font-bold"
                                                style={{
                                                    fontFamily: "'Rajdhani', sans-serif",
                                                    width: noteSize,
                                                    height: noteSize,
                                                    fontSize: noteSize <= 32 ? 11 : 14,
                                                    backgroundColor: openNoteFallbackFill,
                                                    color: openNoteFallbackText,
                                                    border: openNoteFallbackBorder,
                                                }}
                                            >
                                                {getDisplayedFretboardLabel(openNoteIndex)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex-1">
                            <div className="relative" style={{ height: `${stringsHeightPx}px` }}>
                                <div className="absolute inset-0 rounded-[14px]" style={{ backgroundImage: innerGradient }} />
                                <div
                                    className="absolute left-0 z-10 w-[10px] bg-[#c92f2f]"
                                    style={{ top: `${0.5 * (100 / strings)}%`, bottom: `${0.5 * (100 / strings)}%` }}
                                />

                                {Array.from({ length: strings }).map((_, index) => (
                                    <div
                                        key={index}
                                        className="absolute left-0 right-0 border-t-[4px]"
                                        style={{ top: `${(index + 0.5) * (100 / strings)}%`, borderColor: stringColor }}
                                    />
                                ))}

                                <div
                                    className="absolute left-0 right-0"
                                    style={{ top: `${0.5 * (100 / strings)}%`, bottom: `${0.5 * (100 / strings)}%` }}
                                >
                                    <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${frets}, 1fr)` }}>
                                        {Array.from({ length: frets }).map((_, index) => (
                                            <div key={index} className="h-full border-l-[3px]" style={{ borderColor: stringColor }} />
                                        ))}
                                    </div>
                                </div>

                                {fretMarkers.map((fret) => {
                                    const isDouble = fret === 12;
                                    const left = `${(fret - 0.5) * (100 / frets)}%`;
                                    if (isDouble) {
                                        return (
                                            <div key={`marker-${fret}`} className="absolute" style={{ left, top: "50%", transform: "translate(-50%, -50%)" }}>
                                                <div className="flex flex-col items-center" style={{ gap: `${Math.round(68 * stringsHeightPx / 332)}px` }}>
                                                    <div className="h-7 w-7 rounded-full" style={{ backgroundColor: markerColor }} />
                                                    <div className="h-7 w-7 rounded-full" style={{ backgroundColor: markerColor }} />
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={`marker-${fret}`} className="absolute h-7 w-7 rounded-full" style={{ left, top: "50%", transform: "translate(-50%, -50%)", backgroundColor: markerColor }} />
                                    );
                                })}

                                {Array.from({ length: frets }).map((_, fretIndex) =>
                                    Array.from({ length: strings }).map((_, stringIndex) => {
                                        const noteIndex = (tuningIndex[stringIndex] + fretIndex + 1) % 12;
                                        const noteData = mergedNoteMap.get(noteIndex);
                                        if (!noteData) return null;

                                        return (
                                            <div
                                                key={`${fretIndex}-${stringIndex}`}
                                                className="absolute flex items-center justify-center"
                                                style={{
                                                    left: `${(fretIndex + 0.5) * (100 / frets)}%`,
                                                    top: `${(strings - stringIndex - 0.5) * (100 / strings)}%`,
                                                    transform: "translate(-50%, -50%)",
                                                }}
                                            >
                                                <NoteCircle
                                                    baseLayer={noteData.baseLayer}
                                                    overlayLayer={noteData.overlayLayer}
                                                    overlay2Layer={noteData.overlay2Layer}
                                                    overlayFilled={overlayFilled}
                                                    effectiveTextColor={effectiveNoteTextColor}
                                                    label={getDisplayedFretboardLabel(noteIndex)}
                                                    size={noteSize}
                                                />
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="flex h-[32px] items-start pt-1">
                                {Array.from({ length: frets }).map((_, fretIndex) => {
                                    const fretNumber = fretIndex + 1;
                                    return (
                                        <div key={`label-${fretNumber}`} className="flex-1 text-center text-[14px] font-extrabold tracking-[0.08em]" style={{ color: labelColor }}>
                                            {fretMarkers.includes(fretNumber) ? `${fretNumber}fr.` : ""}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
