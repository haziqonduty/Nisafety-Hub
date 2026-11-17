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
