import { ImageResponse } from "next/og";
import { PDFDocument } from "pdf-lib";
import { verifyAdminSession } from "@/lib/auth/session";
import { computeAnalytics } from "@/lib/analytics";
import { getAdminAnalyticsData } from "@/lib/supabase/queries";
import { logoDataUri } from "@/lib/logo-data-uri";
import type { CategoryTone } from "@/lib/format";

export const runtime = "nodejs";

// A4-ish proportions at a resolution crisp enough to print — same reasoning
// as every other next/og usage in this project (OG image, PWA icons): keep
// it one reasonable render, no retry loop, since Satori/ImageResponse has
// already proven reliable at this kind of size in this codebase.
const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;

// Same hex values as the Excel export's BRAND/TONE_ACCENT constants
// (src/app/api/admin/clients/export/route.ts) — kept identical on purpose
// so the two admin exports read as one consistent "Nisafety" visual system.
const NAVY = "#102A33";
const TEAL = "#0F766E";
const TEAL_SOFT = "#DFF4F0";
const AMBER_TEXT = "#B86A00";
const AMBER_SOFT = "#FFF1D8";
const INK_MUTED = "#647679";
const LINE = "#DCE7E3";
const TONE_ACCENT: Record<CategoryTone, string> = { teal: TEAL, amber: AMBER_TEXT, navy: NAVY };
const TONE_SOFT: Record<CategoryTone, string> = { teal: TEAL_SOFT, amber: AMBER_SOFT, navy: "#EAF0F2" };

function KpiBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, backgroundColor: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", fontSize: 13, fontWeight: 700, letterSpacing: 1, color: INK_MUTED, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", marginTop: 8, fontSize: 34, fontWeight: 700, color: NAVY }}>{value}</div>
    </div>
  );
}

function CategoryBar({ category, count, tone, max }: { category: string; count: number; tone: CategoryTone; max: number }) {
  const widthPct = Math.max(6, Math.round((count / max) * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: NAVY }}>
        <div style={{ display: "flex", maxWidth: 520 }}>{category}</div>
        <div style={{ display: "flex", fontWeight: 700 }}>{count}</div>
      </div>
      <div style={{ display: "flex", marginTop: 5, height: 10, width: "100%", backgroundColor: TONE_SOFT[tone], borderRadius: 6 }}>
        <div style={{ display: "flex", width: `${widthPct}%`, height: "100%", backgroundColor: TONE_ACCENT[tone], borderRadius: 6 }} />
      </div>
    </div>
  );
}

export async function GET() {
  if (!(await verifyAdminSession())) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { documents, clientCreatedAt } = await getAdminAnalyticsData();
  const data = computeAnalytics(documents, clientCreatedAt);

  const topCategories = data.topCategories.slice(0, 7);
  const maxCategoryCount = Math.max(1, ...topCategories.map((entry) => entry.count));
  const trendMonths = data.monthlySubmissions;
  const maxMonthCount = Math.max(1, ...trendMonths.map((entry) => entry.count));
  const generatedOn = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const image = new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: "#F7F8F6", padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoDataUri()} width={64} height={Math.round(64 * (192 / 400))} alt="" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: NAVY }}>Directory Summary Report</div>
              <div style={{ display: "flex", fontSize: 13, color: INK_MUTED, marginTop: 2 }}>Nisafety Consultancy · Generated {generatedOn}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
          <KpiBox label="Total Clients" value={data.totalClients} />
          <KpiBox label="Total Documents" value={data.totalDocuments} />
          <KpiBox label="Last 30 Days" value={data.documentsLast30Days} />
          <KpiBox label="Top Category" value={data.topCategory ?? "—"} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 36, backgroundColor: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 16, padding: 28 }}>
          <div style={{ display: "flex", fontSize: 15, fontWeight: 700, color: NAVY }}>Top categories</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {topCategories.length > 0
              ? topCategories.map((entry) => <CategoryBar key={entry.category} category={entry.category} count={entry.count} tone={entry.tone} max={maxCategoryCount} />)
              : <div style={{ display: "flex", marginTop: 12, fontSize: 13, color: INK_MUTED }}>No submissions yet.</div>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, backgroundColor: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 16, padding: 28 }}>
          <div style={{ display: "flex", fontSize: 15, fontWeight: 700, color: NAVY }}>12-month submission trend</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, marginTop: 18 }}>
            {trendMonths.map((entry) => (
              <div key={entry.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div style={{ display: "flex", width: "100%", maxWidth: 28, height: Math.max(4, Math.round((entry.count / maxMonthCount) * 110)), backgroundColor: TEAL, borderRadius: 4 }} />
                <div style={{ display: "flex", marginTop: 8, fontSize: 10, color: INK_MUTED }}>{entry.month}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, backgroundColor: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 16, padding: 28 }}>
          <div style={{ display: "flex", fontSize: 15, fontWeight: 700, color: NAVY }}>Top companies by submissions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            {data.topCompanies.length > 0
              ? data.topCompanies.slice(0, 10).map((entry) => (
                  <div key={entry.company} style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: TEAL_SOFT, borderRadius: 999, padding: "8px 16px", fontSize: 13, color: NAVY, fontWeight: 600 }}>
                    {entry.company} <span style={{ display: "flex", color: TEAL }}>· {entry.count}</span>
                  </div>
                ))
              : <div style={{ display: "flex", fontSize: 13, color: INK_MUTED }}>No submissions yet.</div>}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        <div style={{ display: "flex", justifyContent: "center", backgroundColor: TEAL_SOFT, borderRadius: 12, padding: "12px 0", fontSize: 12, fontWeight: 700, color: NAVY }}>
          Nisafety Consultancy — Confidential · {data.totalClients} client{data.totalClients === 1 ? "" : "s"} · {data.totalDocuments} document{data.totalDocuments === 1 ? "" : "s"}
        </div>
      </div>
    ),
    { width: PAGE_WIDTH, height: PAGE_HEIGHT },
  );

  const pngBytes = new Uint8Array(await image.arrayBuffer());

  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBytes);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawImage(pngImage, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });

  const pdfBytes = await pdfDoc.save();
  const fileName = `nisafety-hub-summary-report-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(pdfBytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
