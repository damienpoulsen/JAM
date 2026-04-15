"use client";

import type { ReactNode } from "react";
import { LAYER_OPTIONS, type LayerConfig, type LayerSlot } from "@/lib/layers";
import ColorWheelPicker from "./ColorWheelPicker";

type NoteDisplayMode = "notes" | "intervals";

type OverlayControlsProps = {
    barColor: string;
    audioError: string;
    baseBpm: number | null;
    canAddLayer: boolean;
    layerConfigs: LayerConfig[];
    layersOpen: boolean;
    loopMode: boolean;
    metronomeBpm: number;
    metronomeEnabled: boolean;
    metronomeOpen: boolean;
    noteDisplayMode: NoteDisplayMode;
    onAddLayer: () => void;
    onDecreaseTempo: () => void;
    onIncreaseTempo: () => void;
    onLayerColorChange: (slot: LayerSlot, color: string) => void;
    onLayerKindChange: (slot: LayerSlot, kind: LayerConfig["kind"]) => void;
    onDecreaseMetronomeBpm: () => void;
    onRemoveLayer: (slot: LayerSlot) => void;
    onTempoDisplayModeChange: (mode: "percent" | "bpm") => void;
    onIncreaseMetronomeBpm: () => void;
    onToggleLayersOpen: () => void;
    onToggleLoopMode: () => void;
    onToggleMetronome: () => void;
    onToggleMetronomeOpen: () => void;
    onToggleNoteDisplayMode: () => void;
    playbackRate: number;
    tempoDisplayMode: "percent" | "bpm";
};

function LayerEditorRow({
    config,
    index,
    onKindChange,
    onColorChange,
    onRemove,
}: {
    config: LayerConfig;
    index: number;
    onKindChange: (kind: LayerConfig["kind"]) => void;
    onColorChange: (color: string) => void;
    onRemove: () => void;
}) {
    return (
        <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: config.color }}
                    >
                        {index + 1}
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                        Layer {index + 1}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onRemove}
                    className="text-[11px] text-white/45 transition hover:text-white"
                >
                    Remove
                </button>
            </div>

            <div className="flex items-center gap-2">
                <select
                    value={config.kind}
                    onChange={(event) => onKindChange(event.target.value as LayerConfig["kind"])}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-[#111118] px-2 py-2 text-[12px] text-white outline-none"
                >
                    {LAYER_OPTIONS.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                        >
                            {option.label}
                        </option>
                    ))}
                </select>

                <ColorWheelPicker
                    value={config.color}
                    onChange={onColorChange}
                />
            </div>
        </div>
    );
}

function LayersButton({
    layerCount,
    open,
    children,
    onToggle,
}: {
    layerCount: number;
    open: boolean;
    children: ReactNode;
    onToggle: () => void;
}) {
    return (
        <div className="relative">
            <div className="flex min-w-[170px] items-center justify-between rounded-lg border-2 border-white bg-black px-4 py-3 shadow-[0_0_0_2px_rgba(255,255,255,0.2),0_0_14px_rgba(255,255,255,0.14)]">
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex w-full items-center justify-between text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white bg-black text-[10px] font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.18)]">
                            {layerCount}
                        </div>
                        <div>
                            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white">
                                Layers
                            </div>
                            <div className="text-[10px] text-white/50">
                                Edit theory stack
                            </div>
                        </div>
                    </div>
                    <span className="text-sm text-white/60">{open ? "-" : "+"}</span>
                </button>
            </div>

            {open && (
                <div className="fixed inset-0 z-40" onClick={onToggle} />
            )}
            {open && (
                <div className="absolute left-0 top-[calc(100%+10px)] z-50 w-[320px] rounded-2xl border border-white/10 bg-[#12121a] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
                    <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/65">
                        Layers
                    </div>
                    <div className="flex flex-col gap-3">{children}</div>
                </div>
            )}
        </div>
    );
}

