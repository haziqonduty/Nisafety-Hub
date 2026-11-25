// Shared, framework-free pieces of the live client map (safe to import from
// both server and "use client" modules).

import type { ExpiryStatus } from "@/lib/validity";

/** A client's overall status on the map: its most urgent tracked report. */
export type MapStatus = "expired" | "expiring" | "upcoming" | "valid" | "none";

export const MAP_STATUSES: MapStatus[] = ["expired", "expiring", "upcoming", "valid", "none"];

const URGENCY: Record<MapStatus, number> = { expired: 0, expiring: 1, upcoming: 2, valid: 3, none: 4 };

export function moreUrgent(a: MapStatus, b: MapStatus): MapStatus {
  return URGENCY[a] <= URGENCY[b] ? a : b;
}

export function compareUrgency(a: MapStatus, b: MapStatus) {
  return URGENCY[a] - URGENCY[b];
}

export function toMapStatus(status: ExpiryStatus): MapStatus {
  return status === "renewed" || status === "closed" ? "none" : status;
}

/** Marker colours (hex — the map draws with WebGL, not CSS classes). */
export const MAP_STATUS_COLORS: Record<MapStatus, string> = {
  expired: "#f43f5e",
  expiring: "#f59e0b",
  upcoming: "#facc15",
  valid: "#2dd4bf",
  none: "#94a3b8",
};

/** Same box the database enforces (clients_location_pair_check). */
export const LOCATION_BOUNDS = { minLat: -1, maxLat: 9, minLng: 98, maxLng: 121 } as const;

/** Peninsular + East Malaysia, for the default camera. [[west, south], [east, north]] */
export const MALAYSIA_VIEW: [[number, number], [number, number]] = [
  [99.4, 0.7],
  [119.4, 7.5],
];

export function isValidLocation(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= LOCATION_BOUNDS.minLat &&
    lat <= LOCATION_BOUNDS.maxLat &&
    lng >= LOCATION_BOUNDS.minLng &&
    lng <= LOCATION_BOUNDS.maxLng
  );
}

export type MapService = {
  documentId: string;
  category: string;
  serviceDate: string;
  expiryDate: string | null;
  status: MapStatus;
  daysLeft: number | null;
};

export type MapClient = {
  id: string;
  company: string;
  clientName: string;
  telephone: string;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  status: MapStatus;
  /** Soonest expiry among the client's tracked services (latest report per category). */
  nextExpiry: string | null;
  nextExpiryDays: number | null;
  reportCount: number;
  /** Latest report per service category, most urgent first. */
  services: MapService[];
  /** Most recent report, for the "Open" link. */
  latestDocumentId: string | null;
};

export type PlaceResult = {
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
};
