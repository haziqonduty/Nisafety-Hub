import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ViewTransition } from "react";
import { AddServicePanel } from "@/app/_components/add-service-panel";
import { Calendar, Download, File } from "@/app/_components/icons";
import { BrandLogo } from "@/app/_components/brand-logo";
import { LanguageSwitcher } from "@/app/_components/language-switcher";
import { RecordDetailBody } from "@/app/_components/record-detail-body";
import { ServiceTimeline } from "@/app/_components/service-timeline";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { Link } from "@/i18n/routing";
import { formatServiceDate, toneBadgeClass } from "@/lib/format";
import { getClientServiceHistory, getRecordById } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function RecordPage(props: PageProps<"/[locale]/records/[id]">) {
  const { id } = await props.params;
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
              {record.serviceDate && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-semibold text-ink">
                  <Calendar className="h-3.5 w-3.5 text-accent" />
                  {tServices("servicedOn", { date: formatServiceDate(record.serviceDate, locale === "ms" ? "ms-MY" : "en-GB") })}
                </span>
              )}
              <span>{t("submitted", { date: record.date })}</span>
            </span>
          </div>

          <ViewTransition name={`${record.hasDocument ? "document" : "client"}-${record.id}`}>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">{record.hasDocument ? record.fileName : record.companyName}</h1>
          </ViewTransition>
          {record.hasDocument && <p className="mt-2 text-sm text-ink-muted">{record.fileType} · {record.fileSize}</p>}

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
              </div>

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

          <RecordDetailBody record={record} />

          <section className="mt-10 border-t border-line pt-8 print:hidden" aria-labelledby="service-history-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent">{tServices("historyEyebrow")}</p>
                <h2 id="service-history-title" className="mt-1 text-xl font-semibold tracking-[-0.04em]">
                  {tServices("historyTitle")}
                </h2>
              </div>
              <AddServicePanel clientId={record.clientId} companyName={record.companyName} />
            </div>
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
