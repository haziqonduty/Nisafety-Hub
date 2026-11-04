"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Pencil } from "@/app/_components/icons";
import { RecordEditForm } from "@/app/_components/record-edit-form";
import type { RecordDetail } from "@/lib/supabase/queries";

export function RecordDetailBody({ record }: { record: RecordDetail }) {
  const t = useTranslations("record");
  const tEdit = useTranslations("record.edit");
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return <RecordEditForm record={record} onDone={() => setIsEditing(false)} />;
  }

  return (
    <div className="mt-10 border-t border-line pt-8">
      <div className="flex items-center justify-between gap-4">
        <div className="grid flex-1 gap-5 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("clientName")}</p>
            <p className="mt-1 text-sm font-semibold">{record.clientName}</p>
            {record.additionalClientNames.length > 0 && <p className="mt-0.5 text-xs text-ink-muted">{t("alsoLabel")} {record.additionalClientNames.join(", ")}</p>}
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("company")}</p>
            <p className="mt-1 text-sm font-semibold">{record.companyName}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("telephone")}</p>
            <p className="mt-1 text-sm font-semibold">{record.telephone}</p>
            {record.additionalTelephones.length > 0 && <p className="mt-0.5 text-xs text-ink-muted">{t("alsoLabel")} {record.additionalTelephones.join(", ")}</p>}
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("email")}</p>
            <p className="mt-1 text-sm font-semibold">{record.email}</p>
            {record.additionalEmails.length > 0 && <p className="mt-0.5 text-xs text-ink-muted">{t("alsoLabel")} {record.additionalEmails.join(", ")}</p>}
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("submittedBy")}</p>
            <p className="mt-1 text-sm font-semibold">{record.submitterName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink transition hover:border-accent hover:bg-accent-soft hover:text-accent print:hidden"
        >
          <Pencil className="h-3.5 w-3.5" /> {tEdit("editButton")}
        </button>
      </div>
    </div>
  );
}
