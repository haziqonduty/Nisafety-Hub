import { getTranslations } from "next-intl/server";
import { Download, Spark, Users } from "@/app/_components/icons";
import { Link } from "@/i18n/routing";
import type { DirectoryDocument } from "@/lib/supabase/queries";

export async function DirectoryPreview({ documents, totalCount }: { documents: DirectoryDocument[]; totalCount: number }) {
  const t = await getTranslations("directory");
  const recent = documents.slice(0, 3);

  return (
    <div className="relative animate-[rise_.7s_.38s_ease-out_both]">
      <div className="absolute -inset-5 rounded-[2rem] border border-accent-soft bg-accent-soft/70 -rotate-3" />
      <div className="relative rounded-[1.5rem] border border-line bg-surface p-5 shadow-[0_30px_70px_rgba(16,42,51,.11)] sm:p-6">
        <div className="flex items-center justify-between border-b border-line pb-5">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-ink-muted">{t("liveDirectory")}</p>
            <p className="mt-1 text-sm font-medium">{t("recentlyPublished")}</p>
          </div>
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">{t("recordsCount", { count: totalCount })}</span>
        </div>
        {recent.length > 0 ? (
          <div className="space-y-3 py-5">
            {recent.map((document) => (
              <Link
                key={document.id}
                href={`/records/${document.id}`}
                className="flex items-center gap-3 rounded-xl border border-line p-3 transition-transform duration-300 hover:translate-x-1"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-badge-neutral-bg text-badge-neutral-text">
                  {document.hasDocument ? <span className="font-mono text-[10px] font-bold">{document.fileType}</span> : <Users className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{document.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{document.company}</p>
                </div>
                {document.hasDocument && <Download className="h-4 w-4 shrink-0 text-ink-faint" />}
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-ink-muted">{t("previewEmpty")}</p>
        )}
        <div className="flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm text-on-brand">
          <Spark className="h-4 w-4 text-on-brand-accent" />
          <span className="font-medium">{t("searchHint")}</span>
        </div>
      </div>
    </div>
  );
}
