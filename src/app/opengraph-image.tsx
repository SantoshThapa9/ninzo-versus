import { ImageResponse } from "next/og";

export const alt = "Ninzo Versus — Free Fire tournaments and 1v1 challenges";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #080b16 0%, #15112b 55%, #092d3b 100%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "76px",
          width: "100%",
        }}
      >
        <div style={{ color: "#60e6ff", display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 5 }}>
          NINZO VERSUS
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, marginTop: 28 }}>
          Free Fire tournaments. 1v1 challenges.
        </div>
        <div style={{ color: "#bdc5d8", display: "flex", fontSize: 30, marginTop: 30 }}>
          Free esports competition for players in India
        </div>
      </div>
    ),
    { ...size },
  );
}
