"use client";

import { useState, type RefObject, type ReactNode } from "react";

type VideoPanelProps = {
    videoRef: RefObject<HTMLVideoElement | null>;
    videoURL: string;
    currentChord: string;
    nextChord: string;
    chordTextColor: string;
    muted: boolean;
    overlayControls: ReactNode;
    onExitVideoMode: () => void;
};

export default function VideoPanel({
    videoRef,
    videoURL,
    currentChord,
    nextChord,
    chordTextColor,
    muted,
    overlayControls,
    onExitVideoMode,
}: VideoPanelProps) {
    const [controlsOpen, setControlsOpen] = useState(false);

    return (
        <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ maxHeight: "42vh" }}>
            <video
                ref={videoRef}
                src={videoURL}
                className="w-full h-full"
                style={{ maxHeight: "42vh", objectFit: "contain" }}
                muted={muted}
                playsInline
            />

            {/* Chord overlay — bottom-left corner */}
            <div
                className="absolute bottom-3 left-3 flex items-baseline gap-3 rounded-lg px-3 py-2 pointer-events-none select-none"
                style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
            >
                <span
                    className="text-3xl font-bold leading-none"
                    style={{ fontFamily: "'Playfair Display', serif", color: chordTextColor }}
                >
                    {currentChord || "—"}
                </span>
                {nextChord && nextChord !== currentChord && (
                    <span
                        className="text-lg leading-none"
                        style={{ fontFamily: "'Playfair Display', serif", color: chordTextColor, opacity: 0.55 }}
                    >
                        → {nextChord}
                    </span>
                )}
            </div>

            {/* Top-right: settings toggle + exit */}
            <div className="absolute top-2 right-2 flex gap-1.5">
                <button
                    type="button"
                    onClick={() => setControlsOpen((o) => !o)}
                    className="flex items-center justify-center h-8 w-8 rounded-lg text-white/70 hover:text-white transition-colors"
                    style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
                    title="Toggle controls"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={onExitVideoMode}
                    className="flex items-center justify-center h-8 w-8 rounded-lg text-white/70 hover:text-white transition-colors"
                    style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
                    title="Exit video mode"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            {/* Controls overlay — appears at bottom when open */}
            {controlsOpen && (
                <div
                    className="absolute bottom-0 left-0 right-0"
                    style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}
                >
                    {overlayControls}
                </div>
            )}
        </div>
    );
}
