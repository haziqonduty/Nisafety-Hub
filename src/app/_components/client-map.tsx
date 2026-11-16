"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Marker as MapLibreMarker } from "maplibre-gl";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/app/_components/confirm-dialog";
import { Close, Crosshair, Globe, MapPin, Maximize, Minimize, Minus, Navigation, Pencil, Phone, Plus, Search, Trash } from "@/app/_components/icons";
import { Link } from "@/i18n/routing";
import {
  MALAYSIA_VIEW,
  MAP_STATUS_COLORS,
  MAP_STATUSES,
  compareUrgency,
  type MapClient,
  type MapStatus,
  type PlaceResult,
} from "@/lib/client-map";
import { formatServiceDate, shortCategoryLabel } from "@/lib/format";

type MapLib = typeof import("maplibre-gl");
type Theme = "dark" | "light";
type Draft = { latitude: number; longitude: number; label: string | null };
type Placing = { clientId: string; mode: "place" | "move" };
type PlaceState = "idle" | "searching" | "done" | "error";

// Free OpenFreeMap vector styles (no key, OK for commercial use).
const STYLE_URLS: Record<Theme, string> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

const URGENCY_INDEX: Record<MapStatus, number> = { expired: 0, expiring: 1, upcoming: 2, valid: 3, none: 4 };

// Colour by a cluster's/point's urgency (0 = expired … 4 = nothing tracked).
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

const PALETTE: Record<Theme, { surface: string; text: string; halo: string; background: string; water: string }> = {
  dark: { surface: "#0a1a1f", text: "#e6f6f3", halo: "#061014", background: "#071215", water: "#0a222a" },
  light: { surface: "#ffffff", text: "#0f2a33", halo: "#ffffff", background: "#f4f6f5", water: "#cfe6ea" },
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isWide() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

function cameraPadding() {
  return isWide() ? { top: 80, bottom: 80, left: 420, right: 90 } : { top: 70, bottom: 70, left: 40, right: 40 };
}

function hasLocation(client: MapClient): client is MapClient & { latitude: number; longitude: number } {
  return client.latitude !== null && client.longitude !== null;
}

/** Recolour the basemap's land and water so it sits in the brand palette. */
function tuneBasemap(map: MapLibreMap, theme: Theme) {
  const palette = PALETTE[theme];
  const set = (layer: string, property: Parameters<MapLibreMap["setPaintProperty"]>[1], value: string) => {
    if (map.getLayer(layer)) {
      try {
        map.setPaintProperty(layer, property, value);
      } catch {
        // A style update can rename layers; tuning is cosmetic, so skip.
      }
    }
  };
  set("background", "background-color", palette.background);
  set("water", "fill-color", palette.water);

  // The stock dark style draws roads as stark black lines with white
  // casings; mute them into the teal-grey palette so client pins lead.
  if (theme === "dark") {
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.type !== "line" || !/highway|road|railway|aeroway|bridge|tunnel/.test(layer.id)) continue;
      set(layer.id, "line-color", /casing/.test(layer.id) ? "#0c1f24" : "#1c3a40");
    }
  }
}

function addClientLayers(map: MapLibreMap, theme: Theme) {
  const palette = PALETTE[theme];
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
      paint: {
        "circle-color": URGENCY_COLOR,
        "circle-radius": ["step", ["get", "point_count"], 28, 10, 34, 50, 42],
        "circle-opacity": 0.22,
        "circle-blur": 0.6,
      },
    },
    {
      id: "clusters",
      type: "circle",
      source: "clients",
      filter: isCluster,
      paint: {
        "circle-color": palette.surface,
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
      paint: { "text-color": palette.text },
    },
    {
      id: "client-glow",
      type: "circle",
      source: "clients",
      filter: isPoint,
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 13, 12, 22],
        "circle-opacity": 0.35,
        "circle-blur": 0.85,
      },
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
        "circle-stroke-color": palette.surface,
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
      minzoom: 8,
      layout: {
        "text-field": ["get", "company"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-offset": [0, 1.5],
        "text-anchor": "top",
        "text-max-width": 12,
        "text-optional": true,
      },
      paint: { "text-color": palette.text, "text-halo-color": palette.halo, "text-halo-width": 1.5 },
    },
  ];
  for (const layer of layers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapLibre's layer spec types don't narrow well from literals.
    if (!map.getLayer(layer.id)) map.addLayer(layer as any);
  }
}

