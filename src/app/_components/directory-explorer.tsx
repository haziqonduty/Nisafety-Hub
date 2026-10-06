"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, ViewTransition } from "react";
import { Download, Search } from "@/app/_components/icons";
import { CategoryFilter } from "@/app/_components/category-filter";
import { SpotlightCard } from "@/app/_components/spotlight-card";
import { Link } from "@/i18n/routing";
import { toneBadgeClass } from "@/lib/format";
import type { DirectoryDocument } from "@/lib/supabase/queries";

export function DirectoryExplorer({ documents }: { documents: DirectoryDocument[] }) {
  const t = useTranslations("directory");
  const tCategories = useTranslations("categories.items");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All records");

  function categoryLabel(value: string | null) {
    if (!value) return t("clientOnlyBadge");
    try {
      return tCategories(value);
    } catch {
      return value;
    }
  }

  const visibleDocuments = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();
    return documents.filter(
      (document) =>
        (category === "All records" || document.category === category) &&
        (!normalisedQuery ||
          `${document.title} ${document.company} ${document.category ?? ""} ${document.clientName} ${document.telephone} ${document.email}`
            .toLowerCase()
            .includes(normalisedQuery)),
    );
  }, [category, documents, query]);

  return (
    <>
      <div className="mt-10 rounded-2xl border border-line bg-surface p-4 shadow-[0_16px_40px_rgba(16,42,51,.05)] sm:p-5">
        <label className="flex items-center gap-3 rounded-xl border border-line bg-surface-soft px-4 py-3.5 transition-shadow focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
          <Search className="h-5 w-5 text-accent" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchAriaLabel")}
          />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="hidden rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-faint transition-colors hover:border-accent hover:text-accent sm:inline"
            aria-label={t("openCommandPalette")}
          >
            ⌘ K
          </button>
        </label>
        <CategoryFilter category={category} onChange={setCategory} />
      </div>
      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">{visibleDocuments.length}</span> {t("matchingRecords")}
        </p>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setCategory("All records");
          }}
          className="text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
        >
          {t("clearFilters")}
        </button>
      </div>
      <div className="mt-5 flex flex-col gap-4">
        {visibleDocuments.map((document) => (
          <SpotlightCard
            as="article"
            key={document.id}
            className="group rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent-soft hover:shadow-[0_18px_38px_rgba(16,42,51,.09)]"
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className={`rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide ${document.hasDocument ? toneBadgeClass(document.tone!) : "bg-badge-neutral-bg text-badge-neutral-text"}`}
              >
                {document.hasDocument ? `${document.fileType} · ${document.fileSize}` : t("clientOnlyBadge")}
              </span>
              {document.hasDocument && (
                <a
                  href={document.publicUrl!}
                  download
                  className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
                  aria-label={t("download", { title: document.title })}
                >
                  <Download className="h-4 w-4" />
                </a>
              )}
            </div>
            <Link href={`/records/${document.id}`} className="block">
              <ViewTransition name={`${document.hasDocument ? "document" : "client"}-${document.id}`}>
                <h3 className="mt-7 text-lg font-semibold tracking-[-0.03em]">{document.title}</h3>
              </ViewTransition>
              <p className="mt-2 text-sm text-ink-muted">{document.company}</p>
            </Link>
            <div className="mt-7 flex items-center justify-between border-t border-line pt-4 text-xs text-ink-muted">
              <span>{categoryLabel(document.category)}</span>
              <span>{document.date}</span>
            </div>
          </SpotlightCard>
        ))}
      </div>
      {visibleDocuments.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">
          {documents.length === 0 ? t("emptyNoRecords") : t("emptyNoMatch")}
        </div>
      )}
    </>
  );
}
