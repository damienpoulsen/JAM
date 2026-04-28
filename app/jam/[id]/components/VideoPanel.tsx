"use client";

import { type RefObject } from "react";

type VideoPanelProps = {
    videoRef: RefObject<HTMLVideoElement | null>;
    videoURL: string;
    muted: boolean;
};

export default function VideoPanel({ videoRef, videoURL, muted }: VideoPanelProps) {
    return (
        <video
            ref={videoRef}
            src={videoURL}
            className="w-full h-full"
            style={{ objectFit: "cover" }}
            muted={muted}
            playsInline
        />
    );
}
