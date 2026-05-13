"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import {
    LAYER_GROUPS,
    INTERVAL_OPTIONS,
    isBaseKind,
    type TheorySettings,
    type LayerKind,
    type FocusArea,
} from "@/lib/layers";
import ColorWheelPicker from "./ColorWheelPicker";
import FocusAreaControl from "./FocusAreaControl";

type NoteDisplayMode = "notes" | "intervals";

type OverlayControlsProps = {
    audioError: string;
    barColor: string;
    baseBpm: number | null;
    focusArea: FocusArea;
    loopMode: boolean;
    metronomeBpm: number;
    metronomeEnabled: boolean;
    metronomeOpen: boolean;
    noteDisplayMode: NoteDisplayMode;
    theorySettings: TheorySettings;
    voxRemoval: boolean;
    voxLoading: boolean;
    voxError: string;
    onFocusAreaChange: (f: FocusArea) => void;
    onTheoryChange: (s: TheorySettings) => void;
    onDecreaseTempo: () => void;
    onIncreaseTempo: () => void;
    onDecreaseMetronomeBpm: () => void;
    onIncreaseMetronomeBpm: () => void;
    onTempoDisplayModeChange: (mode: "percent" | "bpm") => void;
    onToggleLoopMode: () => void;
    onToggleMetronome: () => void;
    onToggleMetronomeOpen: () => void;
    onToggleNoteDisplayMode: () => void;
    onToggleVoxRemoval: () => void;
    playbackRate: number;
    tempoDisplayMode: "percent" | "bpm";
};

// ─── Interval picker ─────────────────────────────────────────────────────────

