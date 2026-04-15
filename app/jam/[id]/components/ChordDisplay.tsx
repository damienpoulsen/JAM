"use client";

import { useState } from "react";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

type ChordDisplayProps = {
    isDark: boolean;
    chordTextColor?: string;
    bpm: number | string;
    currentChord: string;
    keyOpen: boolean;
    keyOptions: string[];
    nextChord: string;
    onBpmChange: (value: string) => void;
    onKeySelect: (keyOption: string) => void;
    onToggleKeyOpen: () => void;
    songKey: string;
};

function BpmControl({
    bpm,
    onChange,
    dimTextColor,
    inputStyle,
}: {
    bpm: ChordDisplayProps["bpm"];
    onChange: (value: string) => void;
    dimTextColor: string;
    inputStyle: string;
}) {
    return (
        <div className="flex items-center justify-end">
            <span className="mr-3 text-lg" style={{ color: dimTextColor }}>BPM:</span>
            <input
                type="number"
                className={`min-w-[120px] rounded border-2 px-4 py-1 text-center text-lg ${inputStyle}`}
                value={bpm === "--" ? "" : bpm}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

export default function ChordDisplay({
    isDark,
    chordTextColor,
    bpm,
    currentChord,
    keyOpen,
    keyOptions,
    nextChord,
    onBpmChange,
    onKeySelect,
    onToggleKeyOpen,
    songKey,
}: ChordDisplayProps) {
    // isDark passed as prop
    const textColor = chordTextColor ?? (isDark ? "#ffffff" : "#1a1410");
    const dimTextColor = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)";
    const inputStyle = isDark
        ? "border-white bg-black text-white shadow-[0_0_0_2px_rgba(255,255,255,0.2),0_0_14px_rgba(255,255,255,0.14)]"
        : "border-[#1a1410] bg-[#f0ebe0] text-[#1a1410] shadow-[0_0_0_2px_rgba(0,0,0,0.08)]";
    const dropdownBg = isDark ? "#0f0f0f" : "#f5f0e6";
    const dropdownBorder = isDark ? "border-white/12" : "border-black/10";
    const noteButtonClass = isDark
        ? "border-white/12 bg-white/5 text-white hover:border-white/40 hover:bg-white/15"
        : "border-black/10 bg-black/5 text-[#1a1410] hover:border-black/30 hover:bg-black/10";
    const modeButtonClass = isDark
        ? "border-white/20 bg-white/8 text-white hover:border-white/50 hover:bg-white/18"
        : "border-black/15 bg-black/5 text-[#1a1410] hover:border-black/35 hover:bg-black/10";
    const [selectedNote, setSelectedNote] = useState<string | null>(null);

    const handleNoteClick = (note: string) => {
        setSelectedNote(note);
    };

    const handleModeClick = (mode: "major" | "minor") => {
        const key = mode === "major" ? selectedNote! : `${selectedNote}m`;
        onKeySelect(key);
        setSelectedNote(null);
    };

    const handleClose = () => {
        setSelectedNote(null);
        onToggleKeyOpen();
    };

    return (
        <>
            {/* Top-right song settings row */}
            <div className="relative z-30 mt-1 mb-0 flex justify-end">
                <div className="mt-1 mb-0 flex w-[220px] flex-col items-end gap-2">
                    <div className="relative flex w-full items-center justify-end">
                        <span className="mr-3 text-lg" style={{ color: dimTextColor }}>Key:</span>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => { setSelectedNote(null); onToggleKeyOpen(); }}
                                className={`min-w-[120px] cursor-pointer rounded border-2 px-4 py-1 text-center text-lg ${inputStyle}`}
                            >
                                {songKey}
                            </button>

                            {keyOpen && (
                                <div className="fixed inset-0 z-40" onClick={handleClose} />
                            )}
                            {keyOpen && (
                                <div
                                    className={`absolute right-0 z-50 mt-2 rounded-xl border p-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)] ${dropdownBorder}`}
                                    style={{ width: 220, background: dropdownBg }}
                                >
                                    {!selectedNote ? (
                                        <>
                                            <div className="mb-2 text-[10px] uppercase tracking-[0.16em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: dimTextColor }}>
                                                Select Root Note
                                            </div>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {NOTES.map((note) => (
                                                    <button
                                                        key={note}
                                                        type="button"
                                                        onClick={() => handleNoteClick(note)}
                                                        className={`rounded-lg border py-2 text-sm font-semibold transition ${noteButtonClass}`}
                                                        style={{ fontFamily: "'Rajdhani', sans-serif" }}
                                                    >
                                                        {note}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedNote(null)}
                                                className="mb-2 text-[10px] uppercase tracking-[0.16em] transition"
                                                style={{ fontFamily: "'Rajdhani', sans-serif", color: dimTextColor }}
                                            >
                                                ← {selectedNote}
                                            </button>
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleModeClick("major")}
                                                    className={`w-full rounded-lg border py-3 text-base font-semibold transition ${modeButtonClass}`}
                                                    style={{ fontFamily: "'Rajdhani', sans-serif" }}
                                                >
                                                    {selectedNote} Major
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleModeClick("minor")}
                                                    className={`w-full rounded-lg border py-3 text-base font-semibold transition ${modeButtonClass}`}
                                                    style={{ fontFamily: "'Rajdhani', sans-serif" }}
                                                >
                                                    {selectedNote} Minor
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full">
                        <BpmControl bpm={bpm} onChange={onBpmChange} dimTextColor={dimTextColor} inputStyle={inputStyle} />
                    </div>
                </div>
            </div>

            <div className="-mt-14 flex flex-col">
                {/* Main chord display: current chord + upcoming chord */}
                <div className="pointer-events-none mb-6 mt-[-72px] flex items-start justify-center gap-10 px-4">
                    <div className="max-w-[70vw] truncate text-[clamp(7.5rem,15vw,248px)] font-bold leading-none drop-shadow-[0_10px_24px_rgba(0,0,0,0.25)]" style={{ color: textColor }}>
                        {currentChord || "—"}
                    </div>
                    <div className="mt-16 max-w-[26vw] truncate text-[clamp(3.5rem,7vw,108px)] leading-none" style={{ color: chordTextColor ? `${chordTextColor}66` : isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.30)" }}>
                        {nextChord}
                    </div>
                </div>
            </div>
        </>
    );
}
