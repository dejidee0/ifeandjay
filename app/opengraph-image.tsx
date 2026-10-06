import { ImageResponse } from "next/og";

export const alt = "Ifedayo and Joyce traditional wedding";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", color: "#f2e7d7", background: "linear-gradient(135deg, #070707 0%, #171113 58%, #06222a 100%)", fontFamily: "Georgia, serif" }}>
      <div style={{ position: "absolute", inset: 28, border: "1px solid rgba(192,145,88,.75)", display: "flex" }} />
      <div style={{ position: "absolute", inset: 42, border: "1px solid rgba(242,231,215,.12)", display: "flex" }} />
      <div style={{ width: 190, height: 630, display: "flex", background: "linear-gradient(135deg, rgba(0,107,128,.62), rgba(0,79,99,.14))", borderRight: "1px solid rgba(192,145,88,.55)" }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 76px", flex: 1 }}>
        <div style={{ color: "#c09158", fontFamily: "monospace", fontSize: 18, letterSpacing: 7, marginBottom: 28 }}>THE ADEDEJI + AKORA UNION</div>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 92, lineHeight: .88, letterSpacing: -5 }}><span>IFEDAYO</span><span style={{ color: "#c09158", fontSize: 62, fontStyle: "italic", margin: "0 28px" }}>&amp;</span><span>JOYCE</span></div>
        <div style={{ width: 580, height: 1, background: "#c09158", margin: "35px 0 24px" }} />
        <div style={{ fontFamily: "monospace", fontSize: 19, letterSpacing: 6 }}>TRADITIONAL WEDDING · NOVEMBER 2026</div>
      </div>
      <div style={{ position: "absolute", right: 66, bottom: 54, color: "rgba(242,231,215,.45)", fontFamily: "monospace", fontSize: 13, letterSpacing: 4 }}>STRICTLY BY INVITATION</div>
    </div>,
    size,
  );
}
