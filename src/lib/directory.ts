// Directory sort + status filter options. A plain module (not "use client")
// so both server code and client components can import the constants.

export const DIRECTORY_SORTS = ["recent", "name", "expiry", "newest"] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number];

/** Client status = the worst status across its latest report per service (see public.directory_page). */
export const DIRECTORY_STATUSES = ["expired", "expiring", "upcoming", "valid", "no_report"] as const;
export type DirectoryStatus = (typeof DIRECTORY_STATUSES)[number];

/** Every status the database can return, including "none" (reports, but none expire). */
export type DirectoryStatusCounts = Partial<Record<DirectoryStatus | "none", number>>;

export function parseDirectorySort(value: string | null | undefined): DirectorySort {
  return (DIRECTORY_SORTS as readonly string[]).includes(value ?? "") ? (value as DirectorySort) : "recent";
}

export function parseDirectoryStatus(value: string | null | undefined): DirectoryStatus | null {
  return (DIRECTORY_STATUSES as readonly string[]).includes(value ?? "") ? (value as DirectoryStatus) : null;
}

/** How many clients one directory page shows; staff pick from these. */
export const DIRECTORY_PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_DIRECTORY_PAGE_SIZE = 20;

export function parseDirectoryPageSize(value: string | number | null | undefined): number {
  const size = Number(value);
  return (DIRECTORY_PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_DIRECTORY_PAGE_SIZE;
}

/** Page numbers to show, with null for a gap: 1 … 4 5 6 … 12. */
export function pageNumbers(current: number, last: number): (number | null)[] {
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1);
  const pages = new Set([1, last, current - 1, current, current + 1].filter((page) => page >= 1 && page <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  for (const page of sorted) {
    if (result.length && page - (result[result.length - 1] as number) > 1) result.push(null);
    result.push(page);
  }
  return result;
}