function IntervalPicker({
    value,
    onChange,
}: {
    value: number | null;
    onChange: (semitones: number) => void;
}) {
    return (
        <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-lg border border-white/10 bg-black/40 p-2">
            {INTERVAL_OPTIONS.map((opt) => (
                <button
                    key={opt.semitones}
                    type="button"
                    onClick={() => onChange(opt.semitones)}
                    className={`rounded py-1.5 text-[11px] font-bold tracking-wide transition ${
                        value === opt.semitones
                            ? "bg-white text-black"
                            : "bg-white/8 text-white/70 hover:bg-white/15 hover:text-white"
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// ─── Layer kind picker ────────────────────────────────────────────────────────

function layerKindLabel(kind: LayerKind | null): string {
    if (!kind) return "(None)";
    for (const group of LAYER_GROUPS) {
        for (const opt of group.options) {
            if (opt.value === kind) return opt.label;
        }
    }
    return kind;
}

function LayerKindPicker({
    value,
    baseLayerTaken,
    onChange,
}: {
    value: LayerKind | null;
    baseLayerTaken: boolean;
    onChange: (k: LayerKind | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    return (
        <div ref={containerRef} className="relative min-w-0 flex-1">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded border border-white/10 bg-[#111118] px-2 py-1.5 text-left text-[12px] text-white transition hover:border-white/25"
            >
                <span className="truncate">{layerKindLabel(value)}</span>
                <svg className="ml-1 shrink-0 opacity-40" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
            </button>

            {open && (
                <div className="absolute left-0 top-[calc(100%+4px)] z-[60] w-[200px] overflow-hidden rounded-xl border border-white/12 bg-[#13131e] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
                    {LAYER_GROUPS.map((group) => (
                        <div key={group.label}>
                            <div className="px-3 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">
                                {group.label}
                            </div>
                            {group.options.map((opt) => {
                                const disabled = group.label === "BASE LAYERS" && baseLayerTaken && opt.value !== value;
                                const active = value === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => {
                                            if (!disabled) { onChange(opt.value); setOpen(false); }
                                        }}
                                        className={`w-full px-3 py-1.5 text-left text-[12px] transition ${
                                            active
                                                ? "bg-white/15 text-white font-semibold"
                                                : disabled
                                                    ? "cursor-not-allowed text-white/20"
                                                    : "text-white/75 hover:bg-white/8 hover:text-white"
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    <div className="mt-1 border-t border-white/8 pt-1">
                        <button
                            type="button"
                            onClick={() => { onChange(null); setOpen(false); }}
                            className={`w-full px-3 py-1.5 text-left text-[12px] transition ${
                                value === null
                                    ? "bg-white/15 text-white font-semibold"
                                    : "text-white/50 hover:bg-white/8 hover:text-white/80"
                            }`}
                        >
                            (None)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Layer row ────────────────────────────────────────────────────────────────

function LayerRow({
    label,
    kind,
    color,
    interval,
    baseLayerTaken,
    showFlipButton,
    layerFilled,
    onKindChange,
    onColorChange,
    onIntervalChange,
    onToggleFlip,
}: {
    label: string;
    kind: LayerKind | null;
    color: string;
    interval: number | null;
    baseLayerTaken: boolean;
    showFlipButton?: boolean;
    layerFilled?: boolean;
    onKindChange: (k: LayerKind | null) => void;
    onColorChange: (c: string) => void;
    onIntervalChange: (n: number) => void;
    onToggleFlip?: () => void;
}) {
    return (
        <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{label}</span>
                {showFlipButton && onToggleFlip && (
                    <button
                        type="button"
                        onClick={onToggleFlip}
                        title={layerFilled ? "Layer fills note (click to ring)" : "Layer rings note (click to fill)"}
                        className={`rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition ${
                            layerFilled
                                ? "bg-white/20 text-white"
                                : "bg-white/6 text-white/40 hover:bg-white/12 hover:text-white/70"
                        }`}
                    >
                        {layerFilled ? "Fill ●" : "Ring ○"}
                    </button>
                )}
            </div>
            <div className="flex items-center gap-2">
                <LayerKindPicker value={kind} baseLayerTaken={baseLayerTaken} onChange={onKindChange} />
                <ColorWheelPicker value={color} onChange={onColorChange} />
            </div>
            {kind === "interval" && (
                <IntervalPicker value={interval} onChange={onIntervalChange} />
            )}
        </div>
    );
}

// ─── Layers dropdown ──────────────────────────────────────────────────────────

function LayersDropdown({
    settings,
    focusArea,
    onTheoryChange,
    onFocusAreaChange,
}: {
    settings: TheorySettings;
    focusArea: FocusArea;
    onTheoryChange: (s: TheorySettings) => void;
    onFocusAreaChange: (f: FocusArea) => void;
}) {
    const update = (patch: Partial<TheorySettings>) => onTheoryChange({ ...settings, ...patch });

    const base1Taken = isBaseKind(settings.layer2Kind) || isBaseKind(settings.layer3Kind);
    const base2Taken = isBaseKind(settings.layer1Kind) || isBaseKind(settings.layer3Kind);
    const base3Taken = isBaseKind(settings.layer1Kind) || isBaseKind(settings.layer2Kind);

    return (
        <div className="absolute left-0 top-[calc(100%+10px)] z-50 w-[300px] rounded-2xl border border-white/10 bg-[#12121a] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Theory Layers
            </div>

            <div data-tour="overlay-rows" className="flex flex-col gap-2">
                <LayerRow
                    label="Layer One"
                    kind={settings.layer1Kind}
                    color={settings.layer1Color}
                    interval={settings.layer1Interval}
                    baseLayerTaken={base1Taken}
                    onKindChange={(k) => update({ layer1Kind: k, layer1Interval: null })}
                    onColorChange={(c) => update({ layer1Color: c })}
                    onIntervalChange={(n) => update({ layer1Interval: n })}
                />
                <LayerRow
                    label="Layer Two"
                    kind={settings.layer2Kind}
                    color={settings.layer2Color}
                    interval={settings.layer2Interval}
                    baseLayerTaken={base2Taken}
                    showFlipButton
                    layerFilled={settings.layer2Filled}
                    onKindChange={(k) => update({ layer2Kind: k, layer2Interval: null })}
                    onColorChange={(c) => update({ layer2Color: c })}
                    onIntervalChange={(n) => update({ layer2Interval: n })}
                    onToggleFlip={() => onTheoryChange({ ...settings, layer2Filled: !settings.layer2Filled })}
                />
                <LayerRow
                    label="Layer Three"
                    kind={settings.layer3Kind}
                    color={settings.layer3Color}
                    interval={settings.layer3Interval}
                    baseLayerTaken={base3Taken}
                    onKindChange={(k) => update({ layer3Kind: k, layer3Interval: null })}
                    onColorChange={(c) => update({ layer3Color: c })}
                    onIntervalChange={(n) => update({ layer3Interval: n })}
                />
                <FocusAreaControl
                    focusArea={focusArea}
                    onChange={onFocusAreaChange}
                    layer1Kind={settings.layer1Kind}
                />
            </div>
        </div>
    );
}

// ─── Layers button ────────────────────────────────────────────────────────────

function LayersButton({
    settings,
    focusArea,
    onTheoryChange,
    onFocusAreaChange,
}: {
    settings: TheorySettings;
    focusArea: FocusArea;
    onTheoryChange: (s: TheorySettings) => void;
    onFocusAreaChange: (f: FocusArea) => void;
}) {
    const [open, setOpen] = useState(false);
    const active = [settings.layer1Kind, settings.layer2Kind, settings.layer3Kind].filter(Boolean);
    const label = active.length === 0 ? "None" : active.length === 1 ? layerKindLabel(active[0]!) : `${active.length} Layers`;

    return (
        <div className="relative" data-tour="layers-btn">
            <div className="flex min-w-[170px] items-center justify-between rounded-lg border-2 border-white bg-black px-4 py-3 shadow-[0_0_0_2px_rgba(255,255,255,0.2),0_0_14px_rgba(255,255,255,0.14)]">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="flex w-full items-center justify-between text-left"
                >
                    <div>
                        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white">
                            Theory Overlays
                        </div>
                        <div className="text-[10px] text-white/50">{label}</div>
                    </div>
                    <span className="ml-3 text-sm text-white/60">{open ? "−" : "+"}</span>
                </button>
            </div>

            {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
            {open && (
                <LayersDropdown
                    settings={settings}
                    focusArea={focusArea}
                    onTheoryChange={(s) => { onTheoryChange(s); }}
                    onFocusAreaChange={onFocusAreaChange}
                />
            )}
        </div>
    );
}

// ─── Tempo control ────────────────────────────────────────────────────────────

function TempoControl({
    baseBpm,
    displayMode,
    playbackRate,
    onDecrease,
    onDisplayModeChange,
    onIncrease,
}: {
    baseBpm: number | null;
    displayMode: "percent" | "bpm";
    playbackRate: number;
    onDecrease: () => void;
    onDisplayModeChange: (mode: "percent" | "bpm") => void;
    onIncrease: () => void;
}) {
    const percentValue = Math.round(playbackRate * 100);
    const effectiveBpm = baseBpm === null ? null : Math.round(baseBpm * playbackRate);
    const displayValue =
        displayMode === "percent"
            ? `${percentValue}%`
            : effectiveBpm !== null
              ? `${effectiveBpm} BPM`
              : "-- BPM";

    return (
        <div className="rounded-lg border-2 border-white bg-black px-4 py-2 shadow-[0_0_0_2px_rgba(255,255,255,0.2),0_0_14px_rgba(255,255,255,0.14)]">
            <div className="flex h-[82px] items-center justify-between gap-4">
                <div className="flex flex-col items-center">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-white">Tempo</div>
                    <div className="mt-1 flex h-[62px] w-[62px] items-center justify-center rounded-md border-2 border-white bg-[#0d0d0d] px-1 text-center text-[16px] font-bold leading-tight text-white shadow-[0_0_0_1px_rgba(255,255,255,0.16)]">
                        {displayValue}
                    </div>
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        <button type="button" onClick={onIncrease} className="flex h-10 w-12 items-center justify-center rounded-md border-2 border-white bg-black text-lg text-white shadow-[0_0_0_1px_rgba(255,255,255,0.16)] transition hover:bg-white hover:text-black">+</button>
                        <button type="button" onClick={() => onDisplayModeChange("bpm")} className={`flex h-10 w-12 items-center justify-center rounded-md border-2 text-[11px] font-semibold transition ${displayMode === "bpm" ? "border-white bg-white text-black" : "border-white bg-black text-white/78 hover:text-white"}`}>BPM</button>
                        <button type="button" onClick={onDecrease} className="flex h-10 w-12 items-center justify-center rounded-md border-2 border-white bg-black text-lg text-white shadow-[0_0_0_1px_rgba(255,255,255,0.16)] transition hover:bg-white hover:text-black">-</button>
                        <button type="button" onClick={() => onDisplayModeChange("percent")} className={`flex h-10 w-12 items-center justify-center rounded-md border-2 text-xl font-bold transition ${displayMode === "percent" ? "border-white bg-white text-black" : "border-white bg-black text-white/78 hover:text-white"}`}>%</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Control button grid ──────────────────────────────────────────────────────

function ControlButtonGrid({
    loopMode,
    metronomeBpm,
    metronomeEnabled,
    metronomeOpen,
    noteDisplayMode,
    voxRemoval,
    voxLoading,
    onDecreaseMetronomeBpm,
    onIncreaseMetronomeBpm,
    onToggleMetronome,
    onToggleMetronomeOpen,
    onToggleLoopMode,
    onToggleNoteDisplayMode,
    onToggleVoxRemoval,
}: {
    loopMode: boolean;
    metronomeBpm: number;
    metronomeEnabled: boolean;
    metronomeOpen: boolean;
    noteDisplayMode: NoteDisplayMode;
    voxRemoval: boolean;
    voxLoading: boolean;
    onDecreaseMetronomeBpm: () => void;
    onIncreaseMetronomeBpm: () => void;
    onToggleMetronome: () => void;
    onToggleMetronomeOpen: () => void;
    onToggleLoopMode: () => void;
    onToggleNoteDisplayMode: () => void;
    onToggleVoxRemoval: () => void;
}) {
    const actionButtonClass =
        "box-border flex size-10 min-h-10 min-w-10 max-h-10 max-w-10 aspect-square items-center justify-center rounded-md border-2 bg-black transition";

    const NoteIcon = () =>
        noteDisplayMode === "notes" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
            </svg>
        ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="15" rx="1.5" />
                <line x1="7" y1="5" x2="7" y2="20" />
                <line x1="12" y1="5" x2="12" y2="20" />
                <line x1="17" y1="5" x2="17" y2="20" />
                <rect x="4.5" y="5" width="3.5" height="9" rx="1" fill="currentColor" stroke="none" />
                <rect x="9.5" y="5" width="3.5" height="9" rx="1" fill="currentColor" stroke="none" />
                <rect x="14.5" y="5" width="3.5" height="9" rx="1" fill="currentColor" stroke="none" />
            </svg>
        );

    const MetronomeIcon = () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 21 L9 4 L15 4 L20 21 Z" />
            <line x1="12" y1="21" x2="17" y2="8" />
            <circle cx="16.2" cy="10.5" r="2" fill="currentColor" stroke="none" />
        </svg>
    );

    const LoopIcon = () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 2l4 4-4 4" />
            <path d="M3 11V9a4 4 0 014-4h14" />
            <path d="M7 22l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 01-4 4H3" />
        </svg>
    );

    const VoxIcon = () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <line x1="8" y1="21" x2="16" y2="21" />
            {voxRemoval && <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2" />}
        </svg>
    );

    const buttonItems = [
        {
            icon: <NoteIcon />,
            label: noteDisplayMode === "notes" ? "Notes" : "Intervals",
            onClick: onToggleNoteDisplayMode,
        },
        {
            icon: <MetronomeIcon />,
            label: metronomeEnabled ? "Met On" : "Metronome",
            onClick: onToggleMetronomeOpen,
            active: metronomeOpen || metronomeEnabled,
        },
        {
            icon: <LoopIcon />,
            label: loopMode ? "Loop On" : "Looper",
            onClick: onToggleLoopMode,
            active: loopMode,
        },
        {
            icon: voxLoading
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                : <VoxIcon />,
            label: voxLoading ? "Processing" : voxRemoval ? "Instrumental" : "VOX",
            onClick: voxLoading ? () => {} : onToggleVoxRemoval,
            active: voxRemoval,
            pulsing: voxLoading,
        },
    ];

    return (
        <div className="relative">
            <div className="grid w-full grid-cols-4 justify-items-center gap-y-2 py-1">
                {buttonItems.map((item, i) => (
                    <div key={i} className="flex w-[60px] flex-col items-center gap-1.5">
                        <button
                            type="button"
                            onClick={item.onClick}
                            className={`${actionButtonClass} ${
                                "pulsing" in item && item.pulsing
                                    ? "animate-pulse border-white/50 text-white/60"
                                    : item.active
                                        ? "border-sky-200 text-white shadow-[0_0_0_2px_rgba(255,255,255,0.4),0_0_14px_rgba(255,255,255,0.28)]"
                                        : "border-white text-white shadow-[0_0_0_2px_rgba(255,255,255,0.4),0_0_14px_rgba(255,255,255,0.28)] hover:border-white hover:text-white hover:shadow-[0_0_0_2px_rgba(255,255,255,0.65),0_0_18px_rgba(255,255,255,0.42)]"
                            }`}
                        >
                            {item.icon}
                        </button>
                        <span className="max-w-[80px] text-center text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-white/82" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                            {item.label}
                        </span>
                    </div>
                ))}
            </div>

            {metronomeOpen && <div className="fixed inset-0 z-30" onClick={onToggleMetronomeOpen} />}
            {metronomeOpen && (
                <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[180px] rounded-xl border border-white/12 bg-[#111111] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.42)]">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Practice Metronome</div>
                    <div className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-white/60">BPM</div>
                        <div className="text-lg font-bold text-white">{metronomeBpm}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <button type="button" onClick={onDecreaseMetronomeBpm} className="rounded-md border border-white/14 bg-black px-2 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-black">-</button>
                        <button type="button" onClick={onToggleMetronome} className={`rounded-md border px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition ${metronomeEnabled ? "border-sky-200 bg-sky-100 text-black" : "border-white/14 bg-black text-white hover:bg-white hover:text-black"}`}>
                            {metronomeEnabled ? "Stop" : "Start"}
                        </button>
                        <button type="button" onClick={onIncreaseMetronomeBpm} className="rounded-md border border-white/14 bg-black px-2 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-black">+</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function OverlayControls({
    audioError,
    barColor,
    baseBpm,
    focusArea,
    loopMode,
    metronomeBpm,
    metronomeEnabled,
    metronomeOpen,
    noteDisplayMode,
    theorySettings,
    voxRemoval,
    voxLoading,
    voxError,
    onFocusAreaChange,
    onTheoryChange,
    onDecreaseTempo,
    onIncreaseTempo,
    onDecreaseMetronomeBpm,
    onIncreaseMetronomeBpm,
    onTempoDisplayModeChange,
    onToggleLoopMode,
    onToggleMetronome,
    onToggleMetronomeOpen,
    onToggleNoteDisplayMode,
    onToggleVoxRemoval,
    playbackRate,
    tempoDisplayMode,
}: OverlayControlsProps) {
    return (
        <div className="mt-[-2px] mb-2 flex w-full justify-center">
            <div className="flex w-full max-w-[1100px] items-center justify-between gap-4 rounded-xl border-[1.5px] border-[#f4f4f5] px-6 py-2" style={{ background: barColor }}>
                <div className="w-[32%]">
                    <LayersButton settings={theorySettings} focusArea={focusArea} onTheoryChange={onTheoryChange} onFocusAreaChange={onFocusAreaChange} />
                </div>

                <div className="w-[30%]">
                    <TempoControl
                        baseBpm={baseBpm}
                        displayMode={tempoDisplayMode}
                        playbackRate={playbackRate}
                        onDecrease={onDecreaseTempo}
                        onDisplayModeChange={onTempoDisplayModeChange}
                        onIncrease={onIncreaseTempo}
                    />
                </div>

                <div className="w-[32%] self-stretch flex items-center">
                    <div className="flex w-full flex-col justify-start gap-2">
                        <ControlButtonGrid
                            loopMode={loopMode}
                            metronomeBpm={metronomeBpm}
                            metronomeEnabled={metronomeEnabled}
                            metronomeOpen={metronomeOpen}
                            noteDisplayMode={noteDisplayMode}
                            voxRemoval={voxRemoval}
                            voxLoading={voxLoading}
                            onDecreaseMetronomeBpm={onDecreaseMetronomeBpm}
                            onIncreaseMetronomeBpm={onIncreaseMetronomeBpm}
                            onToggleMetronome={onToggleMetronome}
                            onToggleMetronomeOpen={onToggleMetronomeOpen}
                            onToggleLoopMode={onToggleLoopMode}
                            onToggleNoteDisplayMode={onToggleNoteDisplayMode}
                            onToggleVoxRemoval={onToggleVoxRemoval}
                        />
                        {audioError && (
                            <div className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100/90">
                                {audioError}
                            </div>
                        )}
                        {voxError && (
                            <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200/90">
                                VOX: {voxError}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
