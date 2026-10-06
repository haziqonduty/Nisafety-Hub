import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo-data-uri";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const LOGO_WIDTH = Math.round(size.width * 0.7);
const LOGO_HEIGHT = Math.round(LOGO_WIDTH * (192 / 400));

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#102a33" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri()} width={LOGO_WIDTH} height={LOGO_HEIGHT} alt="" />
      </div>
    ),
    size,
  );
}
