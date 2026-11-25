"use client";

import { useTranslations } from "next-intl";
import { Check } from "@/app/_components/icons";
import { CATEGORY_GROUPS, categoryMessageKey, toneDotClass } from "@/lib/format";

/** Tick the services a client needs (no file, no date). Grouped like the category filter. */
export function ServicePicker({ value, onChange, disabled = false }: { value: string[]; onChange: (next: string[]) => void; disabled?: boolean }) {
  const tGroups = useTranslations("categories.groups");
  const tCategories = useTranslations("categories.items");
  const selected = new Set(value);

  function toggle(category: string) {
    const next = new Set(selected);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    // Keep the standard order, whatever order they were ticked in.
    onChange(CATEGORY_GROUPS.flatMap((group) => group.categories).filter((item) => next.has(item)));
  }

  return (
    <div className="space-y-5">
      {CATEGORY_GROUPS.map((group) => (
        <fieldset key={group.group} disabled={disabled}>
          <legend className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{tGroups(group.group)}</legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {group.categories.map((category) => {
              const on = selected.has(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(category)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition disabled:opacity-60 ${
                    on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-muted hover:border-accent-soft hover:text-ink"
                  }`}
                >
                  {on ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className={`h-2 w-2 shrink-0 rounded-full ${toneDotClass(group.tone)}`} aria-hidden="true" />}
                  {tCategories(categoryMessageKey(category))}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
