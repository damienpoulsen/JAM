"use client";

import type { ReactNode } from "react";
import { LAYER_OPTIONS, type LayerConfig, type LayerSlot } from "@/lib/layers";

type NoteDisplayMode = "notes" | "intervals";

type OverlayControlsProps = {
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

                <input
                    type="color"
                    value={config.color}
                    onChange={(event) => onColorChange(event.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                    aria-label={`${config.slot} color`}
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
        <div className="rounded-lg border-2 border-white bg-black px-4 py-3 shadow-[0_0_0_2px_rgba(255,255,255,0.2),0_0_14px_rgba(255,255,255,0.14)]">
            <div className="flex h-[96px] items-center justify-between gap-4">
                <div className="flex flex-col items-center">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-white">
                        Tempo
                    </div>
                    <div className="mt-1 flex h-[74px] w-[74px] items-center justify-center rounded-md border-2 border-white bg-[#0d0d0d] px-1 text-center text-[18px] font-bold leading-tight text-white shadow-[0_0_0_1px_rgba(255,255,255,0.16)]">
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
                            className={`flex h-10 w-12 items-center justify-center rounded-md border-2 text-[11px] font-semibold transition ${
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
        "box-border flex size-10 min-h-10 min-w-10 max-h-10 max-w-10 aspect-square items-center justify-center rounded-md border-2 bg-black text-[8px] font-semibold uppercase tracking-[0.04em] transition";
    const buttonItems = [
        {
            short: noteDisplayMode === "notes" ? "NTS" : "INT",
            label: noteDisplayMode === "notes" ? "Intervals" : "Notes",
            onClick: onToggleNoteDisplayMode,
            slotClassName: "col-start-1 row-start-1",
        },
        {
            short: "MET",
            label: metronomeEnabled ? "Met On" : "Metronome",
            onClick: onToggleMetronomeOpen,
            active: metronomeOpen || metronomeEnabled,
            slotClassName: "col-start-2 row-start-1",
        },
        {
            short: "LOP",
            label: loopMode ? "Loop On" : "Looper",
            onClick: onToggleLoopMode,
            active: loopMode,
            slotClassName: "col-start-3 row-start-1",
        },
    ];

    return (
        <div className="relative">
            <div className="grid h-[112px] w-full grid-cols-3 grid-rows-2 justify-items-center gap-y-4 py-1">
                {buttonItems.map((item) => (
                    <div
                        key={item.label}
                        className={`flex w-[60px] flex-col items-center gap-1 ${item.slotClassName ?? ""}`}
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
                            {item.short}
                        </button>
                        <span className="max-w-[72px] text-center text-[8px] font-semibold uppercase leading-tight tracking-[0.04em] text-white/82">
                            {item.label}
                        </span>
                    </div>
                ))}
            </div>

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
            <div className="flex w-full max-w-[1100px] items-center justify-between gap-4 rounded-xl bg-[#2f302d] px-6 py-2">
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

                <ControlCenterSection className="w-[32%] self-start pt-1">
                    <div className="flex flex-col justify-start gap-2">
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

