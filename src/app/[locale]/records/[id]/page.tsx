import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ViewTransition } from "react";
import { AddServicePanel } from "@/app/_components/add-service-panel";
import { ConfirmMonitoringDate } from "@/app/_components/confirm-monitoring-date";
import { ArrowUpRight, Calendar, Download, File } from "@/app/_components/icons";
import { BrandLogo } from "@/app/_components/brand-logo";
import { LanguageSwitcher } from "@/app/_components/language-switcher";
import { DeleteReportButton } from "@/app/_components/record-delete-buttons";
import { RecordDetailBody } from "@/app/_components/record-detail-body";
import { RequestedServicesCard } from "@/app/_components/requested-services-card";
import { ServiceTimeline } from "@/app/_components/service-timeline";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { ValidityCard } from "@/app/_components/validity-card";
import { Link } from "@/i18n/routing";
import { DOCUMENT_CATEGORIES, formatServiceDate, toneBadgeClass } from "@/lib/format";
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
      return tCategories(category);
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
                <section aria-labelledby="report-documents-title" className="mt-6 rounded-2xl border border-line bg-surface-soft p-2 print:border-0 print:bg-transparent print:p-0">
                  <p id="report-documents-title" className="px-3 pb-2 pt-2 font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">
                    {tServices("documentsTitle")} · {record.extraFiles.length + 1}
                  </p>
                  <ol className="grid gap-1.5">
                    {[
                      { id: "main", label: record.fileLabel ?? tServices("mainDocument"), fileName: record.fileName!, fileType: record.fileType!, fileSize: record.fileSize!, url: record.publicUrl },
                      ...record.extraFiles,
                    ].map((file, index) => (
                      <li key={file.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 shadow-[0_1px_0_rgba(16,42,51,.04)]">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft font-mono text-[10px] font-bold text-accent">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{file.label}</span>
                          <span className="block truncate text-xs text-ink-muted">
                            {file.fileName} · {file.fileType} · {file.fileSize}
                          </span>
                        </span>
                        {file.url && (
                          <span className="flex shrink-0 items-center gap-1 print:hidden">
                            {file.fileType === "PDF" && (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${t("openInNewTab")} ${file.label}`}
                                className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </a>
                            )}
                            <a
                              href={file.url}
                              download
                              aria-label={`${t("downloadDocument")} ${file.label}`}
                              className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </span>
                        )}
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
