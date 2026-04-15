"use client";

import { useRef, useState } from "react";

// ── Color helpers ─────────────────────────────────────────────────────────────

export function hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = (s / 100) * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexToHue(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return 0;
    let h = 0;
    switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
    }
    return Math.round(h * 360);
}

// ── Color wheel picker ────────────────────────────────────────────────────────

const WHEEL_SIZE = 160;
const OUTER_R    = WHEEL_SIZE / 2;
const INNER_R    = OUTER_R * 0.50;
const MID_R      = (OUTER_R + INNER_R) / 2;

type ColorWheelPickerProps = {
    value: string;
    label?: string;
    /** Trigger element — defaults to a small rectangular swatch button */
    trigger?: (onClick: () => void) => React.ReactNode;
    onChange: (color: string) => void;
};

export default function ColorWheelPicker({ value, label = "Color", trigger, onChange }: ColorWheelPickerProps) {
    const [open, setOpen] = useState(false);
    const [hue, setHue] = useState(() => { try { return hexToHue(value); } catch { return 220; } });
    const containerRef = useRef<HTMLDivElement>(null);
    const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

    const openPicker = () => {
        if (!open && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const POPUP_W = 212;
            const POPUP_H = 390;

            // Default: open to the right of the trigger
            let left = rect.right + 8;
            if (left + POPUP_W > window.innerWidth - 8) {
                // Not enough room on right — flip to left of trigger
                left = rect.left - POPUP_W - 8;
            }
            left = Math.max(8, left);

            // Align top with trigger, clamp so popup stays on screen
            let top = rect.top;
            if (top + POPUP_H > window.innerHeight - 8) {
                top = window.innerHeight - POPUP_H - 8;
            }
            top = Math.max(8, top);

            setPopupPos({ top, left });
        }
        setOpen(prev => !prev);
    };

    const handleWheelInteract = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - OUTER_R;
        const y = e.clientY - rect.top  - OUTER_R;
        const dist = Math.sqrt(x * x + y * y);
        if (dist < INNER_R - 4 || dist > OUTER_R + 4) return;
        const angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
        setHue(Math.round(((angle % 360) + 360) % 360));
    };

    const indAngle = (hue - 90) * (Math.PI / 180);
    const indX = OUTER_R + MID_R * Math.cos(indAngle);
    const indY = OUTER_R + MID_R * Math.sin(indAngle);

    const shades = [
        { l: 88, s: 90 },
        { l: 72, s: 88 },
        { l: 56, s: 85 },
        { l: 42, s: 84 },
        { l: 28, s: 80 },
        { l: 16, s: 75 },
    ].map(({ l, s }) => hslToHex(hue, s, l));

    const defaultTrigger = (
        <button
            type="button"
            onClick={openPicker}
            className="h-9 w-10 cursor-pointer rounded border border-white/20 transition hover:border-white/55 hover:scale-105"
            style={{ backgroundColor: value }}
            aria-label="Pick color"
        />
    );

    return (
        <div ref={containerRef} className="relative">
            {trigger ? trigger(openPicker) : defaultTrigger}

            {open && (
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
                    <div
                        style={{
                            position: "fixed",
                            top: popupPos.top,
                            left: popupPos.left,
                            zIndex: 9999,
                            background: "#0c0a14",
                            border: "1px solid rgba(255,255,255,0.18)",
                            boxShadow: "0 24px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,0,0,0.5)",
                            width: 212,
                            borderRadius: 16,
                            padding: 16,
                            fontFamily: "'IBM Plex Mono', monospace",
                        }}
                    >
                        {/* Label */}
                        <div className="mb-3 text-[9px] uppercase tracking-[0.22em] text-white/30" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                            {label}
                        </div>

                        {/* Wheel */}
                        <div className="flex justify-center mb-4">
                            <div
                                style={{
                                    width: WHEEL_SIZE,
                                    height: WHEEL_SIZE,
                                    borderRadius: "50%",
                                    background: "conic-gradient(hsl(0,100%,50%),hsl(30,100%,50%),hsl(60,100%,50%),hsl(90,100%,50%),hsl(120,100%,50%),hsl(150,100%,50%),hsl(180,100%,50%),hsl(210,100%,50%),hsl(240,100%,50%),hsl(270,100%,50%),hsl(300,100%,50%),hsl(330,100%,50%),hsl(360,100%,50%))",
                                    position: "relative",
                                    cursor: "crosshair",
                                    flexShrink: 0,
                                    boxShadow: "0 0 0 2px rgba(255,255,255,0.08)",
                                }}
                                onClick={handleWheelInteract}
                                onMouseMove={(e) => { if (e.buttons === 1) handleWheelInteract(e); }}
                            >
                                {/* Center hole */}
                                <div style={{
                                    position: "absolute",
                                    top: "50%", left: "50%",
                                    transform: "translate(-50%,-50%)",
                                    width: INNER_R * 2,
                                    height: INNER_R * 2,
                                    borderRadius: "50%",
                                    background: "#0c0a14",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    pointerEvents: "none",
                                }}>
                                    <div style={{
                                        width: 44, height: 44,
                                        borderRadius: "50%",
                                        background: `hsl(${hue},85%,55%)`,
                                        border: "2px solid rgba(255,255,255,0.25)",
                                        boxShadow: `0 0 20px hsl(${hue},85%,55%), 0 0 8px hsl(${hue},85%,55%)`,
                                        transition: "background 0.08s, box-shadow 0.08s",
                                    }} />
                                </div>

                                {/* Indicator dot */}
                                <div style={{
                                    position: "absolute",
                                    width: 11, height: 11,
                                    borderRadius: "50%",
                                    background: "white",
                                    border: "2px solid rgba(0,0,0,0.6)",
                                    boxShadow: "0 0 6px rgba(0,0,0,0.6)",
                                    left: indX - 5.5,
                                    top:  indY - 5.5,
                                    pointerEvents: "none",
                                    transition: "left 0.05s, top 0.05s",
                                }} />
                            </div>
                        </div>

                        {/* Shade swatches */}
                        <div className="mb-3">
                            <div className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-white/25" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                                Brightness
                            </div>
                            <div className="flex gap-1.5">
                                {shades.map((shade, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => { onChange(shade); setOpen(false); }}
                                        className="flex-1 rounded-md transition-transform hover:scale-110"
                                        style={{
                                            backgroundColor: shade,
                                            height: 28,
                                            border: shade.toLowerCase() === value.toLowerCase()
                                                ? "2px solid white"
                                                : "1px solid rgba(255,255,255,0.1)",
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Monochromatic scale */}
                        <div className="mb-3">
                            <div className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-white/25" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                                Mono
                            </div>
                            <div className="flex gap-1.5">
                                {["#000000","#222222","#444444","#777777","#aaaaaa","#cccccc","#e8e8e8","#ffffff"].map((mono) => (
                                    <button
                                        key={mono}
                                        type="button"
                                        onClick={() => { onChange(mono); setOpen(false); }}
                                        className="flex-1 rounded-md transition-transform hover:scale-110"
                                        style={{
                                            backgroundColor: mono,
                                            height: 28,
                                            border: mono.toLowerCase() === value.toLowerCase()
                                                ? "2px solid #9d50ff"
                                                : mono === "#ffffff"
                                                    ? "1px solid rgba(255,255,255,0.25)"
                                                    : "1px solid rgba(255,255,255,0.08)",
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Current color preview */}
                        <div
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                            <div
                                className="h-5 w-5 shrink-0 rounded"
                                style={{ backgroundColor: value, border: "1px solid rgba(255,255,255,0.2)" }}
                            />
                            <span className="text-[10px] text-white/40">{value}</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
