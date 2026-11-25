import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ViewTransition } from "react";
import { AddServicePanel } from "@/app/_components/add-service-panel";
import { ConfirmMonitoringDate } from "@/app/_components/confirm-monitoring-date";
import { Calendar, Download, File } from "@/app/_components/icons";
import { BrandLogo } from "@/app/_components/brand-logo";
import { LanguageSwitcher } from "@/app/_components/language-switcher";
import { DeleteReportButton } from "@/app/_components/record-delete-buttons";
import { RecordDetailBody } from "@/app/_components/record-detail-body";
import { RequestedServicesCard } from "@/app/_components/requested-services-card";
import { ServiceTimeline } from "@/app/_components/service-timeline";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { ValidityCard } from "@/app/_components/validity-card";
import { Link } from "@/i18n/routing";
import { categoryMessageKey, DOCUMENT_CATEGORIES, formatServiceDate, toneBadgeClass } from "@/lib/format";
import { outstandingServices } from "@/lib/requested-services";
import { getClientServiceHistory, getRecordById } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function RecordPage(props: PageProps<"/[locale]/records/[id]">) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  // ?renew=<category> — arriving from an expiry alert's "Renew" action.
  const renewParam = typeof searchParams.renew === "string" ? searchParams.renew : null;
  const renewCategory = renewParam && (DOCUMENT_CATEGORIES as readonly string[]).includes(renewParam) ? renewParam : null;
  const [record, t, tCategories, tServices, locale] = await Promise.all([
    getRecordById(id),
    getTranslations("record"),
    getTranslations("categories.items"),
    getTranslations("services"),
    getLocale(),
  ]);

  if (!record) notFound();

  // Historical records may still hold a retired pre-taxonomy category name
  // with no translation entry — fall back to the raw stored value rather
  // than let a missing message crash the page.
  function categoryLabelFor(category: string) {
    try {
      return tCategories(categoryMessageKey(category));
    } catch {
      return category;
    }
  }

  const categoryLabel = record.category ? categoryLabelFor(record.category) : record.category;
  const history = await getClientServiceHistory(record.clientId);
  const outstanding = outstandingServices(record.requestedServices, history.map((entry) => entry.category));

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6 lg:px-8 print:py-3">
        <BrandLogo />
        <div className="flex items-center gap-3 print:hidden">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link href="/" className="text-sm font-semibold text-accent transition-colors hover:text-accent-hover">{t("backToDirectory")}</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-24 pt-6 lg:px-8 print:px-0 print:pb-6 print:pt-0">
        <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-[0_20px_50px_rgba(16,42,51,.07)] sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className={`rounded-full px-3 py-1.5 font-mono text-xs font-bold tracking-wide ${record.hasDocument ? toneBadgeClass(record.tone!) : "bg-badge-neutral-bg text-badge-neutral-text"}`}>
              {record.hasDocument ? categoryLabel : t("noDocumentBadge")}
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              {record.serviceDate &&
                (record.serviceDateConfirmed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-semibold text-ink">
                    <Calendar className="h-3.5 w-3.5 text-accent" />
                    {tServices("servicedOn", { date: formatServiceDate(record.serviceDate, locale === "ms" ? "ms-MY" : "en-GB") })}
                  </span>
                ) : (
                  <a
                    href="#confirm-date-title"
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber-soft px-2.5 py-1 font-semibold text-amber transition-colors hover:border-amber print:hidden"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    {tServices("dateUnconfirmed")}
                  </a>
                ))}
              <span>{t("submitted", { date: record.date })}</span>
            </span>
          </div>

          <ViewTransition name={`${record.hasDocument ? "document" : "client"}-${record.id}`}>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">{record.hasDocument ? record.fileName : record.companyName}</h1>
          </ViewTransition>
          {record.hasDocument && <p className="mt-2 text-sm text-ink-muted">{record.fileType} · {record.fileSize}</p>}
          {(record.hasDocument || record.pendingSalesPerson || record.pendingMaincon) && (
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { label: tServices("salesPerson"), value: (record.hasDocument ? record.salesPerson : record.pendingSalesPerson) ?? tServices("notRecorded") },
                { label: tServices("maincon"), value: (record.hasDocument ? record.maincon : record.pendingMaincon) ?? tServices("directJob") },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-line bg-surface-soft px-4 py-3">
                  <dt className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{item.label.toUpperCase()}</dt>
                  <dd className="mt-1 text-sm font-semibold">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {record.hasDocument && record.category && record.serviceDate && !record.serviceDateConfirmed && (
            <ConfirmMonitoringDate id={record.id} category={record.category} guessedDate={record.serviceDate} expiryDate={record.expiryDate} />
          )}

          {record.hasDocument && record.category && record.serviceDate && (
            <ValidityCard
              id={record.id}
              category={record.category}
              serviceDate={record.serviceDate}
              expiryDate={record.expiryDate}
              history={history}
              company={record.companyName}
              closedAt={record.renewalClosedAt}
              closedReason={record.renewalClosedReason}
            />
          )}

          {record.hasDocument ? (
            <>
              <div className="mt-7 flex flex-wrap items-center gap-3 print:hidden">
                <a
                  href={record.publicUrl!}
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(15,118,110,.18)] transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
                >
                  <Download className="h-4 w-4" /> {t("downloadDocument")}
                </a>
                {record.fileType === "PDF" && (
                  <a
                    href={record.publicUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
                  >
                    {t("openInNewTab")}
                  </a>
                )}
                <span className="ml-auto">
                  <DeleteReportButton documentId={record.id} fileName={record.fileName!} category={categoryLabel ?? ""} />
                </span>
              </div>

              {(record.extraFiles.length > 0 || record.fileLabel) && (
                // View only (Kay, 2026-11-26): just the names staff gave each document —
                // no file names, no links. The main report's buttons sit above.
                <section
                  aria-labelledby="report-documents-title"
                  className="relative mt-6 overflow-hidden rounded-2xl border border-line bg-surface p-5 print:border-0 print:p-0"
                >
                  <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent-soft/60 blur-3xl print:hidden" />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent">
                        <File className="h-4 w-4" />
                      </span>
                      <h2 id="report-documents-title" className="font-mono text-[10px] font-bold tracking-[0.14em] text-ink-muted">
                        {tServices("documentsTitle")}
                      </h2>
                    </div>
                    <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-ink-muted">
                      {record.extraFiles.length + 1}
                    </span>
                  </div>
                  <ol className="relative mt-4 divide-y divide-line">
                    {[
                      { id: "main", label: record.fileLabel ?? tServices("mainDocument"), fileType: record.fileType!, fileSize: record.fileSize! },
                      ...record.extraFiles,
                    ].map((file, index) => (
                      <li key={file.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                        <span className="w-6 shrink-0 font-mono text-xs font-bold tabular-nums text-accent">{String(index + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-0.01em]">{file.label}</span>
                        {index === 0 && (
                          <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[9px] font-bold tracking-[0.1em] text-accent">
                            {tServices("mainBadge")}
                          </span>
                        )}
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">
                          {file.fileType} · {file.fileSize}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <div className="mt-7 print:hidden">
                {record.fileType === "PDF" ? (
                  <iframe
                    src={record.publicUrl!}
                    title={record.fileName!}
                    className="h-[70vh] w-full rounded-2xl border border-line"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line p-10 text-center">
                    <File className="h-8 w-8 text-ink-faint" />
                    <p className="text-sm text-ink-muted">{t("previewUnavailable", { fileType: record.fileType! })}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="mt-7 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line p-10 text-center print:border-0 print:p-0">
              <File className="h-8 w-8 text-ink-faint print:hidden" />
              <p className="text-sm text-ink-muted">{t("noDocumentNotice")}</p>
            </div>
          )}

          <RecordDetailBody record={record} reportCount={history.length} />

          <section id="service-history" className="mt-10 scroll-mt-6 border-t border-line pt-8 print:hidden" aria-labelledby="service-history-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent">{tServices("historyEyebrow")}</p>
                <h2 id="service-history-title" className="mt-1 text-xl font-semibold tracking-[-0.04em]">
                  {tServices("historyTitle")}
                </h2>
              </div>
              <AddServicePanel
                key={renewCategory ?? "add"}
                clientId={record.clientId}
                companyName={record.companyName}
                renewCategory={renewCategory}
                initialJob={{ salesPerson: record.pendingSalesPerson ?? "", maincon: record.pendingMaincon ?? "" }}
              />
            </div>
            {(outstanding.length > 0 || history.length === 0) && <RequestedServicesCard key={outstanding.join("|")} clientId={record.clientId} recordId={record.id} outstanding={outstanding} />}
            <ServiceTimeline history={history} currentId={record.id} />
          </section>

          <div className="mt-8 hidden border-t border-line pt-4 text-xs text-ink-muted print:block">
            <p>{t("printedFrom")}</p>
            <p className="mt-0.5 font-mono">{t("printRecordId", { id: record.id })}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
