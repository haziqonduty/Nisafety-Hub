import { requireApprovedProfile } from "@/lib/auth/profile";
import { isValidLocation, type PlaceResult } from "@/lib/client-map";
import { isRelevantPlace } from "@/lib/place-match";

// Place search for pinning a client on the map. Proxied through our server
// so the CSP stays tight, it's limited to signed-in staff, and only the typed
// text ever leaves the system — no client data.
//
// Two sources:
// - Google Places (the same business data as Google Maps) when the optional
//   GOOGLE_PLACES_API_KEY is set. Text Search Pro: 5,000 free calls a month;
//   cap the key's quota in Google Cloud and it can never be billed.
// - Otherwise Photon (komoot), a free OpenStreetMap search. OSM has few small
//   Malaysian companies and its search fuzzy-matches, so results that don't
//   contain every distinctive word typed are dropped — no look-alike pins.

const PHOTON_URL = "https://photon.komoot.io/api/";
const GOOGLE_URL = "https://places.googleapis.com/v1/places:searchText";
const MALAYSIA_BBOX = "99.4,0.7,119.4,7.5";
const MAX_RESULTS = 6;

type Provider = "google" | "osm";
type PhotonFeature = { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | undefined> };
type GooglePlace = { displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } };

// Small per-instance cache: typing the same name again doesn't re-query.
const cache = new Map<string, { at: number; provider: Provider; results: PlaceResult[] }>();
const CACHE_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const profile = await requireApprovedProfile();
  if (!profile) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  const provider: Provider = googleKey ? "google" : "osm";
  if (query.length < 2 || query.length > 120) return Response.json({ provider, results: [] });

  const key = `${provider}|${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json({ provider: hit.provider, results: hit.results });

  try {
    const results = googleKey ? await searchGoogle(query, googleKey) : await searchPhoton(query);
    cache.set(key, { at: Date.now(), provider, results });
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    return Response.json({ provider, results }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return Response.json({ error: "SEARCH_UNAVAILABLE", provider }, { status: 502 });
  }
}

async function searchGoogle(query: string, apiKey: string): Promise<PlaceResult[]> {
  const response = await fetch(GOOGLE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: query,
      regionCode: "MY",
      languageCode: "en",
      pageSize: MAX_RESULTS,
      locationRestriction: { rectangle: { low: { latitude: 0.7, longitude: 99.4 }, high: { latitude: 7.5, longitude: 119.4 } } },
    }),
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google Places ${response.status}`);
  const body = (await response.json()) as { places?: GooglePlace[] };
  return (body.places ?? [])
    .map((place) => ({
      name: place.displayName?.text ?? "",
      detail: place.formattedAddress ?? "",
      latitude: place.location?.latitude as number,
      longitude: place.location?.longitude as number,
    }))
    .filter((place) => place.name && isValidLocation(place.latitude, place.longitude))
    .slice(0, MAX_RESULTS);
}

async function searchPhoton(query: string): Promise<PlaceResult[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "20");
  url.searchParams.set("bbox", MALAYSIA_BBOX);
  const response = await fetch(url, {
    headers: { "User-Agent": "NisafetyHub/1.0 (+https://nisafetyhub.com)" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Photon ${response.status}`);
  const body = (await response.json()) as { features?: PhotonFeature[] };

  const results: PlaceResult[] = [];
  const seen = new Set<string>();
  for (const feature of body.features ?? []) {
    const [longitude, latitude] = feature.geometry?.coordinates ?? [];
    if (!isValidLocation(latitude, longitude)) continue;
    const p = feature.properties ?? {};
    const name = p.name || p.street || p.city || p.county || p.state;
    if (!name) continue;
    const detail = [p.street && p.street !== name ? p.street : null, p.district, p.city !== name ? p.city : null, p.postcode, p.state]
      .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index)
      .join(", ");
    if (!isRelevantPlace(query, name, detail)) continue;
    const key = `${name}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ name, detail, latitude: latitude as number, longitude: longitude as number });
    if (results.length === MAX_RESULTS) break;
  }
  return results;
}
