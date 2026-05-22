import ProSidebar from "./ProSidebar";

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen overflow-hidden text-white" style={{ background: "#070610", fontFamily: "'Lora', serif" }}>
      {/* Background blooms */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute" style={{ width: 900, height: 500, top: -200, left: -300, background: "radial-gradient(ellipse at 36% 40%, rgba(142,28,255,0.6) 0%, rgba(88,15,200,0.18) 52%, transparent 70%)", filter: "blur(88px)" }} />
        <div className="absolute" style={{ width: 900, height: 500, bottom: -200, right: -300, background: "radial-gradient(ellipse at 64% 60%, rgba(142,28,255,0.6) 0%, rgba(88,15,200,0.18) 52%, transparent 70%)", filter: "blur(88px)" }} />
      </div>

      <ProSidebar />

      <main className="relative flex-1 overflow-auto">
        {children}
      </main>

      {/* Pro indicator */}
      <div style={{ position: "fixed", bottom: 16, left: 16, fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.18em", color: "rgba(185,135,255,0.6)", background: "rgba(115,45,210,0.2)", border: "1px solid rgba(140,70,225,0.35)", borderRadius: 4, padding: "3px 8px", zIndex: 50 }}>
        PRO
      </div>
    </div>
  );
}
