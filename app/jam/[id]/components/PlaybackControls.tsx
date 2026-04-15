"use client";

import type { MouseEvent as ReactMouseEvent } from "react";

type PlaybackControlsProps = {
    barColor: string;
    contentColor: string;
    currentTime: number;
    duration: number;
    editingName: boolean;
    formatTime: (time: number) => string;
    isAudioAvailable: boolean;
    isPlaying: boolean;
    loopDraft: { start: number; end: number } | null;
    loopMode: boolean;
    loopRange: { start: number; end: number } | null;
    masterVolume: number;
    volumeOpen: boolean;
    onNameBlur: () => void;
    onNameChange: (name: string) => void;
    onNameContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
    onLoopEdgeMouseDown: (edge: "start" | "end", event: ReactMouseEvent<HTMLDivElement>) => void;
    onLoopLaneMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
    onTimelineMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
    onTogglePlay: () => void;
    onToggleVolumeOpen: () => void;
    onVolumeChange: (value: number) => void;
    progress: number;
    songName: string;
};

export default function PlaybackControls({
    barColor,
    contentColor,
    currentTime,
    duration,
    editingName,
    formatTime,
    isAudioAvailable,
    isPlaying,
    loopDraft,
    loopMode,
    loopRange,
    masterVolume,
    volumeOpen,
    onNameBlur,
    onNameChange,
    onNameContextMenu,
    onLoopEdgeMouseDown,
    onLoopLaneMouseDown,
    onTimelineMouseDown,
    onTogglePlay,
    onToggleVolumeOpen,
    onVolumeChange,
    progress,
    songName,
}: PlaybackControlsProps) {
    const visibleLoopRange = loopDraft ?? loopRange;
    const loopLeft = visibleLoopRange && duration > 0 ? (visibleLoopRange.start / duration) * 100 : 0;
    const loopWidth =
        visibleLoopRange && duration > 0
            ? Math.max(((visibleLoopRange.end - visibleLoopRange.start) / duration) * 100, 0)
            : 0;
    const loopRight = loopLeft + loopWidth;

    return (
        <div className="mt-0 flex justify-center">
            <div className="w-full max-w-[1400px] rounded-2xl border-[1.5px] border-[#f4f4f5] px-10 pt-3 pb-8" style={{ background: barColor, color: contentColor }}>
                <div className="mb-2 flex items-center text-xl">
                    <div className="w-[200px] shrink-0 min-w-0">
                        {!editingName ? (
                            <button
                                type="button"
                                onContextMenu={onNameContextMenu}
                                className="block w-full cursor-pointer truncate select-none text-left"
                                title={songName}
                                style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: "0.03em" }}
                            >
                                {songName}
                            </button>
                        ) : (
                            <input
                                autoFocus
                                className="w-full border-b bg-transparent outline-none"
                                style={{ borderColor: contentColor }}
                                value={songName}
                                onChange={(event) => onNameChange(event.target.value)}
                                onBlur={onNameBlur}
                            />
                        )}
                    </div>

                    <div className="flex flex-1 justify-center gap-12 text-3xl">
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

                    <div className="relative flex w-[200px] shrink-0 justify-end">
                        <button
                            type="button"
                            onClick={onToggleVolumeOpen}
                            aria-label="Volume"
                            className="flex h-10 w-10 items-center justify-center transition opacity-90 hover:opacity-60"
                        >
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-7 w-7"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M5 10v4h3l4 4V6l-4 4H5z" />
                                <path d="M16 9a4 4 0 0 1 0 6" />
                                <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
                            </svg>
                        </button>

                        {volumeOpen && (
                            <div className="fixed inset-0 z-40" onClick={onToggleVolumeOpen} />
                        )}
                        {volumeOpen && (
                            <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[220px] rounded-xl border border-white/10 bg-[#12121a] p-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
                                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-white/68">
                                    <span>Track Volume</span>
                                    <span>{Math.round(masterVolume * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={masterVolume}
                                    onChange={(event) => onVolumeChange(Number(event.target.value))}
                                    className="w-full accent-white"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 flex items-center gap-3">
                    <span className="w-10 shrink-0 text-right text-sm">{formatTime(currentTime)}</span>
                    <div className="relative flex-1">
                    {loopMode && (
                        <div
                            className="absolute -top-7 h-[20px] w-full cursor-crosshair rounded-xl border border-white/14 bg-[#191922]"
                            onMouseDown={onLoopLaneMouseDown}
                        >
                            <div className="pointer-events-none absolute inset-x-3 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-white/12" />
                            {!visibleLoopRange && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-semibold uppercase tracking-[0.16em] text-white/42">
                                    Drag To Set Loop
                                </div>
                            )}
                            {visibleLoopRange && (
                                <>
                                    <div
                                        className="absolute -top-5 rounded bg-sky-200/95 px-1.5 py-[1px] text-[9px] font-semibold text-slate-950"
                                        style={{
                                            left: `${loopLeft}%`,
                                            transform: "translateX(-50%)",
                                        }}
                                    >
                                        {formatTime(visibleLoopRange.start)}
                                    </div>
                                    <div
                                        className="absolute -top-5 rounded bg-sky-200/95 px-1.5 py-[1px] text-[9px] font-semibold text-slate-950"
                                        style={{
                                            left: `${loopRight}%`,
                                            transform: "translateX(-50%)",
                                        }}
                                    >
                                        {formatTime(visibleLoopRange.end)}
                                    </div>
                                    <div
                                        className="absolute inset-y-[2px] rounded-lg border border-sky-200/90 bg-sky-400/40"
                                        style={{
                                            left: `${loopLeft}%`,
                                            width: `${loopWidth}%`,
                                        }}
                                    />
                                    <div
                                        className="absolute inset-y-0 z-10 w-4 -translate-x-1/2 cursor-ew-resize"
                                        style={{
                                            left: `${loopLeft}%`,
                                        }}
                                        onMouseDown={(event) => onLoopEdgeMouseDown("start", event)}
                                    />
                                    <div
                                        className="absolute inset-y-0 z-10 w-4 -translate-x-1/2 cursor-ew-resize"
                                        style={{
                                            left: `${loopRight}%`,
                                        }}
                                        onMouseDown={(event) => onLoopEdgeMouseDown("end", event)}
                                    />
                                    <div
                                        className="absolute inset-y-[1px] w-[3px] rounded-full bg-sky-50"
                                        style={{
                                            left: `${loopLeft}%`,
                                            transform: "translateX(-50%)",
                                        }}
                                    />
                                    <div
                                        className="absolute inset-y-[1px] w-[3px] rounded-full bg-sky-50"
                                        style={{
                                            left: `${loopRight}%`,
                                            transform: "translateX(-50%)",
                                        }}
                                    />
                                </>
                            )}
                        </div>
                    )}

                    <div
                        className={`relative h-[16px] w-full rounded-full bg-[#3a3a40] ${isAudioAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                        onMouseDown={onTimelineMouseDown}
                    >
                        {visibleLoopRange && (
                            <div
                                className={`absolute inset-y-0 rounded-full ${
                                    loopMode ? "bg-sky-400/45" : "bg-sky-300/28"
                                }`}
                                style={{
                                    left: `${loopLeft}%`,
                                    width: `${loopWidth}%`,
                                }}
                            />
                        )}
                        {visibleLoopRange && (
                            <>
                                <div
                                    className="absolute inset-y-[-3px] w-[3px] rounded-full bg-sky-100/90"
                                    style={{
                                        left: `${loopLeft}%`,
                                        transform: "translateX(-50%)",
                                    }}
                                />
                                <div
                                    className="absolute inset-y-[-3px] w-[3px] rounded-full bg-sky-100/90"
                                    style={{
                                        left: `${loopRight}%`,
                                        transform: "translateX(-50%)",
                                    }}
                                />
                            </>
                        )}

                        <div
                            className="relative h-full rounded-full"
                            style={{
                                width: `${progress}%`,
                                backgroundColor: contentColor,
                            }}
                        />

                        <div
                            className="absolute top-1/2 h-9 w-9 rounded-full"
                            style={{
                                left: `${progress}%`,
                                transform: "translate(-50%, -50%)",
                                backgroundColor: contentColor,
                            }}
                        />
                    </div>
                    </div>
                    <span className="w-10 shrink-0 text-sm">{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
}