function ControlCenterSection({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return <div className={className}>{children}</div>;
}

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
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-white">
                        Tempo
                    </div>
                    <div className="mt-1 flex h-[62px] w-[62px] items-center justify-center rounded-md border-2 border-white bg-[#0d0d0d] px-1 text-center text-[16px] font-bold leading-tight text-white shadow-[0_0_0_1px_rgba(255,255,255,0.16)]">
                        {displayValue}
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-center">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        <button
                            type="button"
                            onClick={onIncrease}
                            className="flex h-10 w-12 items-center justify-center rounded-md border-2 border-white bg-black text-lg text-white shadow-[0_0_0_1px_rgba(255,255,255,0.16)] transition hover:bg-white hover:text-black"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            onClick={() => onDisplayModeChange("bpm")}
                            className={`flex h-10 w-12 items-center justify-center rounded-md border-2 text-[11px] font-semibold transition ${
                                displayMode === "bpm"
                                    ? "border-white bg-white text-black"
                                    : "border-white bg-black text-white/78 hover:text-white"
                            }`}
                        >
                            BPM
                        </button>
                        <button
                            type="button"
                            onClick={onDecrease}
                            className="flex h-10 w-12 items-center justify-center rounded-md border-2 border-white bg-black text-lg text-white shadow-[0_0_0_1px_rgba(255,255,255,0.16)] transition hover:bg-white hover:text-black"
                        >
                            -
                        </button>
                        <button
                            type="button"
                            onClick={() => onDisplayModeChange("percent")}
                            className={`flex h-10 w-12 items-center justify-center rounded-md border-2 text-xl font-bold transition ${
                                displayMode === "percent"
                                    ? "border-white bg-white text-black"
                                    : "border-white bg-black text-white/78 hover:text-white"
                            }`}
                        >
                            %
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ControlCenterStatus({
    audioError,
}: {
    audioError: string;
}) {
    return (
        <div className="flex flex-col gap-2">
            {audioError && (
                <div className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100/90">
                    {audioError}
                </div>
            )}
        </div>
    );
}

function ControlButtonGrid({
    loopMode,
    metronomeBpm,
    metronomeEnabled,
    metronomeOpen,
    noteDisplayMode,
    onDecreaseMetronomeBpm,
    onIncreaseMetronomeBpm,
    onToggleMetronome,
    onToggleMetronomeOpen,
    onToggleLoopMode,
    onToggleNoteDisplayMode,
}: {
    loopMode: boolean;
    metronomeBpm: number;
    metronomeEnabled: boolean;
    metronomeOpen: boolean;
    noteDisplayMode: NoteDisplayMode;
    onDecreaseMetronomeBpm: () => void;
    onIncreaseMetronomeBpm: () => void;
    onToggleMetronome: () => void;
    onToggleMetronomeOpen: () => void;
    onToggleLoopMode: () => void;
    onToggleNoteDisplayMode: () => void;
}) {
    const actionButtonClass =
        "box-border flex size-14 min-h-14 min-w-14 max-h-14 max-w-14 aspect-square items-center justify-center rounded-md border-2 bg-black transition";
    const NoteIcon = () => noteDisplayMode === "notes" ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
        </svg>
    ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {/* White keys outline */}
            <rect x="2" y="5" width="20" height="15" rx="1.5" />
            {/* White key dividers */}
            <line x1="7" y1="5" x2="7" y2="20" />
            <line x1="12" y1="5" x2="12" y2="20" />
            <line x1="17" y1="5" x2="17" y2="20" />
            {/* Black keys */}
            <rect x="4.5" y="5" width="3.5" height="9" rx="1" fill="currentColor" stroke="none" />
            <rect x="9.5" y="5" width="3.5" height="9" rx="1" fill="currentColor" stroke="none" />
            <rect x="14.5" y="5" width="3.5" height="9" rx="1" fill="currentColor" stroke="none" />
        </svg>
    );
    const MetronomeIcon = () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {/* Trapezoid body */}
            <path d="M4 21 L9 4 L15 4 L20 21 Z" />
            {/* Pendulum arm tilted */}
            <line x1="12" y1="21" x2="17" y2="8" />
            {/* Weight on pendulum */}
            <circle cx="16.2" cy="10.5" r="2" fill="currentColor" stroke="none" />
        </svg>
    );
    const LoopIcon = () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 2l4 4-4 4"/>
            <path d="M3 11V9a4 4 0 014-4h14"/>
            <path d="M7 22l-4-4 4-4"/>
            <path d="M21 13v2a4 4 0 01-4 4H3"/>
        </svg>
    );
    const buttonItems = [
        {
            icon: <NoteIcon />,
            label: noteDisplayMode === "notes" ? "Notes" : "Intervals",
            onClick: onToggleNoteDisplayMode,
            slotClassName: "col-start-1 row-start-1",
        },
        {
            icon: <MetronomeIcon />,
            label: metronomeEnabled ? "Met On" : "Metronome",
            onClick: onToggleMetronomeOpen,
            active: metronomeOpen || metronomeEnabled,
            slotClassName: "col-start-2 row-start-1",
        },
        {
            icon: <LoopIcon />,
            label: loopMode ? "Loop On" : "Looper",
            onClick: onToggleLoopMode,
            active: loopMode,
            slotClassName: "col-start-3 row-start-1",
        },
    ];

    return (
        <div className="relative">
            <div className="grid w-full grid-cols-3 justify-items-center gap-y-2 py-1">
                {buttonItems.map((item, i) => (
                    <div
                        key={i}
                        className={`flex w-[80px] flex-col items-center gap-1.5 ${item.slotClassName ?? ""}`}
                    >
                        <button
                            type="button"
                            onClick={item.onClick}
                            className={`${actionButtonClass} ${
                                item.active
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

            {metronomeOpen && (
                <div className="fixed inset-0 z-30" onClick={onToggleMetronomeOpen} />
            )}
            {metronomeOpen && (
                <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[180px] rounded-xl border border-white/12 bg-[#111111] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.42)]">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                        Practice Metronome
                    </div>
                    <div className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-white/60">BPM</div>
                        <div className="text-lg font-bold text-white">{metronomeBpm}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={onDecreaseMetronomeBpm}
                            className="rounded-md border border-white/14 bg-black px-2 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
                        >
                            -
                        </button>
                        <button
                            type="button"
                            onClick={onToggleMetronome}
                            className={`rounded-md border px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition ${
                                metronomeEnabled
                                    ? "border-sky-200 bg-sky-100 text-black"
                                    : "border-white/14 bg-black text-white hover:bg-white hover:text-black"
                            }`}
                        >
                            {metronomeEnabled ? "Stop" : "Start"}
                        </button>
                        <button
                            type="button"
                            onClick={onIncreaseMetronomeBpm}
                            className="rounded-md border border-white/14 bg-black px-2 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
                        >
                            +
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function OverlayControls({
    barColor,
    audioError,
    baseBpm,
    canAddLayer,
    layerConfigs,
    layersOpen,
    loopMode,
    metronomeBpm,
    metronomeEnabled,
    metronomeOpen,
    noteDisplayMode,
    onAddLayer,
    onDecreaseTempo,
    onIncreaseTempo,
    onLayerColorChange,
    onLayerKindChange,
    onDecreaseMetronomeBpm,
    onRemoveLayer,
    onTempoDisplayModeChange,
    onIncreaseMetronomeBpm,
    onToggleLayersOpen,
    onToggleLoopMode,
    onToggleMetronome,
    onToggleMetronomeOpen,
    onToggleNoteDisplayMode,
    playbackRate,
    tempoDisplayMode,
}: OverlayControlsProps) {
    return (
        <div className="mt-[-2px] mb-2 flex w-full justify-center">
            <div className="flex w-full max-w-[1100px] items-center justify-between gap-4 rounded-xl border-[1.5px] border-[#f4f4f5] px-6 py-2" style={{ background: barColor }}>
                <ControlCenterSection className="w-[32%]">
                    <LayersButton
                        layerCount={layerConfigs.length}
                        open={layersOpen}
                        onToggle={onToggleLayersOpen}
                    >
                        {layerConfigs.map((config, index) => (
                            <LayerEditorRow
                                key={config.slot}
                                config={config}
                                index={index}
                                onKindChange={(kind) => onLayerKindChange(config.slot, kind)}
                                onColorChange={(color) => onLayerColorChange(config.slot, color)}
                                onRemove={() => onRemoveLayer(config.slot)}
                            />
                        ))}

                        {canAddLayer && (
                            <button
                                type="button"
                                onClick={onAddLayer}
                                className="rounded-lg border border-dashed border-white/15 px-3 py-3 text-left text-[12px] text-white/72 transition hover:border-white/30 hover:text-white"
                            >
                                + Add Layer
                            </button>
                        )}
                    </LayersButton>
                </ControlCenterSection>

                <ControlCenterSection className="w-[30%]">
                    <TempoControl
                        baseBpm={baseBpm}
                        displayMode={tempoDisplayMode}
                        playbackRate={playbackRate}
                        onDecrease={onDecreaseTempo}
                        onDisplayModeChange={onTempoDisplayModeChange}
                        onIncrease={onIncreaseTempo}
                    />
                </ControlCenterSection>

                <ControlCenterSection className="w-[32%] self-stretch flex items-center">
                    <div className="flex w-full flex-col justify-start gap-2">
                        <ControlButtonGrid
                            loopMode={loopMode}
                            metronomeBpm={metronomeBpm}
                            metronomeEnabled={metronomeEnabled}
                            metronomeOpen={metronomeOpen}
                            noteDisplayMode={noteDisplayMode}
                            onDecreaseMetronomeBpm={onDecreaseMetronomeBpm}
                            onIncreaseMetronomeBpm={onIncreaseMetronomeBpm}
                            onToggleMetronome={onToggleMetronome}
                            onToggleMetronomeOpen={onToggleMetronomeOpen}
                            onToggleLoopMode={onToggleLoopMode}
                            onToggleNoteDisplayMode={onToggleNoteDisplayMode}
                        />
                        <ControlCenterStatus audioError={audioError} />
                    </div>
                </ControlCenterSection>
            </div>
        </div>
    );
}

