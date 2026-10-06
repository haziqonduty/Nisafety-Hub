import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo-data-uri";

export const runtime = "nodejs";
export const alt = "Nisafety Hub — public safety records directory";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_WIDTH = 360;
const LOGO_HEIGHT = Math.round(LOGO_WIDTH * (192 / 400));

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          background: "#102a33",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri()} width={LOGO_WIDTH} height={LOGO_HEIGHT} alt="" />
        <div style={{ display: "flex", color: "#dff4f0", fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>
          Public safety records, made easy to find.
        </div>
      </div>
    ),
    size,
  );
}
