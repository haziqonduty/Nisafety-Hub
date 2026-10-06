import { readFile } from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";
import { verifyAdminSession } from "@/lib/auth/session";
import { toneForCategory, type CategoryTone } from "@/lib/format";
import { getAdminClients } from "@/lib/supabase/queries";

const BRAND = {
  navy: "FF102A33",
  navyDark: "FF0B1F26",
  teal: "FF0F766E",
  tealSoft: "FFDFF4F0",
  amberSoft: "FFFFF1D8",
  amberText: "FFB86A00",
  line: "FFDCE7E3",
  ink: "FF102A33",
  inkMuted: "FF647679",
  zebra: "FFF7FBFA",
  white: "FFFFFFFF",
};

const TONE_ACCENT: Record<CategoryTone, string> = { teal: BRAND.teal, amber: BRAND.amberText, navy: BRAND.navy };

const COLUMNS: { header: string; width: number }[] = [
  { header: "Client Name", width: 24 },
  { header: "Company Name", width: 28 },
  { header: "Telephone", width: 18 },
  { header: "Email", width: 30 },
  { header: "Submitted By", width: 20 },
  { header: "Submission Date", width: 18 },
  { header: "Category", width: 44 },
  { header: "Document File Name", width: 38 },
];

const ACCENT_ROW = 1;
const KPI_LABEL_ROW = 6;
const KPI_VALUE_ROW = 7;
const HEADER_ROW = 9;

function thinBorder(color: string) {
  const side = { style: "thin" as const, color: { argb: color } };
  return { top: side, left: side, bottom: side, right: side };
}

function fillRow(sheet: ExcelJS.Worksheet, rowNumber: number, color: string, columns: number) {
  const row = sheet.getRow(rowNumber);
  for (let col = 1; col <= columns; col += 1) {
    row.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  }
}

type Stat = { label: string; value: string; tone: CategoryTone };

function drawStatBox(sheet: ExcelJS.Worksheet, colStart: number, stat: Stat) {
  const colEnd = colStart + 1;
  sheet.mergeCells(KPI_LABEL_ROW, colStart, KPI_LABEL_ROW, colEnd);
  sheet.mergeCells(KPI_VALUE_ROW, colStart, KPI_VALUE_ROW, colEnd);

  const thin = { style: "thin" as const, color: { argb: BRAND.line } };
  const accentTop = { style: "medium" as const, color: { argb: TONE_ACCENT[stat.tone] } };

  const labelLeft = sheet.getCell(KPI_LABEL_ROW, colStart);
  const labelRight = sheet.getCell(KPI_LABEL_ROW, colEnd);
  const valueLeft = sheet.getCell(KPI_VALUE_ROW, colStart);
  const valueRight = sheet.getCell(KPI_VALUE_ROW, colEnd);

  for (const cell of [labelLeft, labelRight, valueLeft, valueRight]) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.white } };
  }

  labelLeft.border = { top: accentTop, left: thin };
  labelRight.border = { top: accentTop, right: thin };
  valueLeft.border = { bottom: thin, left: thin };
  valueRight.border = { bottom: thin, right: thin };

  labelLeft.value = stat.label.toUpperCase();
  labelLeft.font = { size: 9, bold: true, color: { argb: BRAND.inkMuted } };
  labelLeft.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  valueLeft.value = stat.value;
  valueLeft.font = { size: 15, bold: true, color: { argb: BRAND.navy } };
  valueLeft.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
}

