"use client";

import { useRouter } from "next/navigation";
import {
    BLANK_THEORY,
    LAYER_GROUPS,
    type TheorySettings,
    type LayerKind,
} from "@/lib/layers";

type ChordLabelMode = "off" | "roman" | "number" | "theory";

type PanelColors = {
    border: string;
    label: string;
    text: string;
    divider: string;
    toggleBg: string;
    toggleBorder: string;
    activeBg: string;
    activeText: string;
    inactiveText: string;
    rowHover: string;
    rowBorder: string;
    swatchBorder: string;
    chevron: string;
};

type LeftMenuPanelProps = {
    isOpen: boolean;
    onClose: () => void;
    panelColors: PanelColors;
    leftBarColor: string;
    theorySettings: TheorySettings;
    onTheoryChange: (s: TheorySettings) => void;
    songName: string;
    songId: string;
    onStartTour: () => void;
    chordLabelMode: ChordLabelMode;
    onChordLabelModeChange: (mode: ChordLabelMode) => void;
};

export default function LeftMenuPanel({
    isOpen,
    onClose,
    panelColors: p,
    leftBarColor,
    theorySettings,
    onTheoryChange,
    songName,
    songId,
    onStartTour,
    chordLabelMode,
    onChordLabelModeChange,
}: LeftMenuPanelProps) {
    const router = useRouter();

    const navigate = (path: string) => {
        onClose();
        router.push(path);
    };

    const songActions = [
        {
            label: "Change Song",
            icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
            ),
            onClick: () => navigate("/songs"),
        },
        {
            label: "Restart Analysis",
            icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                </svg>
            ),
            onClick: () => navigate(`/jam/${songId}/prepare`),
        },
        {
            label: "Upload New Song",
            icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
            ),
            onClick: () => navigate("/"),
        },
    ];

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="absolute inset-0 z-[45]"
                    onClick={onClose}
                />
            )}

            {/* Panel */}
            <div
                className="absolute top-0 left-0 z-[46] h-full transition-transform duration-300 hidden min-[900px]:flex flex-col"
                style={{
                    transform: isOpen ? "translateX(0)" : "translateX(-260px)",
                    width: 260,
                }}
            >
                <div
                    className="h-full w-full flex flex-col overflow-hidden border-r"
                    style={{ background: leftBarColor, borderColor: p.border }}
                >
                    {/* Top bar: close + back to library */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-3">
                        <button
                            type="button"
                            onClick={() => navigate("/")}
                            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-opacity hover:opacity-70"
                            style={{ fontFamily: "'Rajdhani', sans-serif", color: p.inactiveText }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            Main Menu
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-6 w-6 items-center justify-center rounded-md transition-opacity hover:opacity-70"
                            style={{ color: p.inactiveText }}
                            aria-label="Close menu"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* Song name */}
                    <div className="px-4 pb-4" style={{ borderBottom: `1px solid ${p.divider}` }}>
                        <div className="truncate text-[13px] font-bold" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.text, letterSpacing: "0.04em" }}>
                            {songName || "Unknown Song"}
                        </div>
                    </div>

                    {/* Scrollable content */}
                    <div className="flex flex-col flex-1 overflow-y-auto px-4 py-4 gap-5">

                        {/* Song Control */}
                        <div>
                            <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.label }}>
                                Song Control
                            </div>
                            <div className="flex flex-col gap-1">
                                {songActions.map((action) => (
                                    <button
                                        key={action.label}
                                        type="button"
                                        onClick={action.onClick}
                                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors"
                                        style={{ border: `1px solid ${p.rowBorder}` }}
                                        onMouseEnter={e => (e.currentTarget.style.background = p.rowHover)}
                                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                    >
                                        <span style={{ color: p.inactiveText }}>{action.icon}</span>
                                        <span className="text-[12px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.text }}>
                                            {action.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{ height: 1, background: p.divider }} />

                        {/* Theory Overlay */}
                        <div>
                            <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.label }}>
                                Theory Layers
                            </div>

                            {/* Active layers summary */}
                            <div className="mb-2 flex flex-col gap-1">
                                {([
                                    ["Layer One", theorySettings.layer1Kind],
                                    ["Layer Two", theorySettings.layer2Kind],
                                    ["Layer Three", theorySettings.layer3Kind],
                                ] as [string, LayerKind | null][]).map(([rowLabel, kind]) => {
                                    const kindLabel = kind
                                        ? LAYER_GROUPS.flatMap(g => g.options).find(o => o.value === kind)?.label ?? kind
                                        : null;
                                    return (
                                        <div
                                            key={rowLabel}
                                            className="flex items-center justify-between rounded-lg px-3 py-2"
                                            style={{ background: p.rowHover, border: `1px solid ${p.rowBorder}` }}
                                        >
                                            <span className="text-[9px] uppercase tracking-[0.14em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.label }}>{rowLabel}</span>
                                            <span className="text-[11px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: kindLabel ? p.text : p.inactiveText }}>
                                                {kindLabel ?? "—"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Reset layers */}
                            <button
                                type="button"
                                onClick={() => onTheoryChange(BLANK_THEORY)}
                                className="mt-2 w-full rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-70"
                                style={{
                                    fontFamily: "'Rajdhani', sans-serif",
                                    color: p.inactiveText,
                                    border: `1px dashed ${p.swatchBorder}`,
                                }}
                            >
                                Reset Layers
                            </button>
                        </div>

                        {/* Divider */}
                        <div style={{ height: 1, background: p.divider }} />

                        {/* Chord Labels */}
                        <div>
                            <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.label }}>
                                Chord Labels
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                                {([
                                    { value: "roman",  display: "V" },
                                    { value: "number", display: "5" },
                                    { value: "theory", display: "Tonic" },
                                    { value: "off",    display: "Off" },
                                ] as { value: ChordLabelMode; display: string }[]).map(({ value, display }) => {
                                    const active = chordLabelMode === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => onChordLabelModeChange(value)}
                                            className="rounded-lg py-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors"
                                            style={{
                                                fontFamily: "'Rajdhani', sans-serif",
                                                background: active ? p.activeBg : "transparent",
                                                color: active ? p.activeText : p.inactiveText,
                                                border: `1px solid ${active ? p.toggleBorder : p.rowBorder}`,
                                            }}
                                        >
                                            {display}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-2 text-[9px] leading-snug" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.inactiveText, opacity: 0.7 }}>
                                {chordLabelMode === "roman" && "Roman numerals (I, ii, V…)"}
                                {chordLabelMode === "number" && "Scale degree numbers (1, 2, 5…)"}
                                {chordLabelMode === "theory" && "Function names (Tonic, Dominant…)"}
                                {chordLabelMode === "off" && "No label shown under chords"}
                            </div>
                        </div>

                    </div>

                    {/* Footer: ? Onboarding */}
                    <div className="px-4 py-4" style={{ borderTop: `1px solid ${p.divider}` }}>
                        <button
                            type="button"
                            onClick={() => { onClose(); onStartTour(); }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors"
                            style={{ border: `1px solid ${p.rowBorder}` }}
                            onMouseEnter={e => (e.currentTarget.style.background = p.rowHover)}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                            <div
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                                style={{ background: p.inactiveText, color: leftBarColor, fontFamily: "'Rajdhani', sans-serif" }}
                            >
                                ?
                            </div>
                            <span className="text-[12px] font-semibold" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.text }}>
                                Tour &amp; Onboarding
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
