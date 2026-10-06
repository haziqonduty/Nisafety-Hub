"use client";

import { Command } from "cmdk";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "@/app/_components/icons";
import { CATEGORY_GROUPS, toneDotClass, toneForCategory } from "@/lib/format";

export function CategoryFilter({ category, onChange }: { category: string; onChange: (category: string) => void }) {
  const t = useTranslations("categoryFilter");
  const tGroups = useTranslations("categories.groups");
  const tCategories = useTranslations("categories.items");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function categoryLabel(value: string) {
    if (value === "All records") return t("allRecords");
    try {
      return tCategories(value);
    } catch {
      return value;
    }
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function select(value: string) {
    onChange(value);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative mt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-sm font-semibold text-ink transition hover:border-accent-soft focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft sm:w-auto sm:min-w-[16rem]"
      >
        {category !== "All records" && <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${toneDotClass(toneForCategory(category))}`} />}
        <span className="flex-1">{categoryLabel(category)}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_55px_rgba(16,42,51,.16)] sm:w-[26rem]">
          <Command loop>
            <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3 focus-within:bg-accent-soft/30">
              <Search className="h-4 w-4 text-accent" />
              <Command.Input autoFocus placeholder={t("filterPlaceholder")} aria-label={t("filterPlaceholder")} className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint" />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-sm text-ink-muted">{t("noMatch")}</Command.Empty>
              <Command.Item
                value="All records"
                onSelect={() => select("All records")}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
              >
                {t("allRecords")}
              </Command.Item>
              {CATEGORY_GROUPS.map((group) => (
                <Command.Group
                  key={group.group}
                  heading={tGroups(group.group)}
                  className="mt-2 [&_[cmdk-group-heading]]:block [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-ink-faint [&_[cmdk-group-items]]:mt-1"
                >
                  {group.categories.map((item) => (
                    <Command.Item
                      key={item}
                      value={item}
                      onSelect={() => select(item)}
                      className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm normal-case not-italic tracking-normal text-ink data-[selected=true]:bg-accent-soft"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDotClass(group.tone)}`} />
                      <span className="min-w-0">{tCategories(item)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  );
}
