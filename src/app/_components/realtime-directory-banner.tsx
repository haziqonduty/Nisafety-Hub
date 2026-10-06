"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Spark } from "@/app/_components/icons";

const TOAST_DURATION_MS = 4000;

export function RealtimeDirectoryBanner() {
  const t = useTranslations("directory");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("public:documents")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "documents" }, () => {
        setMessage(t("newRecordPublished"));
        router.refresh();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "documents" }, () => {
        setMessage(t("recordRemoved"));
        router.refresh();
      })
      // Silent (no toast) — a client-only submission (no document attached)
      // only ever inserts here, never into `documents`, so this is the only
      // signal that would surface it live. A normal submission inserts a
      // clients row *and* a documents row in the same request, so toasting
      // here too would double-toast every regular submission; the documents
      // listener above already covers that case.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "clients" }, () => {
        router.refresh();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "clients" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, t]);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [message]);

  if (!message) return null;

  return (
    <div className="fixed inset-x-0 top-6 z-40 flex justify-center px-6" role="status" aria-live="polite">
      <div className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-[0_16px_40px_rgba(16,42,51,.25)] animate-[rise_.35s_ease-out_both]">
        <Spark className="h-4 w-4 text-on-brand-accent" />
        {message}
      </div>
    </div>
  );
}
