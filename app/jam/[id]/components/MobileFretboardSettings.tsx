"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    PRESET_DEFINITIONS,
    BASE_LAYER_OPTIONS,
    OVERLAY_OPTIONS,
    INTERVAL_OPTIONS,
    applyTheoryPreset,
    type TheorySettings,
    type TheoryPreset,
    type OverlayKind,
    type BaseLayerKind,
} from "@/lib/layers";
import ColorWheelPicker from "./ColorWheelPicker";

type NoteDisplayMode = "notes" | "intervals";
type BgMode = "gradient" | "solid";
type TextColorMode = "white" | "black";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    theorySettings: TheorySettings;
    onTheoryChange: (s: TheorySettings) => void;
    noteDisplayMode: NoteDisplayMode;
    onToggleNoteDisplayMode: () => void;
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

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/8"
        >
            <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                {label}
            </span>
            <span className="text-white/50">{open ? "−" : "+"}</span>
        </button>
    );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-[12px] text-white/70" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{label}</span>
            <ColorWheelPicker value={value} onChange={onChange} />
        </div>
    );
}

function TextToggle({ label, value, onChange }: { label: string; value: TextColorMode; onChange: (m: TextColorMode) => void }) {
    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="text-[12px] text-white/70" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{label}</span>
            <div className="flex overflow-hidden rounded-md border border-white/15">
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

// ─── Interval picker ─────────────────────────────────────────────────────────

function IntervalPicker({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
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

// ─── Overlay row ─────────────────────────────────────────────────────────────

function OverlayRow({
    label,
    kind,
    color,
    interval,
    showFlipButton,
    overlayFilled,
    onKindChange,
    onColorChange,
    onIntervalChange,
    onToggleFlip,
}: {
    label: string;
    kind: OverlayKind | null;
    color: string;
    interval: number | null;
    showFlipButton?: boolean;
    overlayFilled?: boolean;
    onKindChange: (k: OverlayKind | null) => void;
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
                        className={`rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition ${
                            overlayFilled
                                ? "bg-white/20 text-white"
                                : "bg-white/6 text-white/40 hover:bg-white/12 hover:text-white/70"
                        }`}
                    >
                        {overlayFilled ? "Fill ●" : "Ring ○"}
                    </button>
                )}
            </div>
            <div className="flex items-center gap-2">
                <select
                    value={kind ?? "none"}
                    onChange={(e) => {
                        const val = e.target.value;
                        onKindChange(val === "none" ? null : (val as OverlayKind));
                    }}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-[#111118] px-2 py-1.5 text-[12px] text-white outline-none"
                >
                    <option value="none">None</option>
                    {OVERLAY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <ColorWheelPicker value={color} onChange={onColorChange} />
            </div>
            {kind === "interval" && <IntervalPicker value={interval} onChange={onIntervalChange} />}
        </div>
    );
}

// ─── Theory section ───────────────────────────────────────────────────────────

function TheorySection({
    settings,
    onChange,
}: {
    settings: TheorySettings;
    onChange: (s: TheorySettings) => void;
}) {
    const [customOpen, setCustomOpen] = useState(false);
    const update = (patch: Partial<TheorySettings>) => onChange({ ...settings, ...patch, preset: "custom" });

    return (
        <div className="space-y-3">
            {/* Presets */}
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                Presets
            </div>
            <div className="grid grid-cols-2 gap-2">
                {PRESET_DEFINITIONS.map((preset) => (
                    <button
                        key={preset.id}
                        type="button"
                        onClick={() => onChange(applyTheoryPreset(preset.id, settings))}
                        className={`rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
                            settings.preset === preset.id
                                ? "border-white bg-white text-black"
                                : "border-white/15 bg-black/40 text-white/75 hover:border-white/35 hover:text-white"
                        }`}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            {/* Custom layers toggle */}
            <button
                type="button"
                onClick={() => setCustomOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-left transition hover:bg-white/8"
            >
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                    Custom Layers
                </span>
                <span className="text-white/50">{customOpen ? "−" : "+"}</span>
            </button>

            {customOpen && (
                <div className="space-y-2">
                    {/* Base layer */}
                    <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5">
                        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Base Layer</div>
                        <div className="flex items-center gap-2">
                            <select
                                value={settings.baseKind}
                                onChange={(e) => update({ baseKind: e.target.value as BaseLayerKind })}
                                className="min-w-0 flex-1 rounded border border-white/10 bg-[#111118] px-2 py-1.5 text-[12px] text-white outline-none"
                            >
                                {BASE_LAYER_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <ColorWheelPicker value={settings.baseColor} onChange={(c) => update({ baseColor: c })} />
                        </div>
                    </div>

                    <OverlayRow
                        label="Overlay"
                        kind={settings.overlayKind}
                        color={settings.overlayColor}
                        interval={settings.overlayInterval}
                        showFlipButton
                        overlayFilled={settings.overlayFilled}
                        onKindChange={(k) => update({ overlayKind: k, overlayInterval: null })}
                        onColorChange={(c) => update({ overlayColor: c })}
                        onIntervalChange={(n) => update({ overlayInterval: n })}
                        onToggleFlip={() => onChange({ ...settings, overlayFilled: !settings.overlayFilled })}
                    />

                    <OverlayRow
                        label="Additional Overlay"
                        kind={settings.overlay2Kind}
                        color={settings.overlay2Color}
                        interval={settings.overlay2Interval}
                        onKindChange={(k) => update({ overlay2Kind: k, overlay2Interval: null })}
                        onColorChange={(c) => update({ overlay2Color: c })}
                        onIntervalChange={(n) => update({ overlay2Interval: n })}
                    />
                </div>
            )}
        </div>
    );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function MobileFretboardSettings({
    isOpen,
    onClose,
    theorySettings,
    onTheoryChange,
    noteDisplayMode,
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
    const [openSection, setOpenSection] = useState<"none" | "theory" | "color" | "display">("none");
    const toggle = (s: "theory" | "color" | "display") => setOpenSection((cur) => (cur === s ? "none" : s));

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
            <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#12121a] px-4 pb-8 pt-4 shadow-[0_-16px_50px_rgba(0,0,0,0.5)]">

                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/60" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                        Settings
                    </div>
                    <button type="button" onClick={onClose} className="text-lg text-white/50 transition hover:text-white">✕</button>
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
                    <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                        Go to Menu
                    </span>
                </button>

                {/* Theory / Overlay */}
                <div className="mb-3">
                    <SectionHeader label="Theory Overlays" open={openSection === "theory"} onToggle={() => toggle("theory")} />
                    {openSection === "theory" && (
                        <div className="mt-2 rounded-lg border border-white/8 bg-black/30 px-4 py-3">
                            <TheorySection settings={theorySettings} onChange={onTheoryChange} />
                        </div>
                    )}
                </div>

                {/* Display settings */}
                <div className="mb-3">
                    <SectionHeader label="Display" open={openSection === "display"} onToggle={() => toggle("display")} />
                    {openSection === "display" && (
                        <div className="mt-2 rounded-lg border border-white/8 bg-black/30 px-4 py-3">
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
                        </div>
                    )}
                </div>

                {/* Color customization */}
                <div className="mb-3">
                    <SectionHeader label="Color Customization" open={openSection === "color"} onToggle={() => toggle("color")} />
                    {openSection === "color" && (
                        <div className="mt-2 space-y-4 rounded-lg border border-white/8 bg-black/30 px-4 py-3">
                            <div>
                                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Page Background</div>
                                <div className="mb-2 flex overflow-hidden rounded-md border border-white/15">
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
                            <div>
                                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Fretboard</div>
                                <ColorRow label="Board" value={boardColor} onChange={setBoardColor} />
                                <ColorRow label="Strings" value={stringColor} onChange={setStringColor} />
                                <ColorRow label="Markers" value={markerColor} onChange={setMarkerColor} />
                                <TextToggle label="Label Text" value={fretLabelTextColor} onChange={setFretLabelTextColor} />
                                <TextToggle label="Note Labels" value={noteTextColor} onChange={setNoteTextColor} />
                            </div>
                            <div>
                                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Chord Display</div>
                                <ColorRow label="Text Color" value={chordDisplayColor} onChange={setChordDisplayColor} />
                            </div>
                            <div>
                                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Playback Bar</div>
                                <ColorRow label="Bar Color" value={playheadColor} onChange={setPlayheadColor} />
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}
