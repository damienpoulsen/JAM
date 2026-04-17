"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LAYER_OPTIONS, type LayerConfig, type LayerSlot } from "@/lib/layers";
import ColorWheelPicker from "./ColorWheelPicker";

type NoteDisplayMode = "notes" | "intervals";
type BgMode = "gradient" | "solid";
type TextColorMode = "white" | "black";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    // Fretboard / theory
    canAddLayer: boolean;
    layerConfigs: LayerConfig[];
    noteDisplayMode: NoteDisplayMode;
    onAddLayer: () => void;
    onLayerColorChange: (slot: LayerSlot, color: string) => void;
    onLayerKindChange: (slot: LayerSlot, kind: LayerConfig["kind"]) => void;
    onRemoveLayer: (slot: LayerSlot) => void;
    onToggleNoteDisplayMode: () => void;
    // Color customization
    bgMode: BgMode;
    bgColor: string;
    bgAccentColor: string;
    boardColor: string;
    stringColor: string;
    markerColor: string;
    fretLabelTextColor: TextColorMode;
    noteTextColor: TextColorMode;
    playheadColor: string;
    chordDisplayColor: string;
    setBgMode: (m: BgMode) => void;
    setBgColor: (c: string) => void;
    setBgAccentColor: (c: string) => void;
    setBoardColor: (c: string) => void;
    setStringColor: (c: string) => void;
    setMarkerColor: (c: string) => void;
    setFretLabelTextColor: (m: TextColorMode) => void;
    setNoteTextColor: (m: TextColorMode) => void;
    setPlayheadColor: (c: string) => void;
    setChordDisplayColor: (c: string) => void;
};

function SectionHeader({
    label,
    open,
    onToggle,
}: {
    label: string;
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/8"
        >
            <span
                className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80"
                style={{ fontFamily: "'Rajdhani', sans-serif" }}
            >
                {label}
            </span>
            <span className="text-white/50">{open ? "−" : "+"}</span>
        </button>
    );
}

function ColorRow({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (c: string) => void;
}) {
    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-[12px] text-white/70" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                {label}
            </span>
            <ColorWheelPicker value={value} onChange={onChange} />
        </div>
    );
}

