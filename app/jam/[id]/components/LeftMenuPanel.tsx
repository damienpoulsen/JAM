"use client";

import { useRouter } from "next/navigation";
import {
    type TheorySettings,
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

                        {/* Switch Mode */}
                        <div>
                            <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.label }}>
                                Switch Mode
                            </div>
                            <div className="flex flex-col gap-1">
                                {/* JAM Mode — active */}
                                <div
                                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
                                    style={{ background: p.activeBg, border: `1px solid ${p.toggleBorder}` }}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: p.activeText }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    <span className="text-[12px] font-semibold flex-1" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.activeText }}>JAM Mode</span>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: p.activeText }}><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                                {/* Studio Mode — PRO */}
                                {([
                                    { label: "Studio Mode", href: `/studio/${songId}`, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
                                    { label: "Chord Book",  href: "/chord-book",       icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
                                    { label: "Mashup Lab",  href: "/mashup",           icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/><path d="m15 18 6-6-6-6"/></svg> },
                                ]).map(({ label, href, icon }) => (
                                    <button
                                        key={label}
                                        type="button"
                                        onClick={() => navigate(href)}
                                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors"
                                        style={{ border: `1px solid ${p.rowBorder}` }}
                                        onMouseEnter={e => (e.currentTarget.style.background = p.rowHover)}
                                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                    >
                                        <span style={{ color: p.inactiveText }}>{icon}</span>
                                        <span className="text-[12px] font-semibold flex-1" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.text }}>{label}</span>
                                        <span className="text-[8px] font-bold tracking-[0.12em] px-1.5 py-0.5 rounded" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.label, border: `1px solid ${p.rowBorder}` }}>PRO</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{ height: 1, background: p.divider }} />

                        {/* Song Control */}
                        <div>
                            <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: p.label }}>
                                Song
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
