"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Marker as MapLibreMarker } from "maplibre-gl";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/app/_components/confirm-dialog";
import { ArrowUpRight, Close, Crosshair, Globe, MapPin, Maximize, Minimize, Minus, Navigation, Pencil, Phone, Plus, Search, Trash } from "@/app/_components/icons";
import { Link } from "@/i18n/routing";
import { MALAYSIA_VIEW, MAP_STATUS_COLORS, MAP_STATUSES, compareUrgency, type MapClient, type MapStatus, type PlaceResult } from "@/lib/client-map";
import { categoryMessageKey, formatServiceDate, shortCategoryLabel } from "@/lib/format";
import { looksLikeLocationInput, searchableCompanyName } from "@/lib/place-match";

type MapLib = typeof import("maplibre-gl");
type Draft = { latitude: number; longitude: number; label: string | null };
type Placing = { clientId: string; mode: "place" | "move" };
type PlaceState = "idle" | "searching" | "done" | "error";
type Provider = "google" | "osm";
type Tab = "onMap" | "toPlace";

// The map is always the dark "command centre" look, whatever the site theme:
// pins and the Malaysia spotlight read best on dark, and it's the module's
// signature. Free OpenFreeMap vector tiles — no key, fine for business use.
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const MALAYSIA_GEOJSON = "/geo/malaysia.geojson";

const URGENCY_INDEX: Record<MapStatus, number> = { expired: 0, expiring: 1, upcoming: 2, valid: 3, none: 4 };
const URGENCY_COLOR = [
  "match",
  ["get", "urgency"],
  0,
  MAP_STATUS_COLORS.expired,
  1,
  MAP_STATUS_COLORS.expiring,
  2,
  MAP_STATUS_COLORS.upcoming,
  3,
  MAP_STATUS_COLORS.valid,
  MAP_STATUS_COLORS.none,
] as const;

const INK = { surface: "#08171b", text: "#e6f6f3", halo: "#030a0c", background: "#050e11", water: "#081d24", land: "#0b181c" };

// Label points for the 13 states and 3 federal territories.
const STATES: [string, number, number][] = [
  ["Perlis", 100.2, 6.5],
  ["Kedah", 100.65, 5.95],
  ["Pulau Pinang", 100.3, 5.33],
  ["Perak", 101.05, 4.75],
  ["Kelantan", 102.05, 5.3],
  ["Terengganu", 102.95, 4.95],
  ["Pahang", 102.55, 3.75],
  ["Selangor", 101.35, 3.35],
  ["Kuala Lumpur", 101.69, 3.14],
  ["Putrajaya", 101.69, 2.93],
  ["Negeri Sembilan", 102.15, 2.75],
  ["Melaka", 102.3, 2.27],
  ["Johor", 103.45, 1.95],
  ["Sabah", 117.0, 5.35],
  ["Sarawak", 113.0, 2.5],
  ["Labuan", 115.22, 5.3],
];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isWide() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

function cameraPadding() {
  return isWide() ? { top: 90, bottom: 80, left: 430, right: 90 } : { top: 70, bottom: 70, left: 36, right: 36 };
}

function hasLocation(client: MapClient): client is MapClient & { latitude: number; longitude: number } {
  return client.latitude !== null && client.longitude !== null;
}

/**
 * Centre + zoom that fits a lat/lng box in the visible part of the map.
 * Done by hand (Web Mercator maths) because MapLibre's cameraForBounds gives
 * odd results on the globe projection when starting from street level.
 */
function frameBox(
  box: { west: number; south: number; east: number; north: number },
  container: HTMLElement,
  padding: { top: number; bottom: number; left: number; right: number },
) {
  const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const width = Math.max(container.clientWidth - padding.left - padding.right, 120);
  const height = Math.max(container.clientHeight - padding.top - padding.bottom, 120);
  const lngSpan = Math.max(box.east - box.west, 0.05);
  const ySpan = Math.max(mercatorY(box.north) - mercatorY(box.south), 0.001);
  const zoomX = Math.log2((width * 360) / (lngSpan * 512));
  const zoomY = Math.log2((height * 2 * Math.PI) / (ySpan * 512));
  const zoom = Math.max(3, Math.min(9, Math.min(zoomX, zoomY) - 0.15));
  const center: [number, number] = [(box.west + box.east) / 2, (box.south + box.north) / 2];
  return { center, zoom };
}

type Polygon = number[][][];
type MalaysiaFeature = { type: "Feature"; geometry: { type: "MultiPolygon"; coordinates: Polygon[] }; properties: Record<string, unknown> };

/** Everything except Malaysia, so the rest of the region can be dimmed. */
function maskAround(malaysia: MalaysiaFeature) {
  const world = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [world, ...malaysia.geometry.coordinates.map((polygon) => polygon[0])] },
  };
}

function setPaint(map: MapLibreMap, layer: string, property: Parameters<MapLibreMap["setPaintProperty"]>[1], value: string) {
  if (!map.getLayer(layer)) return;
  try {
    map.setPaintProperty(layer, property, value);
  } catch {
    // Cosmetic tuning only — a basemap update can rename layers.
  }
}

/** Recolour the stock dark basemap into the brand palette and quiet it down. */
function tuneBasemap(map: MapLibreMap) {
  setPaint(map, "background", "background-color", INK.background);
  setPaint(map, "water", "fill-color", INK.water);
  for (const layer of map.getStyle().layers ?? []) {
    if (/^place_(state|country)/.test(layer.id)) {
      map.setLayoutProperty(layer.id, "visibility", "none");
      continue;
    }
    if (layer.type === "line" && /highway|road|railway|aeroway|bridge|tunnel/.test(layer.id)) {
      setPaint(map, layer.id, "line-color", /casing/.test(layer.id) ? "#0a1b1f" : "#173339");
    }
    if (layer.type === "symbol" && /^place_/.test(layer.id)) {
      setPaint(map, layer.id, "text-color", "#7f9da1");
      setPaint(map, layer.id, "text-halo-color", INK.halo);
    }
  }
}

