import { requireApprovedProfile } from "@/lib/auth/profile";
import { isValidLocation } from "@/lib/client-map";
import { coordinatesFromGoogleUrl, isGoogleMapsUrl, isShortMapsLink, parseCoordinates, unwrapConsent, type ParsedLocation } from "@/lib/coordinates";

/**
 * Turn what staff paste — coordinates copied from Google Maps, or a Google
 * Maps link (incl. maps.app.goo.gl share links) — into an exact location.
 * Free and as accurate as Google Maps itself, with no API key: the pin's
 * coordinates are already inside the link. Only Google Maps hosts are ever
 * fetched, one redirect at a time, so this can't be used to probe other sites.
 */
const MAX_REDIRECTS = 5;

export async function POST(request: Request) {
  const profile = await requireApprovedProfile();
  if (!profile) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { input?: unknown } | null;
  const input = typeof body?.input === "string" ? body.input.trim().slice(0, 2000) : "";
  if (!input) return Response.json({ error: "EMPTY" }, { status: 400 });

  const coords = parseCoordinates(input);
  if (coords) return finish({ ...coords, label: null });

  let url: URL;
  try {
    url = unwrapConsent(new URL(input.match(/https?:\/\/\S+/)?.[0] ?? input));
  } catch {
    return Response.json({ error: "UNRECOGNISED" }, { status: 422 });
  }
  if (!isGoogleMapsUrl(url)) return Response.json({ error: "UNRECOGNISED" }, { status: 422 });

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const found = coordinatesFromGoogleUrl(url);
    if (found) return finish(found);
    if (!isShortMapsLink(url)) break;

    let response: Response;
    try {
      response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "Mozilla/5.0 (NisafetyHub)" } });
    } catch {
      return Response.json({ error: "LINK_UNREACHABLE" }, { status: 502 });
    }
    const location = response.headers.get("location");
    if (!location) break;
    let next: URL;
    try {
      next = unwrapConsent(new URL(location, url));
    } catch {
      break;
    }
    if (!isGoogleMapsUrl(next)) break;
    url = next;
  }

  return Response.json({ error: "NO_COORDINATES" }, { status: 422 });
}

function finish(found: ParsedLocation) {
  if (!isValidLocation(found.latitude, found.longitude)) return Response.json({ error: "OUTSIDE_MALAYSIA" }, { status: 422 });
  return Response.json({ latitude: found.latitude, longitude: found.longitude, label: found.label });
}
