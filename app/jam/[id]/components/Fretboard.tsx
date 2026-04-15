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
    fretMarkers: number[];
    frets: number;
    getDisplayedFretboardLabel: (noteIndex: number) => string;
    getLayerBorderStyle: (fillLayers: Layer[], borderWidth: number) => string;
    mergedNoteMap: Map<number, MergedNote>;
    strings: number;
    tuning: string[];
    tuningIndex: number[];
};

export default function Fretboard({
    boardColorOverride,
    stringColorOverride,
    markerColorOverride,
    labelTextColor,
    noteTextColor,
    fretMarkers,
    frets,
    getDisplayedFretboardLabel,
    getLayerBorderStyle,
    mergedNoteMap,
    strings,
    tuning,
    tuningIndex,
}: FretboardProps) {
    const boardBackground = boardColorOverride ?? "#0f1115";
    const isDarkBoard = hexLuminance(boardBackground) < 0.45;
    const boardBorder = isDarkBoard ? "#f4f4f5" : "#000000";
    const boardGlow = isDarkBoard
        ? "0 18px 40px rgba(0,0,0,0.52)"
        : "0 18px 40px rgba(0,0,0,0.16)";
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
        <div className="mt-0 mb-6 flex flex-1 items-start justify-center">
            <div className="w-[98%] max-w-[1600px]">
                <div
                    className="relative rounded-[24px] border-[3px] px-10 pt-5 pb-2"
                    style={{
                        borderColor: boardBorder,
                        backgroundColor: boardBackground,
                        boxShadow: boardGlow,
                    }}
                >
                    <div className="flex">
                        <div className="relative mr-6 h-[332px] w-9">
                            {[...tuning].reverse().map((note, index) => {
                                const stringIndex = strings - index - 1;
                                const openNoteIndex = tuningIndex[stringIndex];
                                const openNoteData = mergedNoteMap.get(openNoteIndex);

                                return (
                                    <div
                                        key={`${note}-${index}`}
                                        className="absolute left-0 flex w-9 -translate-y-1/2 items-center justify-center font-bold"
                                        style={{
                                            top: `${(index + 0.5) * (100 / strings)}%`,
                                            color: openNoteFallbackText,
                                        }}
                                    >
                                        <div
                                            className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-base font-bold transition-colors"
                                            style={{
                                                fontFamily: "'Rajdhani', sans-serif",
                                                backgroundColor: openNoteData?.topLayer.style.fill ?? openNoteFallbackFill,
                                                color: openNoteData ? (effectiveNoteTextColor ?? openNoteData.topLayer.style.textColor) : openNoteFallbackText,
                                                border: openNoteData
                                                    ? getLayerBorderStyle(openNoteData.layers, 2)
                                                    : openNoteFallbackBorder,
                                            }}
                                        >
                                            {getDisplayedFretboardLabel(openNoteIndex)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex-1">
                            <div className="relative h-[332px]">
                                <div
                                    className="absolute inset-0 rounded-[14px]"
                                    style={{ backgroundImage: innerGradient }}
                                />
                                <div
                                    className="absolute left-0 z-10 w-[10px] bg-[#c92f2f]"
                                    style={{
                                        top: `${0.5 * (100 / strings)}%`,
                                        bottom: `${0.5 * (100 / strings)}%`,
                                    }}
                                />

                                {Array.from({ length: strings }).map((_, index) => (
                                    <div
                                        key={index}
                                        className="absolute left-0 right-0 border-t-[4px]"
                                        style={{
                                            top: `${(index + 0.5) * (100 / strings)}%`,
                                            borderColor: stringColor,
                                        }}
                                    />
                                ))}

                                <div
                                    className="absolute left-0 right-0"
                                    style={{
                                        top: `${0.5 * (100 / strings)}%`,
                                        bottom: `${0.5 * (100 / strings)}%`,
                                    }}
                                >
                                    <div
                                        className="grid h-full w-full"
                                        style={{
                                            gridTemplateColumns: `repeat(${frets}, 1fr)`,
                                        }}
                                    >
                                        {Array.from({ length: frets }).map((_, index) => (
                                            <div
                                                key={index}
                                                className="h-full border-l-[3px]"
                                                style={{ borderColor: stringColor }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {fretMarkers.map((fret) => {
                                    const isDoubleMarker = fret === 12;
                                    const left = `${(fret - 0.5) * (100 / frets)}%`;

                                    if (isDoubleMarker) {
                                        return (
                                            <div
                                                key={`marker-${fret}`}
                                                className="absolute"
                                                style={{
                                                    left,
                                                    top: "50%",
                                                    transform: "translate(-50%, -50%)",
                                                }}
                                            >
                                                <div className="flex flex-col items-center gap-[68px]">
                                                    <div className="h-7 w-7 rounded-full" style={{ backgroundColor: markerColor }} />
                                                    <div className="h-7 w-7 rounded-full" style={{ backgroundColor: markerColor }} />
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={`marker-${fret}`}
                                            className="absolute h-7 w-7 rounded-full"
                                            style={{
                                                left,
                                                top: "50%",
                                                transform: "translate(-50%, -50%)",
                                                backgroundColor: markerColor,
                                            }}
                                        />
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
                                                className="absolute"
                                                style={{
                                                    left: `${(fretIndex + 0.5) * (100 / frets)}%`,
                                                    top: `${(strings - stringIndex - 0.5) * (100 / strings)}%`,
                                                    transform: "translate(-50%, -50%)",
                                                }}
                                            >
                                                <div
                                                    className="relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow-[0_0_10px_rgba(15,23,42,0.45)]"
                                                    style={{
                                                        fontFamily: "'Rajdhani', sans-serif",
                                                        backgroundColor: noteData.topLayer.style.fill,
                                                        color: effectiveNoteTextColor ?? noteData.topLayer.style.textColor,
                                                        opacity: noteData.topLayer.style.opacity,
                                                        border: getLayerBorderStyle(
                                                            noteData.layers,
                                                            noteData.topLayer.style.borderWidth
                                                        ),
                                                    }}
                                                >
                                                    {getDisplayedFretboardLabel(noteIndex)}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="flex h-[32px] items-start pt-1">
                                {Array.from({ length: frets }).map((_, fretIndex) => {
                                    const fretNumber = fretIndex + 1;
                                    const isLabeled = fretMarkers.includes(fretNumber);

                                    return (
                                        <div
                                            key={`label-${fretNumber}`}
                                            className="flex-1 text-center text-[14px] font-extrabold tracking-[0.08em]"
                                            style={{ color: labelColor }}
                                        >
                                            {isLabeled ? `${fretNumber}fr.` : ""}
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