function addSpotlight(map: MapLibreMap, malaysia: MalaysiaFeature | null) {
  if (!malaysia) return;
  if (!map.getSource("malaysia")) map.addSource("malaysia", { type: "geojson", data: malaysia });
  if (!map.getSource("malaysia-mask")) map.addSource("malaysia-mask", { type: "geojson", data: maskAround(malaysia) });
  if (!map.getSource("states")) {
    map.addSource("states", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: STATES.map(([name, lng, lat]) => ({ type: "Feature", properties: { name: name.toUpperCase() }, geometry: { type: "Point", coordinates: [lng, lat] } })),
      },
    });
  }
  const layers = [
    {
      id: "malaysia-land",
      type: "fill",
      source: "malaysia",
      paint: { "fill-color": "#0f2a2c", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.0, 5, 0.55, 9, 0.18, 11, 0] },
    },
    {
      id: "malaysia-mask",
      type: "fill",
      source: "malaysia-mask",
      paint: { "fill-color": "#010507", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 2.5, 0, 4.5, 0.62, 9, 0.55, 12, 0.25] },
    },
    {
      id: "malaysia-glow",
      type: "line",
      source: "malaysia",
      paint: {
        "line-color": "#2dd4bf",
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 3, 8, 12],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 3, 3, 8, 10],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.15, 6, 0.28, 11, 0.08],
      },
    },
    {
      id: "malaysia-outline",
      type: "line",
      source: "malaysia",
      paint: { "line-color": "#5eead4", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 1.4], "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 11, 0.25] },
    },
    {
      id: "state-labels",
      type: "symbol",
      source: "states",
      minzoom: 4.6,
      maxzoom: 9.5,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 9, 8, 12],
        "text-letter-spacing": 0.28,
        "text-max-width": 8,
        "text-allow-overlap": false,
      },
      paint: { "text-color": "rgba(153, 246, 228, 0.5)", "text-halo-color": INK.halo, "text-halo-width": 1.2 },
    },
  ];
  for (const layer of layers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapLibre's layer spec types don't narrow from literals.
    if (!map.getLayer(layer.id)) map.addLayer(layer as any);
  }
}

function addClientLayers(map: MapLibreMap) {
  if (!map.getSource("clients")) {
    map.addSource("clients", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterRadius: 46,
      clusterMaxZoom: 11,
      clusterProperties: { urgency: ["min", ["get", "urgency"]] },
    });
  }
  const isCluster = ["has", "point_count"];
  const isPoint = ["!", ["has", "point_count"]];
  const layers = [
    {
      id: "cluster-glow",
      type: "circle",
      source: "clients",
      filter: isCluster,
      paint: { "circle-color": URGENCY_COLOR, "circle-radius": ["step", ["get", "point_count"], 30, 10, 36, 50, 44], "circle-opacity": 0.25, "circle-blur": 0.6 },
    },
    {
      id: "clusters",
      type: "circle",
      source: "clients",
      filter: isCluster,
      paint: {
        "circle-color": INK.surface,
        "circle-radius": ["step", ["get", "point_count"], 17, 10, 21, 50, 27],
        "circle-stroke-width": 2,
        "circle-stroke-color": URGENCY_COLOR,
      },
    },
    {
      id: "cluster-count",
      type: "symbol",
      source: "clients",
      filter: isCluster,
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 13, "text-allow-overlap": true },
      paint: { "text-color": INK.text },
    },
    {
      id: "client-glow",
      type: "circle",
      source: "clients",
      filter: isPoint,
      paint: { "circle-color": ["get", "color"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 14, 12, 24], "circle-opacity": 0.4, "circle-blur": 0.85 },
    },
    {
      id: "client-pulse",
      type: "circle",
      source: "clients",
      filter: ["all", isPoint, ["<=", ["get", "urgency"], 1]],
      paint: { "circle-color": ["get", "color"], "circle-radius": 8, "circle-opacity": 0 },
    },
    {
      id: "client-points",
      type: "circle",
      source: "clients",
      filter: isPoint,
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 5.5, 12, 8.5],
        "circle-stroke-width": 2.5,
        "circle-stroke-color": INK.surface,
      },
    },
    {
      id: "client-selected",
      type: "circle",
      source: "clients",
      filter: ["==", ["get", "id"], ""],
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 12, 12, 16],
        "circle-stroke-width": 2.5,
        "circle-stroke-color": ["get", "color"],
      },
    },
    {
      id: "client-labels",
      type: "symbol",
      source: "clients",
      filter: isPoint,
      minzoom: 7.5,
      layout: {
        "text-field": ["get", "company"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-offset": [0, 1.5],
        "text-anchor": "top",
        "text-max-width": 12,
        "text-optional": true,
      },
      paint: { "text-color": INK.text, "text-halo-color": INK.halo, "text-halo-width": 1.6 },
    },
  ];
  for (const layer of layers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above.
    if (!map.getLayer(layer.id)) map.addLayer(layer as any);
  }
}

const RESOLVE_ERRORS = ["UNRECOGNISED", "NO_COORDINATES", "OUTSIDE_MALAYSIA", "LINK_UNREACHABLE"] as const;

