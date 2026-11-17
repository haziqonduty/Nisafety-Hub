// Reading an exact location from what staff paste: plain coordinates (as
// Google Maps copies them on right-click, e.g. "3.13900, 101.68685") or a
// Google Maps link. Pure functions — the network part (following a
// maps.app.goo.gl short link) lives in /api/places/resolve.

export type ParsedLocation = { latitude: number; longitude: number; label: string | null };

const NUMBER = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const PAIR = new RegExp(String.raw`^\s*\(?\s*${NUMBER}\s*°?\s*[NS]?\s*[,;\s]\s*${NUMBER}\s*°?\s*[EW]?\s*\)?\s*$`, "i");

/** "3.139, 101.6869" (also with spaces, brackets or a degree sign). */
export function parseCoordinates(text: string): { latitude: number; longitude: number } | null {
  const match = PAIR.exec(text);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/**
 * Hosts we accept links from — and the only ones the server will ever fetch:
 * Google's short links, and Google on any country domain (google.com,
 * google.com.my, google.com.sg, google.de, google.co.uk …).
 */
const GOOGLE_HOST = /^(?:(?:www|maps|consent)\.)?google\.(?:com|co)(?:\.[a-z]{2})?$|^(?:(?:www|maps|consent)\.)?google\.[a-z]{2}$/;

export function isGoogleMapsUrl(url: URL) {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return host === "maps.app.goo.gl" || host === "goo.gl" || GOOGLE_HOST.test(host);
}

export function isShortMapsLink(url: URL) {
  const host = url.hostname.toLowerCase();
  return host === "maps.app.goo.gl" || (host === "goo.gl" && url.pathname.startsWith("/maps"));
}

function placeName(url: URL) {
  const match = /\/maps\/place\/([^/@?]+)/.exec(url.pathname);
  if (!match) return null;
  try {
    const name = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
    return name && !parseCoordinates(name) ? name.slice(0, 200) : null;
  } catch {
    return null;
  }
}

function directionsName(url: URL) {
  const match = /\/maps\/dir\/[^/]*\/([^/@?]+)/.exec(url.pathname);
  if (!match) return null;
  try {
    const name = decodeURIComponent(match[1].replace(/\+/g, " ")).split(",")[0].trim();
    return name && !parseCoordinates(name) ? name.slice(0, 200) : null;
  } catch {
    return null;
  }
}

/**
 * Coordinates in a full Google Maps URL. The pin itself (`!3d<lat>!4d<lng>`)
 * wins over the camera centre (`@<lat>,<lng>`), which is only where the
 * screen was looking.
 */
export function coordinatesFromGoogleUrl(url: URL): ParsedLocation | null {
  const label = placeName(url);
  const full = decodeURIComponent(url.href);

  const pins = [...full.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
  if (pins.length > 0) {
    const last = pins[pins.length - 1];
    return { latitude: Number(last[1]), longitude: Number(last[2]), label };
  }

  // Directions links carry the destination as a lng/lat pair: !2m2!1d<lng>!2d<lat>.
  const stops = [...full.matchAll(/!2m2!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/g)];
  if (stops.length > 0) {
    const last = stops[stops.length - 1];
    return { latitude: Number(last[2]), longitude: Number(last[1]), label: label ?? directionsName(url) };
  }

  for (const key of ["q", "query", "ll", "destination", "center", "daddr"]) {
    const value = url.searchParams.get(key);
    const coords = value ? parseCoordinates(value) : null;
    if (coords) return { ...coords, label };
  }

  const placeSegment = /\/maps\/(?:place|search)\/([^/@?]+)/.exec(url.pathname);
  if (placeSegment) {
    const coords = parseCoordinates(decodeURIComponent(placeSegment[1].replace(/\+/g, " ")));
    if (coords) return { ...coords, label: null };
  }

  const camera = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url.pathname);
  if (camera) return { latitude: Number(camera[1]), longitude: Number(camera[2]), label };

  return null;
}

/** Google's cookie-consent interstitial wraps the real URL in ?continue=. */
export function unwrapConsent(url: URL): URL {
  if (url.hostname.toLowerCase() !== "consent.google.com") return url;
  const next = url.searchParams.get("continue");
  try {
    return next ? new URL(next) : url;
  } catch {
    return url;
  }
}
