import { DOCUMENT_CATEGORIES } from "@/lib/format";

/** Same cap as the database check (clients_requested_services_check). */
export const MAX_REQUESTED_SERVICES = 30;

/** Keeps only known service categories, once each, in the standard order. */
export function cleanRequestedServices(values: unknown): string[] {
  const wanted = new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : []);
  return DOCUMENT_CATEGORIES.filter((category) => wanted.has(category)).slice(0, MAX_REQUESTED_SERVICES);
}

/** Requested services that don't have a report yet (a report for a service "completes" it). */
export function outstandingServices(requested: string[] | null | undefined, reportedCategories: Iterable<string | null>) {
  const done = new Set(reportedCategories);
  return (requested ?? []).filter((category) => !done.has(category));
}
