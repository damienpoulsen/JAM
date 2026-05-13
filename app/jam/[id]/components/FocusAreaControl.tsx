"use client";

import { useState } from "react";
import {
    type FocusArea,
    type LayerKind,
    getFocusAreaPatternSystem,
} from "@/lib/layers";

function derivedLabel(focusArea: FocusArea, patternSystem: ReturnType<typeof getFocusAreaPatternSystem>): string {
    const { activePositions, customFretRange } = focusArea;
    if (customFretRange && activePositions.length === 0) {
        return `Frets ${customFretRange.startFret}–${customFretRange.endFret}`;
    }
    if (activePositions.length === 0) return "Full Neck";
    const sorted = [...activePositions].sort((a, b) => a - b);
    if (patternSystem === "pentatonic") {
        if (sorted.length === 1) return `Box ${sorted[0]}`;
        if (sorted.length === 2) return `Box ${sorted[0]}, ${sorted[1]}`;
        return `${sorted.length} Boxes`;
    }
    if (sorted.length === 1) return `Position ${sorted[0]}`;
    if (sorted.length === 2) return `Pos ${sorted[0]}, ${sorted[1]}`;
    return `${sorted.length} Positions`;
}

export default function FocusAreaControl({
    focusArea,
    onChange,
    layer1Kind,
}: {
    focusArea: FocusArea;
    onChange: (f: FocusArea) => void;
    layer1Kind: LayerKind | null;
}) {
    const [open, setOpen] = useState(false);
    const patternSystem = getFocusAreaPatternSystem(layer1Kind);
    const label = derivedLabel(focusArea, patternSystem);
    const isFullNeck = focusArea.activePositions.length === 0 && !focusArea.customFretRange;
    const isCustom = focusArea.customFretRange !== null;

    const positionCount = patternSystem === "pentatonic" ? 5 : patternSystem === "diatonic" ? 7 : 0;
    const positionLabel = patternSystem === "pentatonic" ? "Box" : "Pos";

    function togglePosition(pos: number) {
        const already = focusArea.activePositions.includes(pos);
        const next = already
            ? focusArea.activePositions.filter((p) => p !== pos)
            : [...focusArea.activePositions, pos];
        onChange({ ...focusArea, activePositions: next, customFretRange: null });
    }

    function selectFullNeck() {
        onChange({ patternSystem: focusArea.patternSystem, activePositions: [], customFretRange: null });
    }

    function toggleCustom() {
        if (isCustom) {
            onChange({ ...focusArea, customFretRange: null });
        } else {
            onChange({ ...focusArea, activePositions: [], customFretRange: { startFret: 0, endFret: 5 } });
        }
    }

    const toggleBtnBase = "rounded px-2 py-1 text-[11px] font-semibold transition border";
    const toggleBtnActive = "bg-white/20 text-white border-white/30";
    const toggleBtnInactive = "bg-white/6 text-white/50 border-white/10 hover:bg-white/12 hover:text-white/80";

    return (
        <div className="rounded-lg border border-white/10 bg-black/40">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3 py-2.5"
            >
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Focus Area
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-white/70">
                    {label}
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="currentColor"
                        className={`shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
                    >
                        <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    </svg>
                </span>
            </button>

            {open && (
                <div className="border-t border-white/8 px-3 pb-3 pt-2.5">
                    <div className="flex flex-wrap gap-1.5">
                        {/* Full Neck */}
                        <button
                            type="button"
                            onClick={selectFullNeck}
                            className={`${toggleBtnBase} ${isFullNeck ? toggleBtnActive : toggleBtnInactive}`}
                        >
                            Full Neck
                        </button>

                        {/* Position toggles */}
                        {positionCount > 0 &&
                            Array.from({ length: positionCount }, (_, i) => i + 1).map((pos) => {
                                const active = focusArea.activePositions.includes(pos);
                                return (
                                    <button
                                        key={pos}
                                        type="button"
                                        onClick={() => togglePosition(pos)}
                                        className={`${toggleBtnBase} ${active ? toggleBtnActive : toggleBtnInactive}`}
                                    >
                                        {positionLabel} {pos}
                                    </button>
                                );
                            })}

                        {/* Custom Range */}
                        <button
                            type="button"
                            onClick={toggleCustom}
                            className={`${toggleBtnBase} ${isCustom ? toggleBtnActive : toggleBtnInactive}`}
                        >
                            Custom Range
                        </button>
                    </div>

                    {isCustom && focusArea.customFretRange && (
                        <div className="mt-2.5 flex items-center gap-2">
                            <label className="text-[10px] uppercase tracking-[0.12em] text-white/45">Start</label>
                            <input
                                type="number"
                                min={0}
                                max={24}
                                value={focusArea.customFretRange.startFret}
                                onChange={(e) =>
                                    onChange({
                                        ...focusArea,
                                        customFretRange: {
                                            startFret: Number(e.target.value),
                                            endFret: focusArea.customFretRange!.endFret,
                                        },
                                    })
                                }
                                className="w-12 rounded border border-white/15 bg-black/60 px-2 py-1 text-center text-[12px] text-white focus:outline-none focus:border-white/35"
                            />
                            <label className="text-[10px] uppercase tracking-[0.12em] text-white/45">End</label>
                            <input
                                type="number"
                                min={0}
                                max={24}
                                value={focusArea.customFretRange.endFret}
                                onChange={(e) =>
                                    onChange({
                                        ...focusArea,
                                        customFretRange: {
                                            startFret: focusArea.customFretRange!.startFret,
                                            endFret: Number(e.target.value),
                                        },
                                    })
                                }
                                className="w-12 rounded border border-white/15 bg-black/60 px-2 py-1 text-center text-[12px] text-white focus:outline-none focus:border-white/35"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
