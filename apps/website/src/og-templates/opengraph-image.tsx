import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";
export const alt = "DevMentorAI — Context-Aware AI Browser Mentor";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background:
            "radial-gradient(circle at 20% 20%, #1d4ed8 0%, #0f172a 45%), linear-gradient(120deg, #0b1120 0%, #1e1b4b 60%, #312e81 100%)",
          color: "#f8fafc",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "58px",
              height: "58px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "34px",
            }}
          >
            D
          </div>
          <div style={{ fontSize: "34px", fontWeight: 700 }}>DevMentorAI</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "950px" }}>
          <div style={{ fontSize: "64px", fontWeight: 800, lineHeight: 1.05 }}>
            Context-Aware AI Browser Mentor
          </div>
          <div style={{ fontSize: "34px", color: "#c4b5fd", fontWeight: 600 }}>
            Powered by GitHub Copilot CLI
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "24px",
            color: "#cbd5e1",
          }}
        >
          <span>Understand pages, logs, and cloud dashboards instantly</span>
          <span>devmentorai.edwardiaz.dev</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
