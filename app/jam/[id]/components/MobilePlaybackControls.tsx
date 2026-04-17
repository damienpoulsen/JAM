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
    progress: number;
    songName: string;
    onTimelineTouchStart: (event: ReactTouchEvent<HTMLDivElement>) => void;
    onTimelineTouchMove: (event: ReactTouchEvent<HTMLDivElement>) => void;
    onTogglePlay: () => void;
};

export default function MobilePlaybackControls({
    barColor,
    contentColor,
    currentTime,
    duration,
    formatTime,
    isAudioAvailable,
    isPlaying,
    progress,
    songName,
    onTimelineTouchStart,
    onTimelineTouchMove,
    onTogglePlay,
}: MobilePlaybackControlsProps) {
    return (
        <div
            className="flex flex-col gap-1.5 rounded-t-2xl border-t-[1.5px] border-[#f4f4f5] px-4 pt-2 pb-3"
            style={{ background: barColor, color: contentColor }}
        >
            {/* Song name (left) · Play button (center) */}
            <div className="flex items-center">
                <div className="w-[30%] min-w-0">
                    <span
                        className="block truncate text-sm font-semibold"
                        style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: "0.03em" }}
                    >
                        {songName}
                    </span>
                </div>

                <div className="flex flex-1 items-center justify-center text-2xl">
                    <button
                        type="button"
                        onClick={onTogglePlay}
                        disabled={!isAudioAvailable}
                        className={!isAudioAvailable ? "opacity-40" : ""}
                    >
                        {isPlaying ? "⏸" : "▶"}
                    </button>
                </div>

                <div className="w-[30%]" />
            </div>

            {/* Timeline */}
            <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-right text-xs">{formatTime(currentTime)}</span>
                <div
                    className={`relative h-[12px] flex-1 rounded-full bg-[#3a3a40] ${isAudioAvailable ? "cursor-pointer" : "opacity-60"}`}
                    onTouchStart={onTimelineTouchStart}
                    onTouchMove={onTimelineTouchMove}
                >
                    <div
                        className="h-full rounded-full"
                        style={{ width: `${progress}%`, backgroundColor: contentColor }}
                    />
                    <div
                        className="absolute top-1/2 h-6 w-6 rounded-full"
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