export function ClientMap({ initialClients }: { initialClients: MapClient[] }) {
  const t = useTranslations("map");
  const tCategories = useTranslations("categories.items");
  const locale = useLocale();
  const dateLocale = locale === "ms" ? "ms-MY" : "en-GB";

  const [clients, setClients] = useState(initialClients);
  const [filters, setFilters] = useState<Set<MapStatus>>(() => new Set(MAP_STATUSES));
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>(() => (initialClients.some(hasLocation) ? "onMap" : "toPlace"));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ company: string; status: MapStatus; x: number; y: number } | null>(null);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error">("loading");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [placing, setPlacing] = useState<Placing | null>(null);
  const [provider, setProvider] = useState<Provider>("osm");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeState, setPlaceState] = useState<PlaceState>("idle");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const frameRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<MapLib | null>(null);
  const draftMarkerRef = useRef<MapLibreMarker | null>(null);
  const placingRef = useRef<Placing | null>(null);
  const syncRef = useRef<() => void>(() => {});
  const introDoneRef = useRef(false);
  const clientsRef = useRef(clients);

  const mapped = useMemo(() => clients.filter(hasLocation), [clients]);
  const unmapped = useMemo(() => clients.filter((client) => !hasLocation(client)), [clients]);
  const counts = useMemo(() => {
    const result: Record<MapStatus, number> = { expired: 0, expiring: 0, upcoming: 0, valid: 0, none: 0 };
    for (const client of clients) result[client.status] += 1;
    return result;
  }, [clients]);
  const visible = useMemo(() => mapped.filter((client) => filters.has(client.status)), [mapped, filters]);

  const needle = query.trim().toLowerCase();
  const matches = (client: MapClient) =>
    !needle || client.company.toLowerCase().includes(needle) || client.clientName.toLowerCase().includes(needle) || (client.locationLabel ?? "").toLowerCase().includes(needle);
  const listed = visible.filter(matches).sort((a, b) => compareUrgency(a.status, b.status) || a.company.localeCompare(b.company));
  const unmappedListed = unmapped.filter(matches);
  const attention = counts.expired + counts.expiring;

  const selected = clients.find((client) => client.id === selectedId) ?? null;
  const placingClient = placing ? (clients.find((client) => client.id === placing.clientId) ?? null) : null;

  useEffect(() => {
    placingRef.current = placing;
  }, [placing]);
  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  const statusLabel = (status: MapStatus) => t(`status.${status}`);

  function categoryLabel(category: string) {
    try {
      return shortCategoryLabel(tCategories(categoryMessageKey(category)));
    } catch {
      return shortCategoryLabel(category);
    }
  }

  function relativeExpiry(days: number | null) {
    if (days === null) return t("noExpiry");
    if (days < 0) return t("expiredAgo", { days: -days });
    if (days === 0) return t("expiresToday");
    return t("expiresIn", { days });
  }

  // ----- Camera ---------------------------------------------------------------

  const fitToClients = useCallback((duration: number) => {
    const map = mapRef.current;
    if (!map) return;
    const points = clientsRef.current.filter(hasLocation);
    const box =
      points.length === 0
        ? { west: MALAYSIA_VIEW[0][0], south: MALAYSIA_VIEW[0][1], east: MALAYSIA_VIEW[1][0], north: MALAYSIA_VIEW[1][1] }
        : {
            west: Math.min(...points.map((p) => p.longitude)),
            east: Math.max(...points.map((p) => p.longitude)),
            south: Math.min(...points.map((p) => p.latitude)),
            north: Math.max(...points.map((p) => p.latitude)),
          };
    const { center, zoom } = frameBox(box, map.getContainer(), cameraPadding());
    map.flyTo({ center, zoom: points.length === 1 ? Math.min(zoom, 7.5) : zoom, padding: cameraPadding(), duration, essential: true });
  }, []);

  const flyTo = useCallback((longitude: number, latitude: number, zoom: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), zoom), padding: cameraPadding(), duration: prefersReducedMotion() ? 0 : 1600, essential: true });
  }, []);

  // ----- Map setup (once) ---------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let map: MapLibreMap | null = null;
    const failTimer = window.setTimeout(() => {
      if (!cancelled && !map?.loaded()) setMapState((state) => (state === "loading" ? "error" : state));
    }, 20000);

    (async () => {
      let lib: MapLib;
      let malaysia: MalaysiaFeature | null = null;
      try {
        const [loaded, outline] = await Promise.all([
          import("maplibre-gl"),
          fetch(MALAYSIA_GEOJSON)
            .then((response) => (response.ok ? (response.json() as Promise<MalaysiaFeature>) : null))
            .catch(() => null),
        ]);
        lib = loaded;
        malaysia = outline;
      } catch {
        if (!cancelled) setMapState("error");
        return;
      }
      if (cancelled || !containerRef.current) return;
      libRef.current = lib;
      lib.setWorkerUrl(`/vendor/maplibre-gl-worker-${lib.getVersion()}.js`);

      map = new lib.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [109.5, 4.2],
        zoom: prefersReducedMotion() ? 5 : 1.3,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new lib.AttributionControl({ compact: true }), "bottom-right");
      // The basemap references a few POI icons its sprite doesn't ship.
      map.on("styleimagemissing", (event) => {
        if (!map?.hasImage(event.id)) map?.addImage(event.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });

      const currentMap = map;
      // Urgent pins breathe. Started only after "load": repainting a layer
      // every frame keeps the style dirty, so "load" would never fire.
      const startPulse = () => {
        if (prefersReducedMotion()) return;
        const animate = (now: number) => {
          if (cancelled) return;
          if (currentMap.getLayer("client-pulse")) {
            const progress = (now % 2200) / 2200;
            currentMap.setPaintProperty("client-pulse", "circle-radius", 8 + progress * 26);
            currentMap.setPaintProperty("client-pulse", "circle-opacity", 0.5 * (1 - progress));
          }
          frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
      };

      currentMap.on("style.load", () => {
        try {
          currentMap.setProjection({ type: "globe" });
        } catch {
          // Flat Mercator is fine.
        }
        try {
          currentMap.setSky({ "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] });
        } catch {
          // Atmosphere glow is optional.
        }
        tuneBasemap(currentMap);
        addSpotlight(currentMap, malaysia);
        addClientLayers(currentMap);
        syncRef.current();
      });

      currentMap.on("load", () => {
        if (cancelled) return;
        setMapState("ready");
        startPulse();
        containerRef.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        if (!introDoneRef.current) {
          introDoneRef.current = true;
          fitToClients(prefersReducedMotion() ? 0 : 3400);
        }
      });

      currentMap.on("click", "clusters", async (event: MapLayerMouseEvent) => {
        if (placingRef.current) return;
        const feature = event.features?.[0];
        const clusterId = feature?.properties?.cluster_id as number | undefined;
        const source = currentMap.getSource("clients") as GeoJSONSource | undefined;
        if (clusterId === undefined || !source || feature?.geometry.type !== "Point") return;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        currentMap.easeTo({ center: feature.geometry.coordinates as [number, number], zoom: zoom + 0.4, duration: 700 });
      });

      currentMap.on("click", "client-points", (event: MapLayerMouseEvent) => {
        if (placingRef.current) return;
        const id = event.features?.[0]?.properties?.id as string | undefined;
        const client = clientsRef.current.find((item) => item.id === id);
        if (!client || !hasLocation(client)) return;
        setSelectedId(client.id);
        setTab("onMap");
        flyTo(client.longitude, client.latitude, 11.5);
      });

      currentMap.on("click", (event) => {
        if (!placingRef.current) return;
        setDraft({ latitude: event.lngLat.lat, longitude: event.lngLat.lng, label: null });
      });

      for (const layer of ["clusters", "client-points"]) {
        currentMap.on("mouseenter", layer, () => {
          if (!placingRef.current) currentMap.getCanvas().style.cursor = "pointer";
        });
        currentMap.on("mouseleave", layer, () => {
          currentMap.getCanvas().style.cursor = placingRef.current ? "crosshair" : "";
        });
      }
      currentMap.on("mousemove", "client-points", (event: MapLayerMouseEvent) => {
        const props = event.features?.[0]?.properties;
        if (!props || placingRef.current) return;
        setHover({ company: String(props.company), status: props.status as MapStatus, x: event.point.x, y: event.point.y });
      });
      currentMap.on("mouseleave", "client-points", () => setHover(null));
      currentMap.on("movestart", () => setHover(null));
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
      cancelAnimationFrame(frame);
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, [fitToClients, flyTo]);

  // ----- Keep the map's data and selection in sync -----------------------------

  useEffect(() => {
    syncRef.current = () => {
      const map = mapRef.current;
      const source = map?.getSource("clients") as GeoJSONSource | undefined;
      if (!map || !source) return;
      source.setData({
        type: "FeatureCollection",
        features: visible.map((client) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [client.longitude, client.latitude] },
          properties: { id: client.id, company: client.company, status: client.status, color: MAP_STATUS_COLORS[client.status], urgency: URGENCY_INDEX[client.status] },
        })),
      });
      if (map.getLayer("client-selected")) map.setFilter("client-selected", ["==", ["get", "id"], selectedId ?? ""]);
    };
    syncRef.current();
  }, [visible, selectedId]);

  // ----- Placing / moving a pin ---------------------------------------------

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    map.getCanvas().style.cursor = placing ? "crosshair" : "";
    if (!placing || !draft) {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      return;
    }
    if (!draftMarkerRef.current) {
      const element = document.createElement("div");
      element.className = "nisafety-draft-pin";
      element.innerHTML =
        '<span class="nisafety-draft-pin__body"><span class="nisafety-draft-pin__pulse"></span><svg viewBox="0 0 24 24" width="38" height="38" aria-hidden="true"><path d="M12 22s-7-6-7-12a7 7 0 0 1 14 0c0 6-7 12-7 12Z" fill="#2dd4bf" stroke="#042f2e" stroke-width="1.4"/><circle cx="12" cy="10" r="2.6" fill="#042f2e"/></svg></span>';
      const marker = new lib.Marker({ element, draggable: true, anchor: "bottom" }).setLngLat([draft.longitude, draft.latitude]).addTo(map);
      marker.on("dragend", () => {
        const position = marker.getLngLat();
        setDraft((current) => ({ latitude: position.lat, longitude: position.lng, label: current?.label ?? null }));
      });
      draftMarkerRef.current = marker;
    } else {
      draftMarkerRef.current.setLngLat([draft.longitude, draft.latitude]);
    }
  }, [placing, draft]);

  // One smart box: a company name is searched (debounced); a pasted Google
  // Maps link or coordinates is resolved on Enter / "Use this location".
  const entryIsLocation = looksLikeLocationInput(placeQuery);

  useEffect(() => {
    if (!placing || entryIsLocation) return;
    const term = placeQuery.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const body = (await response.json()) as { results?: PlaceResult[]; provider?: Provider };
        if (body.provider) setProvider(body.provider);
        if (!response.ok) throw new Error("search failed");
        setPlaceResults(body.results ?? []);
        setPlaceState("done");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setPlaceResults([]);
        setPlaceState("error");
      }
    }, 450);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [placing, placeQuery, entryIsLocation]);

  function changePlaceQuery(value: string) {
    setPlaceQuery(value);
    setResolveError("");
    if (looksLikeLocationInput(value) || value.trim().length < 2) {
      setPlaceResults([]);
      setPlaceState("idle");
    } else {
      setPlaceState("searching");
    }
  }

  function startPlacing(client: MapClient) {
    setSelectedId(null);
    setHover(null);
    setSaveError("");
    setPlacing({ clientId: client.id, mode: hasLocation(client) ? "move" : "place" });
    // Start straight away with a search for the company (suffixes like
    // "Sdn Bhd" removed - they only confuse map search).
    changePlaceQuery(searchableCompanyName(client.company));
    if (hasLocation(client)) {
      setDraft({ latitude: client.latitude, longitude: client.longitude, label: client.locationLabel });
      mapRef.current?.flyTo({ center: [client.longitude, client.latitude], zoom: 15, padding: cameraPadding(), duration: prefersReducedMotion() ? 0 : 1400, essential: true });
    } else {
      setDraft(null);
    }
  }

  const cancelPlacing = useCallback(() => {
    setPlacing(null);
    setDraft(null);
    setPlaceResults([]);
    setPlaceState("idle");
    setSaveError("");
    setResolveError("");
  }, []);

  useEffect(() => {
    if (!placing) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") cancelPlacing();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing, cancelPlacing]);

  function dropAt(latitude: number, longitude: number, label: string | null) {
    setDraft({ latitude, longitude, label });
    mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 16, padding: cameraPadding(), duration: prefersReducedMotion() ? 0 : 1800, essential: true });
  }

  function pickPlace(result: PlaceResult) {
    setPlaceState("idle");
    dropAt(result.latitude, result.longitude, [result.name, result.detail].filter(Boolean).join(", "));
  }

  async function submitEntry(event: FormEvent) {
    event.preventDefault();
    const value = placeQuery.trim();
    if (!value) return;
    if (!looksLikeLocationInput(value)) {
      // Enter on a name: take the first trustworthy result, if there is one.
      if (placeState === "done" && placeResults.length > 0) pickPlace(placeResults[0]);
      return;
    }
    setResolving(true);
    setResolveError("");
    try {
      const response = await fetch("/api/places/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: value }),
      });
      const body = (await response.json()) as { latitude?: number; longitude?: number; label?: string | null; error?: string };
      if (!response.ok || typeof body.latitude !== "number" || typeof body.longitude !== "number") {
        const code = (RESOLVE_ERRORS as readonly string[]).includes(body.error ?? "") ? body.error : "generic";
        setResolveError(t(`resolveErrors.${code}`));
        return;
      }
      dropAt(body.latitude, body.longitude, body.label ?? t("fromGoogle"));
    } catch {
      setResolveError(t("resolveErrors.generic"));
    } finally {
      setResolving(false);
    }
  }

  async function saveLocation() {
    if (!placing || !draft) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(`/api/clients/${placing.clientId}/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: draft.latitude, longitude: draft.longitude, label: draft.label }),
      });
      if (!response.ok) throw new Error("save failed");
      const id = placing.clientId;
      setClients((current) => current.map((client) => (client.id === id ? { ...client, latitude: draft.latitude, longitude: draft.longitude, locationLabel: draft.label } : client)));
      cancelPlacing();
      setSelectedId(id);
      setTab("onMap");
    } catch {
      setSaveError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function removeLocation() {
    if (!selected) return;
    setRemoving(true);
    setRemoveError("");
    try {
      const response = await fetch(`/api/clients/${selected.id}/location`, { method: "DELETE" });
      if (!response.ok) throw new Error("remove failed");
      const id = selected.id;
      setClients((current) => current.map((client) => (client.id === id ? { ...client, latitude: null, longitude: null, locationLabel: null } : client)));
      setConfirmRemove(false);
      setSelectedId(null);
    } catch {
      setRemoveError(t("removeFailed"));
    } finally {
      setRemoving(false);
    }
  }

  // ----- Controls -------------------------------------------------------------

  function toggleFilter(status: MapStatus) {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next.size === 0 ? new Set(MAP_STATUSES) : next;
    });
  }

  function selectFromList(client: MapClient) {
    if (!hasLocation(client)) return;
    setSelectedId(client.id);
    flyTo(client.longitude, client.latitude, 11.5);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frameRef.current?.requestFullscreen();
    } catch {
      // Fullscreen can be blocked (e.g. iOS Safari); the map still works.
    }
  }

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === frameRef.current);
      window.setTimeout(() => mapRef.current?.resize(), 50);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function showGlobe() {
    setSelectedId(null);
    mapRef.current?.flyTo({ center: [109.5, 4.2], zoom: 1.5, duration: prefersReducedMotion() ? 0 : 2200, essential: true });
  }

  const glass = "border border-white/10 bg-[#071317]/80 shadow-[0_24px_60px_rgba(0,0,0,.45)] backdrop-blur-2xl";
  const controlButton =
    "grid h-10 w-10 place-items-center text-white/60 transition-colors hover:bg-teal-400/10 hover:text-teal-300 focus-visible:bg-teal-400/10 focus-visible:text-teal-300 focus-visible:outline-none";
  const ghostButton =
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-white/12 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-teal-300/60 hover:text-teal-200";
  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-teal-300/60 focus:ring-4 focus:ring-teal-400/10";

  // ----- Render ---------------------------------------------------------------

  return (
    <div
      ref={frameRef}
      className={`relative isolate overflow-hidden bg-[#040b0d] text-white ${
        isFullscreen ? "h-screen w-screen" : "rounded-[2rem] border border-white/10 shadow-[0_40px_120px_rgba(2,14,18,.35)] lg:h-[min(84dvh,820px)] lg:min-h-[640px]"
      }`}
    >
      {/* Map canvas */}
      <div className={`relative ${isFullscreen ? "h-full" : "h-[64dvh] min-h-[440px] lg:h-full"}`}>
        {/* MapLibre forces position:relative on its container, so size it from a wrapper. */}
        <div className="absolute inset-0">
          <div ref={containerRef} className="h-full w-full" aria-label={t("title")} role="region" />
        </div>

        {/* Edge fade + faint grid: the "command centre" frame */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 shadow-[inset_0_0_160px_rgba(1,6,8,.85)]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(94,234,212,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(94,234,212,.6)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />

        {mapState !== "ready" && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-[#040b0d]">
            {mapState === "loading" ? (
              <div className="flex flex-col items-center gap-4 text-sm text-white/60">
                <span className="relative grid h-16 w-16 place-items-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-teal-400/20" />
                  <span className="absolute inset-2 rounded-full border border-teal-300/30" />
                  <Globe className="relative h-7 w-7 text-teal-300" />
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{t("loading")}</span>
              </div>
            ) : (
              <p className="max-w-xs text-center text-sm text-white/60">{t("mapError")}</p>
            )}
          </div>
        )}

        {/* Live HUD badge */}
        {mapState === "ready" && !placing && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 max-lg:hidden lg:left-[calc(50%+11.5rem)]">
            <div className={`flex items-center gap-3 rounded-full px-4 py-2 text-[11px] ${glass}`}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-300" />
              </span>
              <span className="font-mono font-semibold uppercase tracking-[0.18em] text-teal-200">{t("liveBadge")}</span>
              <span className="h-3 w-px bg-white/15" />
              <span className="text-white/70">{t("sitesCount", { count: mapped.length })}</span>
              {attention > 0 && (
                <>
                  <span className="h-3 w-px bg-white/15" />
                  <span className="font-semibold" style={{ color: MAP_STATUS_COLORS.expired }}>
                    {t("needAttention", { count: attention })}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Hover tooltip */}
        {hover && !placing && (
          <div
            className={`pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+18px)] whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${glass}`}
            style={{ left: hover.x, top: hover.y }}
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: MAP_STATUS_COLORS[hover.status] }} />
            {hover.company}
          </div>
        )}

        {/* Map controls */}
        <div className={`absolute right-4 top-4 z-10 flex flex-col overflow-hidden rounded-2xl ${glass}`}>
          <button type="button" className={controlButton} onClick={() => mapRef.current?.zoomIn()} aria-label={t("zoomIn")} title={t("zoomIn")}>
            <Plus className="h-4 w-4" />
          </button>
          <span className="mx-2 h-px bg-white/10" />
          <button type="button" className={controlButton} onClick={() => mapRef.current?.zoomOut()} aria-label={t("zoomOut")} title={t("zoomOut")}>
            <Minus className="h-4 w-4" />
          </button>
          <span className="mx-2 h-px bg-white/10" />
          <button type="button" className={controlButton} onClick={() => fitToClients(prefersReducedMotion() ? 0 : 1400)} aria-label={t("fitAll")} title={t("fitAll")}>
            <Crosshair className="h-4 w-4" />
          </button>
          <span className="mx-2 h-px bg-white/10" />
          <button type="button" className={controlButton} onClick={showGlobe} aria-label={t("globe")} title={t("globe")}>
            <Globe className="h-4 w-4" />
          </button>
          <span className="mx-2 h-px bg-white/10" />
          <button type="button" className={controlButton} onClick={toggleFullscreen} aria-label={isFullscreen ? t("exitFullscreen") : t("fullscreen")} title={isFullscreen ? t("exitFullscreen") : t("fullscreen")}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>

        {/* Placing sheet */}
        {placing && placingClient && (
          <div className="absolute inset-x-3 top-3 z-20 lg:left-[calc(23rem+2rem)] lg:right-20 lg:top-4">
            <div className={`mx-auto max-w-xl rounded-2xl p-4 animate-[rise_.35s_ease-out_both] ${glass} border-teal-300/25`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300">{placing.mode === "move" ? t("movePin") : t("place")}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold">{placing.mode === "move" ? t("movingTitle", { company: placingClient.company }) : t("placingTitle", { company: placingClient.company })}</p>
                </div>
                <button type="button" onClick={cancelPlacing} aria-label={t("cancel")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/12 text-white/60 transition hover:border-teal-300/60 hover:text-teal-200">
                  <Close className="h-3.5 w-3.5" />
                </button>
              </div>

              <form onSubmit={submitEntry} className="mt-3">
                <label htmlFor="map-entry" className="sr-only">
                  {t("entryLabel")}
                </label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    {entryIsLocation ? (
                      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-300" />
                    ) : (
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    )}
                    <input
                      id="map-entry"
                      value={placeQuery}
                      onChange={(event) => changePlaceQuery(event.target.value)}
                      placeholder={t("entryPlaceholder")}
                      autoFocus
                      autoComplete="off"
                      className={input}
                    />
                  </div>
                  {entryIsLocation && (
                    <button
                      type="submit"
                      disabled={resolving}
                      className="shrink-0 rounded-xl bg-teal-400 px-4 text-xs font-semibold text-slate-950 shadow-[0_8px_20px_rgba(45,212,191,.3)] transition hover:bg-teal-300 disabled:opacity-50"
                    >
                      {resolving ? t("resolving") : t("useLocation")}
                    </button>
                  )}
                </div>
                {resolveError && (
                  <p className="mt-2 text-xs text-rose-300" role="alert">
                    {resolveError}
                  </p>
                )}
              </form>

              {/* Search results / guidance */}
              {!entryIsLocation && placeState === "searching" && (
                <p className="mt-3 flex items-center gap-2 px-1 text-xs text-white/55">
                  <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-teal-300" />
                  {t("searching")}
                </p>
              )}
              {!entryIsLocation && placeState === "done" && placeResults.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <p className="border-b border-white/8 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                    {provider === "google" ? t("resultsGoogle") : t("resultsOsm")}
                  </p>
                  <div className="max-h-48 overflow-y-auto">
                    {placeResults.map((result) => (
                      <button
                        key={`${result.latitude},${result.longitude},${result.name}`}
                        type="button"
                        onClick={() => pickPlace(result)}
                        className="flex w-full items-start gap-3 border-b border-white/5 px-3 py-2.5 text-left transition last:border-0 hover:bg-teal-400/10"
                      >
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{result.name}</span>
                          {result.detail && <span className="block truncate text-xs text-white/50">{result.detail}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!entryIsLocation && (placeState === "error" || (placeState === "done" && placeResults.length === 0)) && (
                <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3.5">
                  <p className="text-xs font-semibold text-amber-200">{placeState === "error" ? t("searchFailed") : t("notFoundTitle")}</p>
                  <p className="mt-1 text-[11px] leading-5 text-white/60">{t("notFoundBody")}</p>
                  <ol className="mt-2.5 space-y-1.5 text-[11px] leading-5 text-white/70">
                    {(["guide1", "guide2", "guide3"] as const).map((step, index) => (
                      <li key={step} className="flex gap-2">
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-teal-400/15 font-mono text-[9px] font-bold text-teal-300">{index + 1}</span>
                        {t(step)}
                      </li>
                    ))}
                  </ol>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery.trim() || placingClient.company)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-semibold text-slate-900 transition hover:bg-teal-200"
                  >
                    {t("openInGoogleMaps")}
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              )}
              {(entryIsLocation || placeState === "idle" || (placeState === "done" && placeResults.length > 0)) && (
                <p className="mt-2.5 px-1 text-[11px] leading-5 text-white/45">
                  {t("entryHint")}{" "}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchableCompanyName(placingClient.company))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-semibold text-teal-300 hover:text-teal-200"
                  >
                    {t("openInGoogleMaps")}
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
                <p className="min-w-0 flex-1 text-xs leading-5 text-white/55">
                  {draft ? (
                    <>
                      <span className="font-semibold text-teal-300">{t("pinDropped")}</span> · {draft.label ?? t("customPin")}
                      <span className="ml-1 font-mono text-[10px] text-white/35">
                        {draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}
                      </span>
                    </>
                  ) : (
                    t("placeHint")
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={cancelPlacing} disabled={saving} className={`${ghostButton} disabled:opacity-50`}>
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={saveLocation}
                    disabled={!draft || saving}
                    className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-[0_10px_24px_rgba(45,212,191,.3)] transition hover:-translate-y-0.5 hover:bg-teal-300 disabled:translate-y-0 disabled:opacity-40"
                  >
                    {saving && <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />}
                    {saving ? t("saving") : t("save")}
                  </button>
                </div>
              </div>
              {saveError && (
                <p className="mt-2 text-xs text-rose-300" role="alert">
                  {saveError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Selected client card */}
        {selected && hasLocation(selected) && !placing && (
          <div className="absolute inset-x-3 bottom-3 z-20 lg:inset-x-auto lg:bottom-5 lg:right-5 lg:w-[23rem]">
            <div key={selected.id} className={`overflow-hidden rounded-2xl animate-[rise_.35s_ease-out_both] ${glass}`}>
              <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${MAP_STATUS_COLORS[selected.status]}, transparent)` }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: MAP_STATUS_COLORS[selected.status], background: `${MAP_STATUS_COLORS[selected.status]}1f` }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: MAP_STATUS_COLORS[selected.status] }} />
                      {statusLabel(selected.status)}
                    </span>
                    <h3 className="mt-2 text-base font-semibold leading-snug tracking-[-0.02em]">{selected.company}</h3>
                    <p className="mt-0.5 truncate text-xs text-white/50">
                      {selected.clientName} · {t("reports", { count: selected.reportCount })}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} aria-label={t("close")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/12 text-white/60 transition hover:border-teal-300/60 hover:text-teal-200">
                    <Close className="h-3.5 w-3.5" />
                  </button>
                </div>

                {selected.locationLabel && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-white/55">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-300" />
                    <span className="line-clamp-2">{selected.locationLabel}</span>
                  </p>
                )}

                {selected.services.length > 0 && (
                  <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{t("services")}</p>
                    <ul className="mt-2 space-y-1.5">
                      {selected.services.slice(0, 4).map((service) => (
                        <li key={service.documentId} className="flex items-center justify-between gap-3 text-xs">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: MAP_STATUS_COLORS[service.status] }} />
                            <span className="truncate font-medium">{categoryLabel(service.category)}</span>
                          </span>
                          <span className="shrink-0 text-white/50" title={service.expiryDate ? formatServiceDate(service.expiryDate, dateLocale) : undefined}>
                            {relativeExpiry(service.daysLeft)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {selected.latestDocumentId && (
                    <Link
                      href={`/records/${selected.latestDocumentId}`}
                      className="col-span-3 inline-flex items-center justify-center gap-2 rounded-full bg-teal-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-[0_10px_24px_rgba(45,212,191,.25)] transition hover:-translate-y-0.5 hover:bg-teal-300"
                    >
                      {t("openReport")} →
                    </Link>
                  )}
                  <a href={`tel:${selected.telephone.replace(/[^\d+]/g, "")}`} className={ghostButton}>
                    <Phone className="h-3.5 w-3.5" />
                    {t("call")}
                  </a>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`} target="_blank" rel="noopener noreferrer" className={ghostButton}>
                    <Navigation className="h-3.5 w-3.5" />
                    {t("directions")}
                  </a>
                  <button type="button" onClick={() => startPlacing(selected)} className={ghostButton}>
                    <Pencil className="h-3.5 w-3.5" />
                    {t("movePin")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRemoveError("");
                    setConfirmRemove(true);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-white/35 transition hover:text-rose-300"
                >
                  <Trash className="h-3 w-3" />
                  {t("removePin")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Side panel: floats over the map on large screens, sits below it on phones */}
      <aside
        className={`z-10 flex flex-col border-t border-white/10 bg-[#061114] lg:absolute lg:bottom-4 lg:left-4 lg:top-4 lg:w-[23rem] lg:rounded-2xl lg:border lg:bg-[#061114]/80 lg:shadow-[0_24px_60px_rgba(0,0,0,.45)] lg:backdrop-blur-2xl ${
          isFullscreen ? "max-lg:hidden" : ""
        }`}
      >
        <div className="p-5 pb-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300/80">{t("network")}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-4xl font-semibold tracking-[-0.05em]">
              {clients.length}
              <span className="ml-2 text-sm font-medium tracking-normal text-white/45">{t("clientsWord", { count: clients.length })}</span>
            </p>
            <p className="pb-1 text-right text-xs text-white/50">
              <span className="font-semibold text-white">{mapped.length}</span> {t("onMapShort")}
              <span className="mx-1.5 text-white/20">/</span>
              <span className="font-semibold text-amber-300">{unmapped.length}</span> {t("toPlaceShort")}
            </p>
          </div>

          {/* Health bar */}
          <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
            {MAP_STATUSES.map((status) =>
              counts[status] > 0 ? (
                <span key={status} className="h-full transition-all duration-700" style={{ width: `${(counts[status] / Math.max(clients.length, 1)) * 100}%`, background: MAP_STATUS_COLORS[status] }} />
              ) : null,
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-1.5" role="group" aria-label={t("filterHint")}>
            {MAP_STATUSES.map((status) => {
              const active = filters.has(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleFilter(status)}
                  aria-pressed={active}
                  title={t("filterHint")}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition ${
                    active ? "border-white/10 bg-white/[0.04] text-white/85 hover:border-white/20" : "border-transparent text-white/30 hover:text-white/50"
                  } ${status === "none" ? "col-span-2" : ""}`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full transition" style={{ background: MAP_STATUS_COLORS[status], opacity: active ? 1 : 0.3, boxShadow: active ? `0 0 10px ${MAP_STATUS_COLORS[status]}` : "none" }} />
                  <span className="min-w-0 flex-1 truncate">{statusLabel(status)}</span>
                  <span className="font-mono text-[10px] text-white/40">{counts[status]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/8 px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs font-semibold" role="tablist">
            {(["onMap", "toPlace"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={tab === option}
                onClick={() => setTab(option)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 transition ${tab === option ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"}`}
              >
                {option === "onMap" ? t("tabOnMap") : t("tabToPlace")}
                <span className={`rounded-full px-1.5 font-mono text-[10px] ${option === "toPlace" && unmapped.length > 0 ? "bg-amber-300/15 text-amber-300" : "bg-white/10 text-white/60"}`}>
                  {option === "onMap" ? mapped.length : unmapped.length}
                </span>
              </button>
            ))}
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchClients")} className={`${input} py-2 pl-9`} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 max-lg:max-h-[28rem]">
          {tab === "onMap" ? (
            <>
              {listed.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-white/45">{mapped.length === 0 ? t("noneOnMap") : t("noMatches")}</p>
              )}
              <ul className="space-y-1">
                {listed.map((client) => (
                  <li key={client.id}>
                    <button
                      type="button"
                      onClick={() => selectFromList(client)}
                      className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        selectedId === client.id ? "border-teal-300/30 bg-teal-400/10" : "border-transparent hover:border-white/8 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="relative grid h-3 w-3 shrink-0 place-items-center">
                        {(client.status === "expired" || client.status === "expiring") && (
                          <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: MAP_STATUS_COLORS[client.status] }} />
                        )}
                        <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: MAP_STATUS_COLORS[client.status], boxShadow: `0 0 10px ${MAP_STATUS_COLORS[client.status]}` }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white/90">{client.company}</span>
                        <span className="block truncate text-[11px] text-white/45">
                          {client.status === "expired" ? relativeExpiry(client.nextExpiryDays) : `${statusLabel(client.status)}${client.nextExpiry ? ` · ${relativeExpiry(client.nextExpiryDays)}` : ""}`}
                        </span>
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/20 transition group-hover:text-teal-300" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {mapped.length === 0 && (
                <div className="mb-3 rounded-xl border border-teal-300/20 bg-gradient-to-br from-teal-400/10 to-transparent p-4">
                  <p className="text-sm font-semibold">{t("getStartedTitle")}</p>
                  <ol className="mt-2 space-y-1.5 text-[11px] leading-5 text-white/60">
                    {(["step1", "step2", "step3"] as const).map((step, index) => (
                      <li key={step} className="flex gap-2">
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-teal-400/15 font-mono text-[9px] font-bold text-teal-300">{index + 1}</span>
                        {t(step)}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {unmapped.length === 0 && <p className="px-2 py-6 text-center text-xs text-white/45">{t("allPlaced")}</p>}
              {unmapped.length > 0 && unmappedListed.length === 0 && <p className="px-2 py-6 text-center text-xs text-white/45">{t("noMatches")}</p>}
              <ul className="space-y-1">
                {unmappedListed.map((client) => (
                  <li key={client.id} className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 transition hover:border-white/8 hover:bg-white/[0.03]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-amber-300/70" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white/85">{client.company}</span>
                      <span className="block truncate text-[11px] text-white/40">{statusLabel(client.status)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => startPlacing(client)}
                      disabled={mapState !== "ready"}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-teal-400/15 px-3 py-1.5 text-[11px] font-semibold text-teal-200 ring-1 ring-teal-300/25 transition hover:bg-teal-400 hover:text-slate-950 disabled:opacity-40"
                    >
                      <MapPin className="h-3 w-3" />
                      {t("place")}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={confirmRemove}
        title={t("removeTitle")}
        description={t("removeBody")}
        subject={selected ? <p className="text-sm font-semibold">{selected.company}</p> : undefined}
        confirmLabel={t("removeConfirm")}
        busyLabel={t("removing")}
        busy={removing}
        error={removeError}
        onConfirm={removeLocation}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}
