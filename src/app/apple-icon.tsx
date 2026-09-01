import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#071018",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 96,
            height: 122,
            border: "5px solid #3fd0c9",
            borderRadius: 10,
            background: "#0d1824",
            padding: "18px 14px 14px",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 68,
              height: 12,
              background: "#3fd0c9",
              borderRadius: 4,
              marginBottom: 14,
            }}
          />
          <div
            style={{
              width: 68,
              height: 8,
              background: "#eef4f8",
              borderRadius: 3,
              opacity: 0.85,
              marginBottom: 10,
            }}
          />
          <div
            style={{
              width: 52,
              height: 8,
              background: "#eef4f8",
              borderRadius: 3,
              opacity: 0.55,
              marginBottom: 10,
            }}
          />
          <div
            style={{
              width: 58,
              height: 8,
              background: "#eef4f8",
              borderRadius: 3,
              opacity: 0.4,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