function TextToggle({
    label,
    value,
    onChange,
}: {
    label: string;
    value: TextColorMode;
    onChange: (m: TextColorMode) => void;
}) {
    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-[12px] text-white/70" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                {label}
            </span>
            <div className="flex rounded-md overflow-hidden border border-white/15">
                {(["white", "black"] as TextColorMode[]).map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => onChange(m)}
                        className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition"
                        style={{
                            fontFamily: "'Rajdhani', sans-serif",
                            background: value === m ? "rgba(255,255,255,0.9)" : "transparent",
                            color: value === m ? "#000" : "rgba(255,255,255,0.5)",
                        }}
                    >
                        {m === "white" ? "W" : "B"}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function MobileFretboardSettings({
    isOpen,
    onClose,
    canAddLayer,
    layerConfigs,
    noteDisplayMode,
    onAddLayer,
    onLayerColorChange,
    onLayerKindChange,
    onRemoveLayer,
    onToggleNoteDisplayMode,
    bgMode,
    bgColor,
    bgAccentColor,
    boardColor,
    stringColor,
    markerColor,
    fretLabelTextColor,
    noteTextColor,
    playheadColor,
    chordDisplayColor,
    setBgMode,
    setBgColor,
    setBgAccentColor,
    setBoardColor,
    setStringColor,
    setMarkerColor,
    setFretLabelTextColor,
    setNoteTextColor,
    setPlayheadColor,
    setChordDisplayColor,
}: Props) {
    const router = useRouter();
    const [openSection, setOpenSection] = useState<"none" | "color" | "fretboard">("none");

    const toggle = (section: "color" | "fretboard") =>
        setOpenSection((s) => (s === section ? "none" : section));

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />

            <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#12121a] px-4 pb-8 pt-4 shadow-[0_-16px_50px_rgba(0,0,0,0.5)]">

                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <div
                        className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/60"
                        style={{ fontFamily: "'Rajdhani', sans-serif" }}
                    >
                        Settings
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-lg text-white/50 transition hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Go to Menu */}
                <button
                    type="button"
                    onClick={() => { onClose(); router.push("/"); }}
                    className="mb-4 flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                        <path d="M19 12H5M12 5l-7 7 7 7" />
                    </svg>
                    <span
                        className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80"
                        style={{ fontFamily: "'Rajdhani', sans-serif" }}
                    >
                        Go to Menu
                    </span>
                </button>

                {/* Color Customization */}
                <div className="mb-3">
                    <SectionHeader
                        label="Color Customization"
                        open={openSection === "color"}
                        onToggle={() => toggle("color")}
                    />
                    {openSection === "color" && (
                        <div className="mt-2 space-y-4 rounded-lg border border-white/8 bg-black/30 px-4 py-3">

                            {/* Page Background */}
                            <div>
                                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Page Background</div>
                                <div className="mb-2 flex rounded-md overflow-hidden border border-white/15">
                                    {(["gradient", "solid"] as BgMode[]).map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setBgMode(m)}
                                            className="flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition"
                                            style={{
                                                fontFamily: "'Rajdhani', sans-serif",
                                                background: bgMode === m ? "rgba(255,255,255,0.9)" : "transparent",
                                                color: bgMode === m ? "#000" : "rgba(255,255,255,0.5)",
                                            }}
                                        >
                                            {m === "gradient" ? "Accent" : "Solid"}
                                        </button>
                                    ))}
                                </div>
                                {bgMode === "gradient" ? (
                                    <ColorRow label="Accent Color" value={bgAccentColor} onChange={(c) => { setBgAccentColor(c); setBgMode("gradient"); }} />
                                ) : (
                                    <ColorRow label="Background" value={bgColor} onChange={(c) => { setBgColor(c); setBgMode("solid"); }} />
                                )}
                            </div>

                            {/* Fretboard */}
                            <div>
                                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Fretboard</div>
                                <ColorRow label="Board" value={boardColor} onChange={setBoardColor} />
                                <ColorRow label="Strings" value={stringColor} onChange={setStringColor} />
                                <ColorRow label="Markers" value={markerColor} onChange={setMarkerColor} />
                                <TextToggle label="Label Text" value={fretLabelTextColor} onChange={setFretLabelTextColor} />
                                <TextToggle label="Note Labels" value={noteTextColor} onChange={setNoteTextColor} />
                            </div>

                            {/* Chord Display */}
                            <div>
                                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Chord Display</div>
                                <ColorRow label="Text Color" value={chordDisplayColor} onChange={setChordDisplayColor} />
                            </div>

                            {/* Playback */}
                            <div>
                                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Playback Bar</div>
                                <ColorRow label="Bar Color" value={playheadColor} onChange={setPlayheadColor} />
                            </div>

                        </div>
                    )}
                </div>

                {/* Fretboard Settings */}
                <div>
                    <SectionHeader
                        label="Fretboard Settings"
                        open={openSection === "fretboard"}
                        onToggle={() => toggle("fretboard")}
                    />
                    {openSection === "fretboard" && (
                        <div className="mt-2 space-y-3 rounded-lg border border-white/8 bg-black/30 px-4 py-3">

                            {/* Notes / Intervals */}
                            <button
                                type="button"
                                onClick={onToggleNoteDisplayMode}
                                className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-left transition hover:border-white/25"
                            >
                                <div>
                                    <div className="text-[12px] font-semibold text-white">
                                        {noteDisplayMode === "notes" ? "Notes" : "Intervals"}
                                    </div>
                                    <div className="text-[10px] text-white/45">
                                        Tap to switch to {noteDisplayMode === "notes" ? "intervals" : "notes"}
                                    </div>
                                </div>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/50">
                                    <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
                                </svg>
                            </button>

                            {/* Layers */}
                            <div className="flex flex-col gap-2">
                                {layerConfigs.map((config, index) => (
                                    <div key={config.slot} className="rounded-lg border border-white/10 bg-black/40 px-3 py-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                                    style={{ backgroundColor: config.color }}
                                                >
                                                    {index + 1}
                                                </div>
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                                                    Layer {index + 1}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onRemoveLayer(config.slot)}
                                                className="text-[11px] text-white/40 transition hover:text-white"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={config.kind}
                                                onChange={(e) => onLayerKindChange(config.slot, e.target.value as LayerConfig["kind"])}
                                                className="min-w-0 flex-1 rounded border border-white/10 bg-[#111118] px-2 py-2 text-[12px] text-white outline-none"
                                            >
                                                {LAYER_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                                        className="rounded-lg border border-dashed border-white/15 px-3 py-3 text-left text-[12px] text-white/60 transition hover:border-white/30 hover:text-white"
                                    >
                                        + Add Layer
                                    </button>
                                )}
                            </div>

                        </div>
                    )}
                </div>

            </div>
        </>
    );
}