export async function GET() {
  if (!(await verifyAdminSession())) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const clients = await getAdminClients();

  type ExportRow = {
    clientName: string;
    companyName: string;
    telephone: string;
    email: string;
    submitterName: string;
    createdAt: string;
    category: string | null;
    fileName: string | null;
  };

  const rows: ExportRow[] = clients.flatMap((client): ExportRow[] => {
    const base = {
      clientName: client.clientName,
      companyName: client.companyName,
      telephone: client.telephone,
      email: client.email,
      submitterName: client.submitterName,
      createdAt: client.createdAt,
    };
    if (client.documents.length === 0) return [{ ...base, category: null, fileName: null }];
    return client.documents.map((document) => ({ ...base, category: document.category, fileName: document.fileName }));
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nisafety Consultancy";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Client Records", {
    views: [{ state: "frozen", ySplit: HEADER_ROW, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: BRAND.navy } },
  });

  sheet.columns = COLUMNS.map((column) => ({ width: column.width }));

  // Top accent strip
  fillRow(sheet, ACCENT_ROW, BRAND.teal, COLUMNS.length);
  sheet.getRow(ACCENT_ROW).height = 5;

  // Banner (light brand tint — the logo's wordmark is dark navy, so a dark
  // banner behind it would make the text unreadable)
  for (const rowNumber of [2, 3, 4]) fillRow(sheet, rowNumber, BRAND.tealSoft, COLUMNS.length);
  sheet.getRow(2).height = 24;
  sheet.getRow(3).height = 20;
  sheet.getRow(4).height = 12;
  sheet.getRow(5).height = 10;

  try {
    const logoBuffer = await readFile(path.join(process.cwd(), "public", "nisafety-consultancy-logo.png"));
    const logoImageId = workbook.addImage({ buffer: logoBuffer as unknown as ExcelJS.Buffer, extension: "png" });
    sheet.addImage(logoImageId, { tl: { col: 0.15, row: 1.15 }, ext: { width: 150, height: 72 } });
  } catch {
    // Logo is a nice-to-have; the export still works fine without it.
  }

  sheet.mergeCells(2, 3, 2, COLUMNS.length);
  const titleCell = sheet.getCell(2, 3);
  titleCell.value = "Client Records Export";
  titleCell.font = { size: 20, bold: true, color: { argb: BRAND.navy } };
  titleCell.alignment = { vertical: "middle" };

  sheet.mergeCells(3, 3, 3, COLUMNS.length);
  const subtitleCell = sheet.getCell(3, 3);
  subtitleCell.value = `Generated ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} · Nisafety Consultancy`;
  subtitleCell.font = { size: 11, italic: true, color: { argb: BRAND.inkMuted } };

  // KPI stat strip
  const documentRows = rows.filter((row) => row.fileName !== null);
  const categoryCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.category) continue;
    categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
  }
  let topCategory = "—";
  let topCount = 0;
  for (const [category, count] of categoryCounts) {
    if (count > topCount) {
      topCategory = category;
      topCount = count;
    }
  }
  const topCategoryLabel = topCategory.length > 26 ? `${topCategory.slice(0, 26)}…` : topCategory;

  const stats: Stat[] = [
    { label: "Total Clients", value: String(clients.length), tone: "teal" },
    { label: "Total Documents", value: String(documentRows.length), tone: "amber" },
    { label: "Categories Covered", value: String(categoryCounts.size), tone: "navy" },
    { label: "Top Category", value: topCategoryLabel, tone: "teal" },
  ];
  stats.forEach((stat, index) => drawStatBox(sheet, index * 2 + 1, stat));
  sheet.getRow(KPI_LABEL_ROW).height = 16;
  sheet.getRow(KPI_VALUE_ROW).height = 24;
  sheet.getRow(HEADER_ROW - 1).height = 10;

  const headerRow = sheet.getRow(HEADER_ROW);
  COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: BRAND.white }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.navy } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { ...thinBorder(BRAND.navyDark), bottom: { style: "medium", color: { argb: BRAND.teal } } };
  });
  headerRow.height = 24;

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(HEADER_ROW + 1 + index);
    const values = [row.clientName, row.companyName, row.telephone, row.email, row.submitterName, new Date(row.createdAt), row.category ?? "—", row.fileName ?? "—"];
    values.forEach((value, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 1);
      cell.value = value;
      cell.border = thinBorder(BRAND.line);
      cell.font = { size: 10.5, color: { argb: BRAND.ink } };
      cell.alignment = { vertical: "middle" };
      if (columnIndex === 5) cell.numFmt = "dd mmm yyyy";
    });

    const categoryCell = excelRow.getCell(7);
    if (row.category) {
      const tone = toneForCategory(row.category);
      categoryCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tone === "teal" ? BRAND.tealSoft : tone === "amber" ? BRAND.amberSoft : BRAND.line } };
      categoryCell.font = { size: 10.5, bold: true, color: { argb: tone === "amber" ? BRAND.amberText : BRAND.teal } };
    }

    if (index % 2 === 1) {
      excelRow.eachCell((cell, columnIndex) => {
        if (columnIndex === 7 && row.category) return;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.zebra } };
      });
    }
  });

  sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: COLUMNS.length } };

  const dataEndRow = HEADER_ROW + rows.length;
  const footerAccentRow = dataEndRow + 2;
  const footerBandRow = dataEndRow + 3;

  sheet.getRow(dataEndRow + 1).height = 8;
  fillRow(sheet, footerAccentRow, BRAND.teal, COLUMNS.length);
  sheet.getRow(footerAccentRow).height = 4;

  fillRow(sheet, footerBandRow, BRAND.tealSoft, COLUMNS.length);
  sheet.getRow(footerBandRow).height = 24;
  sheet.mergeCells(footerBandRow, 1, footerBandRow, COLUMNS.length);
  const footerCell = sheet.getCell(footerBandRow, 1);
  footerCell.value = `${clients.length} client record${clients.length === 1 ? "" : "s"} · ${documentRows.length} document${documentRows.length === 1 ? "" : "s"} · Nisafety Consultancy — Confidential`;
  footerCell.font = { size: 9.5, bold: true, color: { argb: BRAND.navy } };
  footerCell.alignment = { vertical: "middle", horizontal: "center" };

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `nisafety-hub-client-records-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
