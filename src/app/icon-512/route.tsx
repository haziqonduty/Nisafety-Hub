import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo-data-uri";

export const runtime = "nodejs";

const SIZE = 512;
const LOGO_WIDTH = Math.round(SIZE * 0.7);
const LOGO_HEIGHT = Math.round(LOGO_WIDTH * (192 / 400));

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#102a33" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri()} width={LOGO_WIDTH} height={LOGO_HEIGHT} alt="" />
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
