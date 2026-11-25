"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Close, Search } from "@/app/_components/icons";
import { CATEGORY_GROUPS, categoryMessageKey, categoryNameWithoutAbbreviation, shortCategoryLabel, toneDotClass, toneForCategory } from "@/lib/format";

/**
 * Pick the services a client needs (no file, no date). One search box that
 * opens a grouped list; chosen services sit underneath as removable chips.
 * Stays out of the way when nothing is chosen.
 */
export function ServicePicker({ value, onChange, disabled = false }: { value: string[]; onChange: (next: string[]) => void; disabled?: boolean }) {
  const t = useTranslations("services");
  const tGroups = useTranslations("categories.groups");
  const tCategories = useTranslations("categories.items");
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = new Set(value);

  const label = (category: string) => tCategories(categoryMessageKey(category));

  // Matches the shown name (either language), the stored English name and the short code.
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, " ");
    return CATEGORY_GROUPS.map((group) => ({
      group: group.group,
      categories: group.categories.filter((category) => {
        if (!needle) return true;
        const shown = tCategories(categoryMessageKey(category));
        return [shown, category, shortCategoryLabel(shown)].some((text) => text.toLowerCase().includes(needle));
      }),
    })).filter((group) => group.categories.length > 0);
  }, [query, tCategories]);
  const flat = groups.flatMap((group) => group.categories);

  // Close when clicking anywhere outside the picker.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle(category: string) {
    const next = new Set(selected);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    // Keep the standard order, whatever order they were picked in.
    onChange(CATEGORY_GROUPS.flatMap((group) => group.categories).filter((item) => next.has(item)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (flat.length) setActive((current) => (current + (event.key === "ArrowDown" ? 1 : flat.length - 1)) % flat.length);
    } else if (event.key === "Enter") {
      // Never submit the surrounding form from here.
      event.preventDefault();
      if (open && flat[active]) toggle(flat[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Backspace" && !query && value.length) {
      toggle(value[value.length - 1]);
    }
  }

  const activeCategory = open ? flat[active] : undefined;

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`flex items-center gap-2.5 rounded-xl border bg-surface px-3.5 transition ${
          open ? "border-accent ring-4 ring-accent-soft" : "border-line hover:border-accent/50"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <Search className="h-4 w-4 shrink-0 text-ink-faint" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeCategory ? `${listId}-${flat.indexOf(activeCategory)}` : undefined}
          aria-label={t("pickerLabel")}
          value={query}
          disabled={disabled}
          placeholder={t("pickerPlaceholder")}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-ink-faint"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("pickerToggle")}
          onClick={() => {
            setOpen((current) => !current);
            inputRef.current?.focus();
          }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-soft hover:text-ink"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={t("pickerLabel")}
          // Opens in place (pushes the content below down) rather than floating:
          // the cards around it animate in, which would paint later cards on top.
          className="mt-2 max-h-80 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-1.5 shadow-[0_16px_40px_rgba(16,42,51,.10)] animate-[rise_.18s_ease-out_both]"
        >
          {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-muted">{t("pickerNoMatch", { query: query.trim() })}</p>}
          {groups.map((group) => (
            <div key={group.group} role="group" aria-label={tGroups(group.group)}>
              <p className="px-3 pb-1 pt-2.5 font-mono text-[10px] font-bold tracking-[0.12em] text-ink-faint">{tGroups(group.group).toUpperCase()}</p>
              {group.categories.map((category) => {
                const index = flat.indexOf(category);
                const on = selected.has(category);
                const shown = label(category);
                const code = shortCategoryLabel(shown);
                const name = categoryNameWithoutAbbreviation(shown);
                const hasCode = code !== shown;
                return (
                  <div
                    key={category}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={on}
                    onPointerDown={(event) => event.preventDefault()}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => toggle(category)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${index === active ? "bg-surface-soft" : ""}`}
                  >
                    <span
                      className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded-md border transition-colors ${
                        on ? "border-accent bg-accent text-white" : "border-line bg-surface"
                      }`}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    {hasCode ? (
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="shrink-0 font-semibold">{code}</span>
                        <span className="truncate text-ink-muted">{name}</span>
                      </span>
                    ) : (
                      <span className="min-w-0 truncate font-medium">{shown}</span>
                    )}
                    <span className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${toneDotClass(toneForCategory(category))}`} aria-hidden="true" />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {value.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {value.map((category) => {
            const shown = label(category);
            return (
              <span
                key={category}
                title={shown}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-2.5 pr-1 text-xs font-semibold animate-[rise_.2s_ease-out_both]"
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDotClass(toneForCategory(category))}`} aria-hidden="true" />
                <span className="truncate">{shortCategoryLabel(shown)}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(category)}
                  aria-label={t("pickerRemove", { service: shown })}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <Close className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {value.length > 1 && (
            <button type="button" disabled={disabled} onClick={() => onChange([])} className="px-1.5 text-xs font-semibold text-ink-faint transition-colors hover:text-danger">
              {t("pickerClear")}
            </button>
          )}
        </div>
      ) : (
        !open && <p className="mt-2.5 text-xs text-ink-faint">{t("pickerNone")}</p>
      )}
    </div>
  );
}
