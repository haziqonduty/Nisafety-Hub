"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CompanyMonogram, CompanyStatusBadge, ServiceCode } from "@/app/_components/admin-company-ui";
import { Arrow, Search, Users } from "@/app/_components/icons";
import { PaginationBar } from "@/app/_components/pagination-bar";
import type { AdminCompany, CompanyStatus } from "@/lib/admin-companies";
import { DEFAULT_DIRECTORY_PAGE_SIZE, parseDirectoryPageSize } from "@/lib/directory";
import { formatServiceDate } from "@/lib/format";

const PAGE_SIZE_KEY = "nisafety.admin.clients.pageSize";
const MAX_CODES = 4;

const FILTERS: { value: "all" | CompanyStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expired", label: "Expired" },
  { value: "expiring", label: "Expiring soon" },
  { value: "valid", label: "All valid" },
  { value: "no_report", label: "No report yet" },
];

export function AdminCompaniesTable({ companies }: { companies: AdminCompany[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | CompanyStatus>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_DIRECTORY_PAGE_SIZE);
  const listRef = useRef<HTMLDivElement>(null);

  // Each computer remembers the page size the admin last picked.
  useEffect(() => {
    try {
      const saved = parseDirectoryPageSize(window.localStorage.getItem(PAGE_SIZE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a saved preference after hydration
      if (saved !== DEFAULT_DIRECTORY_PAGE_SIZE) setPageSize(saved);
    } catch {
      // Storage blocked - keep the default.
    }
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: companies.length };
    for (const company of companies) result[company.status] = (result[company.status] ?? 0) + 1;
    return result;
  }, [companies]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return companies.filter((company) => {
      if (filter !== "all" && company.status !== filter) return false;
      if (!needle) return true;
      const text = [
        company.name,
        ...company.clients.flatMap((client) => [client.clientName, client.telephone, client.email, ...client.additionalClientNames, ...client.additionalTelephones, ...client.additionalEmails]),
        ...company.reports.map((report) => `${report.category} ${report.fileName}`),
        ...company.outstanding,
      ].join(" ");
      return text.toLowerCase().includes(needle);
    });
  }, [companies, query, filter]);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, lastPage);
  const pageCompanies = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstShown = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastShown = Math.min(currentPage * pageSize, total);

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
    try {
      window.localStorage.setItem(PAGE_SIZE_KEY, String(size));
    } catch {
      // Not saved - still applies for this visit.
    }
  }

  function goToPage(next: number) {
    setPage(next);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex flex-1 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-shadow focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
          <Search className="h-4 w-4 text-accent" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
            placeholder="Search company, contact, phone, email or service"
            aria-label="Search companies"
          />
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:pb-0" role="group" aria-label="Filter by status">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => {
                setFilter(option.value);
                setPage(1);
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                filter === option.value ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-muted hover:border-accent hover:text-accent"
              }`}
            >
              {option.label}
              <span className={`tabular-nums ${filter === option.value ? "text-white/70" : "text-ink-faint"}`}>{counts[option.value] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {companies.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">No client records have been submitted yet.</div>
      ) : total === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">No companies match that search.</div>
      ) : (
        <>
          <div ref={listRef} className="mt-4 scroll-mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_14px_40px_rgba(16,42,51,.05)]">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_8.5rem_9rem_1.5rem] gap-6 border-b border-line bg-surface-soft/60 px-5 py-3 font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted md:grid">
              <span>COMPANY</span>
              <span>SERVICES</span>
              <span>STATUS</span>
              <span className="text-right">REPORTS</span>
              <span />
            </div>
            <ul className="divide-y divide-line">
              {pageCompanies.map((company) => {
                const contacts = [...new Set(company.clients.map((client) => client.clientName.trim()))];
                const contactLine =
                  contacts.length > 1
                    ? `${contacts.length} contacts · ${contacts.join(", ")}`
                    : company.clients.length > 1
                      ? `${contacts[0]} · ${company.clients.length} records`
                      : contacts[0];
                const codes = company.services.slice(0, MAX_CODES);
                return (
                  <li key={company.key}>
                    <Link
                      href={`/admin/companies/${company.key}`}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-surface-soft/70 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_8.5rem_9rem_1.5rem] md:gap-6"
                    >
                      <span className="flex min-w-0 items-center gap-3.5">
                        <CompanyMonogram name={company.name} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold tracking-[-0.01em] group-hover:text-accent">{company.name}</span>
                          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
                            <Users className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                            <span className="truncate">{contactLine}</span>
                          </span>
                        </span>
                      </span>

                      <span className="col-span-2 flex min-w-0 flex-wrap items-center gap-1 md:col-span-1">
                        {codes.map((category) => (
                          <ServiceCode key={category} category={category} />
                        ))}
                        {company.services.length > MAX_CODES && <span className="text-[11px] font-semibold text-ink-muted">+{company.services.length - MAX_CODES}</span>}
                        {company.outstanding.slice(0, 2).map((category) => (
                          <ServiceCode key={category} category={category} muted />
                        ))}
                        {company.services.length === 0 && company.outstanding.length === 0 && <span className="text-xs text-ink-faint">—</span>}
                      </span>

                      <span className="row-start-1 col-start-2 md:col-start-auto md:row-start-auto">
                        <CompanyStatusBadge status={company.status} />
                      </span>

                      <span className="hidden text-right text-xs tabular-nums text-ink-muted md:block">
                        <span className="block text-sm font-semibold text-ink">{company.reports.length}</span>
                        {company.nextExpiry ? `${company.status === "expired" ? "expired" : "next"} ${formatServiceDate(company.nextExpiry)}` : "no expiry"}
                      </span>

                      <Arrow className="hidden h-4 w-4 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent md:block" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <PaginationBar
            page={currentPage}
            lastPage={lastPage}
            pageSize={pageSize}
            onPage={goToPage}
            onPageSize={changePageSize}
            labels={{
              nav: "Company pages",
              range: `${firstShown}–${lastShown} of ${total} ${total === 1 ? "company" : "companies"}`,
              previous: "Previous page",
              next: "Next page",
              page: (number) => `Page ${number}`,
              show: "Show",
              perPage: "per page",
            }}
          />
        </>
      )}
    </>
  );
}
