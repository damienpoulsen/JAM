"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    LAYER_GROUPS,
    INTERVAL_OPTIONS,
    isBaseKind,
    type TheorySettings,
    type LayerKind,
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
    onResetToDefault: () => void;
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
    const update = (patch: Partial<TheorySettings>) => onChange({ ...settings, ...patch });

    const base1Taken = isBaseKind(settings.layer2Kind) || isBaseKind(settings.layer3Kind);
    const base2Taken = isBaseKind(settings.layer1Kind) || isBaseKind(settings.layer3Kind);
    const base3Taken = isBaseKind(settings.layer1Kind) || isBaseKind(settings.layer2Kind);

    return (
        <div className="space-y-2">
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
                onToggleFlip={() => onChange({ ...settings, layer2Filled: !settings.layer2Filled })}
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
    onResetToDefault,
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
                            <div className="pt-1 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={onResetToDefault}
                                    className="w-full rounded-lg px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-70"
                                    style={{
                                        fontFamily: "'Rajdhani', sans-serif",
                                        color: "rgba(255,255,255,0.4)",
                                        border: "1px dashed rgba(255,255,255,0.2)",
                                    }}
                                >
                                    Reset to Default
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}
