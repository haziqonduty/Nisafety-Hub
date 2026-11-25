"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Plus } from "@/app/_components/icons";
import { ServicePicker } from "@/app/_components/service-picker";
import { Link, useRouter } from "@/i18n/routing";
import { categoryMessageKey, shortCategoryLabel, toneDotClass, toneForCategory } from "@/lib/format";

/**
 * Services the client needs that have no report yet. Each one links to "Add a
 * service" with that service already chosen; once its report is attached it
 * drops off this list by itself.
 */
export function RequestedServicesCard({ clientId, recordId, outstanding }: { clientId: string; recordId: string; outstanding: string[] }) {
  const t = useTranslations("services");
  const tCategories = useTranslations("categories.items");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(outstanding);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function save() {
    setSaving(true);
    setError(false);
    try {
      const response = await fetch(`/api/clients/${clientId}/requested-services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: draft }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setEditing(false);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-accent">{t("requestedEyebrow")}</p>
          <p className="mt-1 text-sm font-semibold">{outstanding.length ? t("requestedTitle", { count: outstanding.length }) : t("requestedEmptyTitle")}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{t("requestedHint")}</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(outstanding);
              setEditing(true);
            }}
            className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
          >
            {outstanding.length ? t("requestedEdit") : t("requestedAdd")}
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-5">
          <ServicePicker value={draft} onChange={setDraft} disabled={saving} />
          {error && (
            <p role="alert" className="mt-4 text-xs font-medium text-danger">
              {t("requestedSaveError")}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="rounded-full px-4 py-2 text-xs font-semibold text-ink-muted transition hover:text-accent">
              {t("requestedCancel")}
            </button>
            <button type="button" onClick={save} disabled={saving} className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60">
              {saving ? t("requestedSaving") : t("requestedSave")}
            </button>
          </div>
        </div>
      ) : (
        outstanding.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {outstanding.map((category) => {
              const label = tCategories(categoryMessageKey(category));
              return (
                <li key={category}>
                  <Link
                    href={`/records/${recordId}?renew=${encodeURIComponent(category)}`}
                    scroll={false}
                    title={t("requestedAttach", { service: label })}
                    className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold transition hover:border-accent hover:text-accent"
                  >
                    <span className={`h-2 w-2 rounded-full ${toneDotClass(toneForCategory(category))}`} aria-hidden="true" />
                    <span className="sm:hidden">{shortCategoryLabel(label)}</span>
                    <span className="hidden sm:inline">{label}</span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-faint group-hover:text-accent">
                      <Plus className="h-3 w-3" />
                      {t("requestedAttachShort")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}
