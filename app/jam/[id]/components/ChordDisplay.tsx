"use client";

type ChordDisplayProps = {
    bpm: number | string;
    currentChord: string;
    keyOpen: boolean;
    keyOptions: string[];
    nextChord: string;
    onBpmChange: (value: string) => void;
    onKeySelect: (keyOption: string) => void;
    onToggleKeyOpen: () => void;
    songKey: string;
};

function BpmControl({
    bpm,
    onChange,
}: {
    bpm: ChordDisplayProps["bpm"];
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex items-center justify-end">
            <span className="mr-3 text-lg text-white/55">BPM:</span>
            <input
                type="number"
                className="min-w-[120px] rounded border-2 border-white bg-black px-4 py-1 text-center text-lg text-white shadow-[0_0_0_2px_rgba(255,255,255,0.2),0_0_14px_rgba(255,255,255,0.14)]"
                value={bpm === "--" ? "" : bpm}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

export default function ChordDisplay({
    bpm,
    currentChord,
    keyOpen,
    keyOptions,
    nextChord,
    onBpmChange,
    onKeySelect,
    onToggleKeyOpen,
    songKey,
}: ChordDisplayProps) {
    return (
        <>
            {/* Top-right song settings row */}
            <div className="relative z-30 mt-1 mb-0 flex justify-end">
                <div className="mt-1 mb-0 flex w-[220px] flex-col items-end gap-2">
                    <div className="relative flex w-full items-center justify-end">
                        <span className="mr-3 text-lg text-white/55">Key:</span>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={onToggleKeyOpen}
                                className="min-w-[120px] cursor-pointer rounded border border-white/18 bg-[#0f0f0f] px-4 py-1 text-center text-lg text-white shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
                            >
                                {songKey}
                            </button>

                            {keyOpen && (
                                <div className="absolute right-0 z-50 mt-2 max-h-[200px] w-[180px] overflow-y-auto rounded border border-white/12 bg-[#0f0f0f] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                                    {keyOptions.map((keyOption) => (
                                        <button
                                            key={keyOption}
                                            type="button"
                                            onClick={() => onKeySelect(keyOption)}
                                            className="w-full cursor-pointer px-3 py-2 text-left text-white/80 transition hover:bg-white hover:text-black"
                                        >
                                            {keyOption}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full">
                        <BpmControl bpm={bpm} onChange={onBpmChange} />
                    </div>
                </div>
            </div>

            <div className="-mt-14 flex flex-col">
                {/* Main chord display: current chord + upcoming chord */}
                <div className="pointer-events-none mb-8 mt-[-88px] flex items-start justify-center gap-10 px-4">
                    <div className="max-w-[68vw] truncate text-[clamp(7rem,14vw,230px)] font-bold leading-none text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
                        {currentChord || "—"}
                    </div>
                    <div className="mt-14 max-w-[22vw] truncate text-[clamp(3rem,6.5vw,104px)] leading-none text-white/40">
                        {nextChord}
                    </div>
                </div>
            </div>
        </>
    );
}
