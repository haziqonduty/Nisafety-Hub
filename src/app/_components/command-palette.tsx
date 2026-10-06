"use client";

import { Command } from "cmdk";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search, ShieldCheck, Upload } from "@/app/_components/icons";
import { useRouter } from "@/i18n/routing";

type DocumentResult = {
  id: string;
  title: string;
  company: string;
  category: string | null;
  fileType: string | null;
};

export function CommandPalette() {
  const t = useTranslations("commandPalette");
  const tDirectory = useTranslations("directory");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocumentResult[]>([]);
  const router = useRouter();

  const navItems = [
    { label: t("goToDirectory"), href: "/" as const, icon: ShieldCheck, external: false },
    { label: t("submitRecord"), href: "/submit" as const, icon: Upload, external: false },
    { label: t("adminSignIn"), href: "/admin/login", icon: ArrowUpRight, external: true },
  ];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/documents/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = (await response.json()) as { results: DocumentResult[] };
        setResults(data.results);
      } catch {
        // ignore aborted/failed requests
      }
    }, 150);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  function goLocalized(href: "/" | "/submit") {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function goExternal(href: string) {
    setOpen(false);
    setQuery("");
    // Full page navigation, deliberately outside next-intl's router: /admin
    // isn't part of the localized route tree, so it must not get a locale
    // prefix. Not a state mutation despite what the lint rule assumes.
    // eslint-disable-next-line react-hooks/immutability
    window.location.href = href;
  }

  function goToRecord(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`/records/${id}`);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t("label")}
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-24 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_70px_rgba(16,42,51,.25)]"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 focus-within:bg-accent-soft/30">
        <Search className="h-4 w-4 text-accent" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          autoFocus
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
        />
        <kbd className="rounded border border-line bg-surface-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">ESC</kbd>
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Group
          heading={t("navigate")}
          className="[&_[cmdk-group-heading]]:block [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-ink-faint"
        >
          {navItems.map((item) => (
            <Command.Item
              key={item.href}
              value={item.label}
              onSelect={() => (item.external ? goExternal(item.href) : goLocalized(item.href as "/" | "/submit"))}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm normal-case tracking-normal font-medium text-ink data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Command.Item>
          ))}
        </Command.Group>

        {results.length > 0 && (
          <Command.Group
            heading={t("documents")}
            className="mt-2 [&_[cmdk-group-heading]]:block [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-ink-faint"
          >
            {results.map((document) => (
              <Command.Item
                key={document.id}
                value={document.id}
                onSelect={() => goToRecord(document.id)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm normal-case tracking-normal data-[selected=true]:bg-accent-soft"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{document.title}</span>
                  <span className="block truncate text-xs text-ink-muted">{document.company} · {document.category ?? tDirectory("clientOnlyBadge")}</span>
                </span>
                {document.fileType && <span className="shrink-0 font-mono text-[10px] font-bold text-accent">{document.fileType}</span>}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {query && results.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink-muted">{t("noMatch", { query })}</p>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
