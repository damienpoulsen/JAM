"use client";

import { LAYER_OPTIONS, type LayerConfig, type LayerSlot } from "@/lib/layers";
import ColorWheelPicker from "./ColorWheelPicker";

type NoteDisplayMode = "notes" | "intervals";

type Props = {
    isOpen: boolean;
    canAddLayer: boolean;
    layerConfigs: LayerConfig[];
    noteDisplayMode: NoteDisplayMode;
    onAddLayer: () => void;
    onClose: () => void;
    onLayerColorChange: (slot: LayerSlot, color: string) => void;
    onLayerKindChange: (slot: LayerSlot, kind: LayerConfig["kind"]) => void;
    onRemoveLayer: (slot: LayerSlot) => void;
    onToggleNoteDisplayMode: () => void;
};

export default function MobileFretboardSettings({
    isOpen,
    canAddLayer,
    layerConfigs,
    noteDisplayMode,
    onAddLayer,
    onClose,
    onLayerColorChange,
    onLayerKindChange,
    onRemoveLayer,
    onToggleNoteDisplayMode,
}: Props) {
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />

            <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[72vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#12121a] px-4 pb-8 pt-4 shadow-[0_-16px_50px_rgba(0,0,0,0.5)]">
                <div className="mb-4 flex items-center justify-between">
                    <div
                        className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/60"
                        style={{ fontFamily: "'Rajdhani', sans-serif" }}
                    >
                        Fretboard Settings
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-lg text-white/50 transition hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Notes / Intervals toggle */}
                <div className="mb-5">
                    <div
                        className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/50"
                        style={{ fontFamily: "'Rajdhani', sans-serif" }}
                    >
                        Display Mode
                    </div>
                    <button
                        type="button"
                        onClick={onToggleNoteDisplayMode}
                        className="flex w-full items-center justify-between rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-left transition hover:border-white/30"
                    >
                        <div>
                            <div className="text-[13px] font-semibold text-white">
                                {noteDisplayMode === "notes" ? "Notes" : "Intervals"}
                            </div>
                            <div className="text-[10px] text-white/45">
                                Tap to switch to {noteDisplayMode === "notes" ? "intervals" : "notes"}
                            </div>
                        </div>
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="text-white/50"
                        >
                            {noteDisplayMode === "notes" ? (
                                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
                            ) : (
                                <>
                                    <rect x="2" y="5" width="20" height="15" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                                    <line x1="7" y1="5" x2="7" y2="20" stroke="currentColor" strokeWidth="1.5" />
                                    <line x1="12" y1="5" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5" />
                                    <line x1="17" y1="5" x2="17" y2="20" stroke="currentColor" strokeWidth="1.5" />
                                    <rect x="4.5" y="5" width="3.5" height="9" rx="1" />
                                    <rect x="9.5" y="5" width="3.5" height="9" rx="1" />
                                    <rect x="14.5" y="5" width="3.5" height="9" rx="1" />
                                </>
                            )}
                        </svg>
                    </button>
                </div>

                {/* Theory layers */}
                <div>
                    <div
                        className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/50"
                        style={{ fontFamily: "'Rajdhani', sans-serif" }}
                    >
                        Theory Layers
                    </div>
                    <div className="flex flex-col gap-3">
                        {layerConfigs.map((config, index) => (
                            <div
                                key={config.slot}
                                className="rounded-lg border border-white/10 bg-black/40 px-3 py-3"
                            >
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                            style={{ backgroundColor: config.color }}
                                        >
                                            {index + 1}
                                        </div>
                                        <span
                                            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70"
                                            style={{ fontFamily: "'Rajdhani', sans-serif" }}
                                        >
                                            Layer {index + 1}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onRemoveLayer(config.slot)}
                                        className="text-[11px] text-white/45 transition hover:text-white"
                                    >
                                        Remove
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={config.kind}
                                        onChange={(e) =>
                                            onLayerKindChange(config.slot, e.target.value as LayerConfig["kind"])
                                        }
                                        className="min-w-0 flex-1 rounded border border-white/10 bg-[#111118] px-2 py-2 text-[12px] text-white outline-none"
                                    >
                                        {LAYER_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ColorWheelPicker
                                        value={config.color}
                                        onChange={(color) => onLayerColorChange(config.slot, color)}
                                    />
                                </div>
                            </div>
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
                    </div>
                </div>
            </div>
        </>
    );
}
