import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ViewTransition } from "react";
import { Download, File } from "@/app/_components/icons";
import { BrandLogo } from "@/app/_components/brand-logo";
import { LanguageSwitcher } from "@/app/_components/language-switcher";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { Link } from "@/i18n/routing";
import { toneBadgeClass } from "@/lib/format";
import { getRecordById } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function RecordPage(props: PageProps<"/[locale]/records/[id]">) {
  const { id } = await props.params;
  const [record, t, tCategories] = await Promise.all([getRecordById(id), getTranslations("record"), getTranslations("categories.items")]);

  if (!record) notFound();

  // Historical records may still hold a retired pre-taxonomy category name
  // with no translation entry — fall back to the raw stored value rather
  // than let a missing message crash the page.
  let categoryLabel = record.category;
  if (record.category) {
    try {
      categoryLabel = tCategories(record.category);
    } catch {
      // keep the raw value
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6 lg:px-8">
        <BrandLogo />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link href="/" className="text-sm font-semibold text-accent transition-colors hover:text-accent-hover">{t("backToDirectory")}</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-24 pt-6 lg:px-8">
        <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-[0_20px_50px_rgba(16,42,51,.07)] sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className={`rounded-full px-3 py-1.5 font-mono text-xs font-bold tracking-wide ${record.hasDocument ? toneBadgeClass(record.tone!) : "bg-badge-neutral-bg text-badge-neutral-text"}`}>
              {record.hasDocument ? categoryLabel : t("noDocumentBadge")}
            </span>
            <span className="text-xs text-ink-muted">{t("submitted", { date: record.date })}</span>
          </div>

          <ViewTransition name={`${record.hasDocument ? "document" : "client"}-${record.id}`}>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">{record.hasDocument ? record.fileName : record.companyName}</h1>
          </ViewTransition>
          {record.hasDocument && <p className="mt-2 text-sm text-ink-muted">{record.fileType} · {record.fileSize}</p>}

          {record.hasDocument ? (
            <>
              <div className="mt-7 flex flex-wrap items-center gap-3">
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

              <div className="mt-7">
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
            <div className="mt-7 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line p-10 text-center">
              <File className="h-8 w-8 text-ink-faint" />
              <p className="text-sm text-ink-muted">{t("noDocumentNotice")}</p>
            </div>
          )}

          <div className="mt-10 grid gap-5 border-t border-line pt-8 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("clientName")}</p>
              <p className="mt-1 text-sm font-semibold">{record.clientName}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("company")}</p>
              <p className="mt-1 text-sm font-semibold">{record.companyName}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("telephone")}</p>
              <p className="mt-1 text-sm font-semibold">{record.telephone}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("email")}</p>
              <p className="mt-1 text-sm font-semibold">{record.email}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("submittedBy")}</p>
              <p className="mt-1 text-sm font-semibold">{record.submitterName}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