export function ClientMap({ initialClients }: { initialClients: MapClient[] }) {
  const t = useTranslations("map");
  const tCategories = useTranslations("categories.items");
  const locale = useLocale();
  const dateLocale = locale === "ms" ? "ms-MY" : "en-GB";
  const { resolvedTheme } = useTheme();
  const theme: Theme = resolvedTheme === "light" ? "light" : "dark";

  const [clients, setClients] = useState(initialClients);
  const [filters, setFilters] = useState<Set<MapStatus>>(() => new Set(MAP_STATUSES));
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ company: string; status: MapStatus; x: number; y: number } | null>(null);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error">("loading");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [placing, setPlacing] = useState<Placing | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeState, setPlaceState] = useState<PlaceState>("idle");
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
  const themeRef = useRef<Theme>(theme);
  const appliedThemeRef = useRef<Theme>(theme);
  const placingRef = useRef<Placing | null>(null);
  const syncRef = useRef<() => void>(() => {});
  const introDoneRef = useRef(false);
  const clientsRef = useRef(clients);

  const mapped = useMemo(() => clients.filter(hasLocation), [clients]);
  const unmapped = useMemo(() => clients.filter((client) => !hasLocation(client)), [clients]);
  const counts = useMemo(() => {
    const result: Record<MapStatus, number> = { expired: 0, expiring: 0, upcoming: 0, valid: 0, none: 0 };
    for (const client of mapped) result[client.status] += 1;
    return result;
  }, [mapped]);
  const visible = useMemo(() => mapped.filter((client) => filters.has(client.status)), [mapped, filters]);

  const needle = query.trim().toLowerCase();
  const matches = (client: MapClient) =>
    !needle || client.company.toLowerCase().includes(needle) || client.clientName.toLowerCase().includes(needle) || (client.locationLabel ?? "").toLowerCase().includes(needle);
  const listed = visible.filter(matches).sort((a, b) => compareUrgency(a.status, b.status) || a.company.localeCompare(b.company));
  const unmappedListed = unmapped.filter(matches);

  const selected = clients.find((client) => client.id === selectedId) ?? null;
  const placingClient = placing ? (clients.find((client) => client.id === placing.clientId) ?? null) : null;

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);
  useEffect(() => {
    placingRef.current = placing;
  }, [placing]);
  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  const statusLabel = (status: MapStatus) => t(`status.${status}`);

  function categoryLabel(category: string) {
    try {
      return shortCategoryLabel(tCategories(category));
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
    const lib = libRef.current;
    if (!map || !lib) return;
    const points = clientsRef.current.filter(hasLocation);
    const padding = cameraPadding();
    if (points.length === 0) {
      map.fitBounds(MALAYSIA_VIEW, { padding, duration });
      return;
    }
    if (points.length === 1) {
      map.flyTo({ center: [points[0].longitude, points[0].latitude], zoom: 8, padding, duration, essential: true });
      return;
    }
    const bounds = new lib.LngLatBounds();
    for (const point of points) bounds.extend([point.longitude, point.latitude]);
    const camera = map.cameraForBounds(bounds, { padding, maxZoom: 9 });
    if (camera) map.flyTo({ ...camera, duration, essential: true });
  }, []);

  const flyToClient = useCallback((client: MapClient) => {
    const map = mapRef.current;
    if (!map || !hasLocation(client)) return;
    map.flyTo({
      center: [client.longitude, client.latitude],
      zoom: Math.max(map.getZoom(), 11.5),
      padding: cameraPadding(),
      duration: prefersReducedMotion() ? 0 : 1600,
      essential: true,
    });
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
      try {
        lib = await import("maplibre-gl");
      } catch {
        if (!cancelled) setMapState("error");
        return;
      }
      if (cancelled || !containerRef.current) return;
      libRef.current = lib;
      appliedThemeRef.current = themeRef.current;
      lib.setWorkerUrl(`/vendor/maplibre-gl-worker-${lib.getVersion()}.js`);

      map = new lib.Map({
        container: containerRef.current,
        style: STYLE_URLS[themeRef.current],
        center: [109.5, 4.2],
        zoom: prefersReducedMotion() ? 5 : 1.4,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new lib.AttributionControl({ compact: true }), "bottom-right");
      // The basemap references a few POI icons its sprite doesn't ship; fill
      // them with a transparent pixel instead of logging warnings.
      map.on("styleimagemissing", (event) => {
        if (!map?.hasImage(event.id)) map?.addImage(event.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });

      const currentMap = map;
      // Expired / due-soon pins breathe, so they're the first thing you see.
      // Started only after "load": repainting a layer every frame keeps the
      // style "dirty", so the map would otherwise never report itself loaded.
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
          // Globe is a nice-to-have; flat Mercator is fine.
        }
        tuneBasemap(currentMap, appliedThemeRef.current);
        addClientLayers(currentMap, appliedThemeRef.current);
        syncRef.current();
      });

      currentMap.on("load", () => {
        if (cancelled) return;
        setMapState("ready");
        startPulse();
        // Compact attribution starts expanded; keep it as the small (i) button.
        containerRef.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        if (!introDoneRef.current) {
          introDoneRef.current = true;
          fitToClients(prefersReducedMotion() ? 0 : 3200);
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
        if (!client) return;
        setSelectedId(client.id);
        flyToClient(client);
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
  }, [fitToClients, flyToClient]);

  // ----- Keep the map's data, selection and theme in sync ---------------------

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
          properties: {
            id: client.id,
            company: client.company,
            status: client.status,
            color: MAP_STATUS_COLORS[client.status],
            urgency: URGENCY_INDEX[client.status],
          },
        })),
      });
      if (map.getLayer("client-selected")) map.setFilter("client-selected", ["==", ["get", "id"], selectedId ?? ""]);
    };
    syncRef.current();
  }, [visible, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedThemeRef.current === theme) return;
    appliedThemeRef.current = theme;
    map.setStyle(STYLE_URLS[theme]);
  }, [theme]);

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

  // Debounced place search while placing.
  useEffect(() => {
    if (!placing) return;
    const term = placeQuery.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const body = (await response.json()) as { results?: PlaceResult[] };
        if (!response.ok) throw new Error("search failed");
        setPlaceResults(body.results ?? []);
        setPlaceState("done");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setPlaceResults([]);
        setPlaceState("error");
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [placing, placeQuery]);

  function changePlaceQuery(value: string) {
    setPlaceQuery(value);
    if (value.trim().length < 2) {
      setPlaceResults([]);
      setPlaceState("idle");
    } else {
      setPlaceState("searching");
    }
  }

  function startPlacing(client: MapClient) {
    const mode = hasLocation(client) ? "move" : "place";
    setSelectedId(null);
    setHover(null);
    setSaveError("");
    setPlacing({ clientId: client.id, mode });
    if (hasLocation(client)) {
      setDraft({ latitude: client.latitude, longitude: client.longitude, label: client.locationLabel });
      mapRef.current?.flyTo({ center: [client.longitude, client.latitude], zoom: 14, padding: cameraPadding(), duration: prefersReducedMotion() ? 0 : 1400, essential: true });
      changePlaceQuery("");
    } else {
      setDraft(null);
      changePlaceQuery(client.company);
    }
  }

  const cancelPlacing = useCallback(() => {
    setPlacing(null);
    setDraft(null);
    setPlaceResults([]);
    setPlaceState("idle");
    setSaveError("");
  }, []);

  useEffect(() => {
    if (!placing) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") cancelPlacing();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing, cancelPlacing]);

  function pickPlace(result: PlaceResult) {
    setDraft({ latitude: result.latitude, longitude: result.longitude, label: [result.name, result.detail].filter(Boolean).join(", ") });
    setPlaceResults([]);
    setPlaceState("idle");
    mapRef.current?.flyTo({ center: [result.longitude, result.latitude], zoom: 14.5, padding: cameraPadding(), duration: prefersReducedMotion() ? 0 : 1600, essential: true });
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
      const next = clients.map((client) =>
        client.id === id ? { ...client, latitude: draft.latitude, longitude: draft.longitude, locationLabel: draft.label } : client,
      );
      setClients(next);
      cancelPlacing();
      setSelectedId(id);
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
    setSelectedId(client.id);
    flyToClient(client);
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
    mapRef.current?.flyTo({ center: [109.5, 4.2], zoom: 1.6, duration: prefersReducedMotion() ? 0 : 2200, essential: true });
  }

  const controlButton =
    "grid h-10 w-10 place-items-center text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent focus-visible:bg-accent-soft focus-visible:text-accent focus-visible:outline-none";

  // ----- Render ---------------------------------------------------------------

  return (
    <div
      ref={frameRef}
      className={`relative overflow-hidden border border-line bg-surface shadow-[0_30px_80px_rgba(4,24,30,.16)] ${
        isFullscreen ? "h-screen w-screen rounded-none" : "rounded-[2rem] lg:h-[min(80dvh,800px)] lg:min-h-[620px]"
      }`}
    >
      {/* Map canvas */}
      <div className={`relative ${isFullscreen ? "h-full" : "h-[62dvh] min-h-[420px] lg:h-full"}`}>
        {/* MapLibre forces position:relative on its container, so size it from a wrapper. */}
        <div className="absolute inset-0 bg-canvas">
          <div ref={containerRef} className="h-full w-full" aria-label={t("title")} role="region" />
        </div>

        {/* Soft vignette so overlays read on any part of the map */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(2,10,14,.35)]" />

        {mapState !== "ready" && (
          <div className="absolute inset-0 grid place-items-center bg-canvas/70 backdrop-blur-sm">
            {mapState === "loading" ? (
              <div className="flex flex-col items-center gap-3 text-sm text-ink-muted">
                <span className="relative grid h-14 w-14 place-items-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-accent/25" />
                  <Globe className="relative h-7 w-7 text-accent" />
                </span>
                {t("loading")}
              </div>
            ) : (
              <p className="max-w-xs text-center text-sm text-ink-muted">{t("mapError")}</p>
            )}
          </div>
        )}

        {/* Hover tooltip */}
        {hover && !placing && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+18px)] whitespace-nowrap rounded-full border border-line/70 bg-surface/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-lg backdrop-blur-xl"
            style={{ left: hover.x, top: hover.y }}
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: MAP_STATUS_COLORS[hover.status] }} />
            {hover.company}
          </div>
        )}

        {/* Map controls */}
        <div className="absolute right-4 top-4 z-10 flex flex-col overflow-hidden rounded-2xl border border-line/70 bg-surface/85 shadow-[0_12px_30px_rgba(2,12,18,.18)] backdrop-blur-xl">
          <button type="button" className={controlButton} onClick={() => mapRef.current?.zoomIn()} aria-label={t("zoomIn")} title={t("zoomIn")}>
            <Plus className="h-4 w-4" />
          </button>
          <span className="mx-2 h-px bg-line" />
          <button type="button" className={controlButton} onClick={() => mapRef.current?.zoomOut()} aria-label={t("zoomOut")} title={t("zoomOut")}>
            <Minus className="h-4 w-4" />
          </button>
          <span className="mx-2 h-px bg-line" />
          <button type="button" className={controlButton} onClick={() => fitToClients(prefersReducedMotion() ? 0 : 1400)} aria-label={t("fitAll")} title={t("fitAll")}>
            <Crosshair className="h-4 w-4" />
          </button>
          <span className="mx-2 h-px bg-line" />
          <button type="button" className={controlButton} onClick={showGlobe} aria-label={t("globe")} title={t("globe")}>
            <Globe className="h-4 w-4" />
          </button>
          <span className="mx-2 h-px bg-line" />
          <button
            type="button"
            className={controlButton}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
            title={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>

        {/* Empty state */}
        {mapState === "ready" && mapped.length === 0 && !placing && (
          <div className="pointer-events-none absolute inset-x-4 bottom-6 z-10 flex justify-center lg:inset-x-auto lg:left-[calc(50%+11rem)] lg:-translate-x-1/2">
            <div className="max-w-sm rounded-2xl border border-line/70 bg-surface/90 p-5 text-center shadow-xl backdrop-blur-xl animate-[rise_.5s_ease-out_both]">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                <MapPin className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold">{t("emptyTitle")}</p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">{t("emptyBody")}</p>
            </div>
          </div>
        )}

        {/* Placing bar */}
        {placing && placingClient && (
          <div className="absolute inset-x-3 top-3 z-20 lg:left-[calc(22rem+2rem)] lg:right-20 lg:top-4">
            <div className="mx-auto max-w-xl rounded-2xl border border-accent/40 bg-surface/92 p-4 shadow-[0_20px_50px_rgba(2,12,18,.28)] backdrop-blur-xl animate-[rise_.35s_ease-out_both]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                    {placing.mode === "move" ? t("movePin") : t("place")}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold">
                    {placing.mode === "move" ? t("movingTitle", { company: placingClient.company }) : t("placingTitle", { company: placingClient.company })}
                  </p>
                </div>
                <button type="button" onClick={cancelPlacing} aria-label={t("cancel")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-muted transition hover:border-accent hover:text-accent">
                  <Close className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  type="search"
                  value={placeQuery}
                  onChange={(event) => changePlaceQuery(event.target.value)}
                  placeholder={t("placeSearch")}
                  autoFocus
                  className="w-full rounded-xl border border-line bg-canvas/60 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-ink-faint focus:border-accent focus:ring-4 focus:ring-accent/15"
                />
                {placeState !== "idle" && placeQuery.trim().length >= 2 && (
                  <div className="absolute inset-x-0 top-[calc(100%+6px)] z-10 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface shadow-2xl">
                    {placeState === "searching" && <p className="px-4 py-3 text-xs text-ink-muted">{t("searching")}</p>}
                    {placeState === "error" && <p className="px-4 py-3 text-xs text-ink-muted">{t("searchFailed")}</p>}
                    {placeState === "done" && placeResults.length === 0 && <p className="px-4 py-3 text-xs text-ink-muted">{t("noPlaces")}</p>}
                    {placeState === "done" &&
                      placeResults.map((result) => (
                        <button
                          key={`${result.latitude},${result.longitude},${result.name}`}
                          type="button"
                          onClick={() => pickPlace(result)}
                          className="flex w-full items-start gap-3 border-b border-line/60 px-4 py-2.5 text-left transition last:border-0 hover:bg-accent-soft"
                        >
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{result.name}</span>
                            {result.detail && <span className="block truncate text-xs text-ink-muted">{result.detail}</span>}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 flex-1 text-xs leading-5 text-ink-muted">
                  {draft ? (
                    <>
                      <span className="font-semibold text-accent">{t("pinDropped")}</span> · {draft.label ?? t("customPin")}
                      <span className="ml-1 font-mono text-[10px] text-ink-faint">
                        {draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}
                      </span>
                    </>
                  ) : (
                    t("placeHint")
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={cancelPlacing} disabled={saving} className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-accent disabled:opacity-50">
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={saveLocation}
                    disabled={!draft || saving}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(15,118,110,.3)] transition hover:-translate-y-0.5 hover:bg-accent-hover disabled:translate-y-0 disabled:opacity-50"
                  >
                    {saving && <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                    {saving ? t("saving") : t("save")}
                  </button>
                </div>
              </div>
              {saveError && (
                <p className="mt-2 text-xs text-danger" role="alert">
                  {saveError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Selected client card */}
        {selected && hasLocation(selected) && !placing && (
          <div className="absolute inset-x-3 bottom-3 z-20 lg:inset-x-auto lg:bottom-5 lg:right-5 lg:w-[23rem]">
            <div key={selected.id} className="overflow-hidden rounded-2xl border border-line/70 bg-surface/92 shadow-[0_24px_60px_rgba(2,12,18,.3)] backdrop-blur-xl animate-[rise_.35s_ease-out_both]">
              <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${MAP_STATUS_COLORS[selected.status]}, transparent)` }} />
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
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {selected.clientName} · {t("reports", { count: selected.reportCount })}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} aria-label={t("close")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-muted transition hover:border-accent hover:text-accent">
                    <Close className="h-3.5 w-3.5" />
                  </button>
                </div>

                {selected.locationLabel && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-ink-muted">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="line-clamp-2">{selected.locationLabel}</span>
                  </p>
                )}

                {selected.services.length > 0 && (
                  <div className="mt-4 rounded-xl border border-line/70 bg-canvas/50 p-3">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{t("services")}</p>
                    <ul className="mt-2 space-y-1.5">
                      {selected.services.slice(0, 4).map((service) => (
                        <li key={service.documentId} className="flex items-center justify-between gap-3 text-xs">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: MAP_STATUS_COLORS[service.status] }} />
                            <span className="truncate font-medium">{categoryLabel(service.category)}</span>
                          </span>
                          <span className="shrink-0 text-ink-muted" title={service.expiryDate ? formatServiceDate(service.expiryDate, dateLocale) : undefined}>
                            {relativeExpiry(service.daysLeft)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {selected.latestDocumentId ? (
                    <Link
                      href={`/records/${selected.latestDocumentId}`}
                      className="col-span-3 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(15,118,110,.28)] transition hover:-translate-y-0.5 hover:bg-accent-hover"
                    >
                      {t("openReport")} →
                    </Link>
                  ) : null}
                  <a
                    href={`tel:${selected.telephone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-accent"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {t("call")}
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-accent"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    {t("directions")}
                  </a>
                  <button
                    type="button"
                    onClick={() => startPlacing(selected)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-accent"
                  >
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
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-faint transition hover:text-danger"
                >
                  <Trash className="h-3 w-3" />
                  {t("removePin")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Side panel: overlays the map on large screens, sits below it on phones */}
      <aside
        className={`z-10 flex flex-col border-t border-line bg-surface lg:absolute lg:bottom-4 lg:left-4 lg:top-4 lg:w-[22rem] lg:rounded-2xl lg:border lg:border-line/70 lg:bg-surface/88 lg:shadow-[0_20px_50px_rgba(2,12,18,.22)] lg:backdrop-blur-xl ${isFullscreen ? "max-lg:hidden" : ""}`}
      >
        <div className="border-b border-line/70 p-4">
          <p className="text-xs text-ink-muted">
            <span className="font-semibold text-ink">{t("statMapped", { mapped: mapped.length, total: clients.length })}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("filterHint")}>
            {MAP_STATUSES.map((status) => {
              const active = filters.has(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleFilter(status)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    active ? "border-line bg-canvas/70 text-ink" : "border-transparent bg-transparent text-ink-faint line-through decoration-ink-faint/60"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: MAP_STATUS_COLORS[status], opacity: active ? 1 : 0.35 }} />
                  {statusLabel(status)}
                  <span className="font-mono text-[10px] text-ink-faint">{counts[status]}</span>
                </button>
              );
            })}
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchClients")}
              className="w-full rounded-xl border border-line bg-canvas/60 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-ink-faint focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 max-lg:max-h-[26rem]">
          <p className="px-2 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            {t("onMap")} · {listed.length}
          </p>
          {listed.length === 0 && <p className="px-2 py-3 text-xs text-ink-muted">{t("noMatches")}</p>}
          <ul>
            {listed.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => selectFromList(client)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                    selectedId === client.id ? "bg-accent-soft" : "hover:bg-canvas/70"
                  }`}
                >
                  <span className="relative grid h-3 w-3 shrink-0 place-items-center">
                    {(client.status === "expired" || client.status === "expiring") && (
                      <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: MAP_STATUS_COLORS[client.status] }} />
                    )}
                    <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: MAP_STATUS_COLORS[client.status] }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{client.company}</span>
                    <span className="block truncate text-[11px] text-ink-muted">
                      {client.status === "expired"
                        ? relativeExpiry(client.nextExpiryDays)
                        : `${statusLabel(client.status)}${client.nextExpiry ? ` · ${relativeExpiry(client.nextExpiryDays)}` : ""}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {unmappedListed.length > 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-line p-2">
              <p className="px-1.5 pt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber">
                {t("notPlaced")} · {unmappedListed.length}
              </p>
              <p className="px-1.5 pb-1 pt-0.5 text-[11px] text-ink-muted">{t("notPlacedHint")}</p>
              <ul>
                {unmappedListed.map((client) => (
                  <li key={client.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm">{client.company}</span>
                    <button
                      type="button"
                      onClick={() => startPlacing(client)}
                      disabled={mapState !== "ready"}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent hover:text-white disabled:opacity-50"
                    >
                      <MapPin className="h-3 w-3" />
                      {t("place")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
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
