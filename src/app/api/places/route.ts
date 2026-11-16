import { requireApprovedProfile } from "@/lib/auth/profile";
import { isValidLocation, type PlaceResult } from "@/lib/client-map";

// Place search for pinning a client on the map. Proxied through our server
// (rather than called from the browser) so the CSP stays tight, the search is
// limited to signed-in staff, and only the typed place name ever leaves the
// system — no client data. Photon (by Komoot) is a free OpenStreetMap search
// built for search-as-you-type; results are biased to Malaysia.
const PHOTON_URL = "https://photon.komoot.io/api/";
const MALAYSIA_BBOX = "99.4,0.7,119.4,7.5";

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
};

export async function GET(request: Request) {
  const profile = await requireApprovedProfile();
  if (!profile) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < 2 || query.length > 120) return Response.json({ results: [] });

  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("bbox", MALAYSIA_BBOX);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "NisafetyHub/1.0 (+https://nisafetyhub.com)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: "SEARCH_UNAVAILABLE" }, { status: 502 });
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
      const key = `${name}|${detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ name, detail, latitude: latitude as number, longitude: longitude as number });
      if (results.length === 6) break;
    }
    return Response.json({ results }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return Response.json({ error: "SEARCH_UNAVAILABLE" }, { status: 502 });
  }
}
