"use client";

import type { ReactNode } from "react";
import { Arrow, ChevronDown } from "@/app/_components/icons";
import { DIRECTORY_PAGE_SIZES, pageNumbers } from "@/lib/directory";

export type PaginationLabels = {
  nav: string;
  range: string;
  previous: string;
  next: string;
  page: (page: number) => string;
  show: string;
  perPage: string;
};

/** "1–20 of 57 · ← 1 2 3 → · Show [20] per page". Shared by the staff directory and the admin client list. */
export function PaginationBar({
  page,
  lastPage,
  pageSize,
  onPage,
  onPageSize,
  labels,
  disabled = false,
  children,
}: {
  page: number;
  lastPage: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  labels: PaginationLabels;
  disabled?: boolean;
  /** Extra content under the bar, e.g. a load error. */
  children?: ReactNode;
}) {
  return (
    <nav aria-label={labels.nav} className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3 sm:flex-row sm:flex-wrap sm:justify-between">
      <p className="text-xs text-ink-muted tabular-nums">{labels.range}</p>

      {lastPage > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page === 1 || disabled}
            aria-label={labels.previous}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-accent-soft hover:text-accent disabled:pointer-events-none disabled:opacity-30"
          >
            <Arrow className="h-3.5 w-3.5 rotate-180" />
          </button>
          {pageNumbers(page, lastPage).map((number, index) =>
            number === null ? (
              <span key={`gap-${index}`} className="w-6 text-center text-xs text-ink-faint">
                …
              </span>
            ) : (
              <button
                key={number}
                type="button"
                onClick={() => onPage(number)}
                disabled={disabled}
                aria-current={number === page ? "page" : undefined}
                aria-label={labels.page(number)}
                className={`h-8 min-w-8 rounded-full px-2 text-xs font-semibold tabular-nums transition ${
                  number === page ? "bg-accent text-white" : "text-ink-muted hover:bg-accent-soft hover:text-accent"
                }`}
              >
                {number}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page === lastPage || disabled}
            aria-label={labels.next}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-accent-soft hover:text-accent disabled:pointer-events-none disabled:opacity-30"
          >
            <Arrow className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-ink-muted">
        {labels.show}
        <span className="relative flex items-center">
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            className="appearance-none rounded-full border border-line bg-surface py-1.5 pl-3 pr-7 text-xs font-semibold text-ink transition hover:border-accent-soft focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft"
          >
            {DIRECTORY_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 h-3 w-3 text-ink-faint" />
        </span>
        <span className="sr-only sm:not-sr-only">{labels.perPage}</span>
      </label>
      {children}
    </nav>
  );
}
