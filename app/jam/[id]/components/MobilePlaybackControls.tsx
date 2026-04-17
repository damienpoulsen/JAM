"use client";

import type { TouchEvent as ReactTouchEvent } from "react";

type MobilePlaybackControlsProps = {
    barColor: string;
    contentColor: string;
    currentTime: number;
    duration: number;
    formatTime: (time: number) => string;
    isAudioAvailable: boolean;
    isPlaying: boolean;
    masterVolume: number;
    progress: number;
    songName: string;
    volumeOpen: boolean;
    onTimelineTouchStart: (event: ReactTouchEvent<HTMLDivElement>) => void;
    onTimelineTouchMove: (event: ReactTouchEvent<HTMLDivElement>) => void;
    onTogglePlay: () => void;
    onToggleVolumeOpen: () => void;
    onVolumeChange: (value: number) => void;
};

export default function MobilePlaybackControls({
    barColor,
    contentColor,
    currentTime,
    duration,
    formatTime,
    isAudioAvailable,
    isPlaying,
    masterVolume,
    progress,
    songName,
    volumeOpen,
    onTimelineTouchStart,
    onTimelineTouchMove,
    onTogglePlay,
    onToggleVolumeOpen,
    onVolumeChange,
}: MobilePlaybackControlsProps) {
    return (
        <div
            className="flex h-full flex-col justify-between rounded-t-2xl border-t-[1.5px] border-[#f4f4f5] px-4 pt-2 pb-4"
            style={{ background: barColor, color: contentColor }}
        >
            {/* Row 1: Song name + volume */}
            <div className="flex items-center justify-between">
                <span
                    className="max-w-[72%] truncate text-sm font-semibold"
                    style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: "0.03em" }}
                >
                    {songName}
                </span>
                <div className="relative">
                    <button
                        type="button"
                        onClick={onToggleVolumeOpen}
                        aria-label="Volume"
                        className="flex h-8 w-8 items-center justify-center opacity-80 transition hover:opacity-60"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M5 10v4h3l4 4V6l-4 4H5z" />
                            <path d="M16 9a4 4 0 0 1 0 6" />
                        </svg>
                    </button>
                    {volumeOpen && (
                        <div className="fixed inset-0 z-40" onClick={onToggleVolumeOpen} />
                    )}
                    {volumeOpen && (
                        <div className="absolute right-0 bottom-[calc(100%+8px)] z-50 w-[200px] rounded-xl border border-white/10 bg-[#12121a] p-3 shadow-[0_-16px_50px_rgba(0,0,0,0.45)]">
                            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-white/68">
                                <span>Volume</span>
                                <span>{Math.round(masterVolume * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={masterVolume}
                                onChange={(e) => onVolumeChange(Number(e.target.value))}
                                className="w-full accent-white"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Row 2: Transport controls */}
            <div className="flex items-center justify-center gap-10 text-2xl">
                <button type="button">⏮</button>
                <button
                    type="button"
                    onClick={onTogglePlay}
                    disabled={!isAudioAvailable}
                    className={!isAudioAvailable ? "opacity-40" : ""}
                >
                    {isPlaying ? "⏸" : "▶"}
                </button>
                <button type="button">⏭</button>
            </div>

            {/* Row 3: Timeline */}
            <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-right text-xs">{formatTime(currentTime)}</span>
                <div
                    className={`relative h-[14px] flex-1 rounded-full bg-[#3a3a40] ${isAudioAvailable ? "cursor-pointer" : "opacity-60"}`}
                    onTouchStart={onTimelineTouchStart}
                    onTouchMove={onTimelineTouchMove}
                >
                    <div
                        className="h-full rounded-full"
                        style={{ width: `${progress}%`, backgroundColor: contentColor }}
                    />
                    <div
                        className="absolute top-1/2 h-7 w-7 rounded-full"
                        style={{
                            left: `${progress}%`,
                            transform: "translate(-50%, -50%)",
                            backgroundColor: contentColor,
                        }}
                    />
                </div>
                <span className="w-8 shrink-0 text-xs">{formatTime(duration)}</span>
            </div>
        </div>
    );
}
