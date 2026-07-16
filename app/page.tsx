"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import shioriMemos from "../data/shiori-memos.json";

type Category = "すべて" | "絶景" | "歴史" | "神社" | "グルメ" | "公園" | "美術館";

type Place = {
  id: string;
  name: string;
  category: Exclude<Category, "すべて">;
  lat: number;
  lng: number;
  description: string;
  image?: string;
  youtube?: string;
  photoUrl?: string;
  sourceLayer?: string;
};

type SyncMeta = {
  updatedAt?: string;
  cached?: boolean;
  syncError?: string;
  spotCount?: number;
};

declare global {
  interface Window {
    google?: any;
    __akinadaMapReady?: () => void;
    __AKINADA_STATIC_CONFIG__?: {
      apiKey?: string;
      mapId?: string;
      basePath?: string;
      placesUrl?: string;
    };
  }
}

function staticConfig() {
  return typeof window === "undefined" ? undefined : window.__AKINADA_STATIC_CONFIG__;
}

function assetPath(path: string) {
  const basePath = staticConfig()?.basePath?.replace(/\/$/, "") ?? "";
  return `${basePath}/${path.replace(/^\//, "")}`;
}

const categories: { name: Category; icon: string }[] = [
  { name: "すべて", icon: "✦" },
  { name: "絶景", icon: "◉" },
  { name: "歴史", icon: "⌛" },
  { name: "神社", icon: "⛩" },
  { name: "グルメ", icon: "☕" },
  { name: "公園", icon: "♧" },
  { name: "美術館", icon: "▣" },
];

const fallbackPlaces: Place[] = [
  {
    id: "akinada-bridge",
    name: "安芸灘大橋",
    category: "絶景",
    lat: 34.2062174,
    lng: 132.679108,
    description: "ここから楽しいあなたの旅に、やさしい風が吹きますように。瀬戸内の島旅の入口です。",
    image: "https://img.youtube.com/vi/WkqZXW3RmAQ/hqdefault.jpg",
    youtube: "https://www.youtube.com/watch?v=WkqZXW3RmAQ",
  },
  {
    id: "ranto-art",
    name: "蘭島閣美術館",
    category: "美術館",
    lat: 34.188351,
    lng: 132.683994,
    description: "瀬戸内ゆかりの作品に出会える美術館。毎月第三土曜日にはギャラリーコンサートも開かれます。",
    image: "https://img.youtube.com/vi/1GgZk5zJrBg/hqdefault.jpg",
    youtube: "https://www.youtube.com/watch?v=1GgZk5zJrBg",
  },
  {
    id: "kajigahama",
    name: "梶ヶ浜海水浴場",
    category: "絶景",
    lat: 34.1730024,
    lng: 132.6710211,
    description: "穏やかな瀬戸内の海に面した海水浴場。島時間のなかで、素敵な思い出をつくってください。",
    image: "https://img.youtube.com/vi/JdXv_OpsWw4/hqdefault.jpg",
    youtube: "https://www.youtube.com/watch?v=JdXv_OpsWw4",
  },
  {
    id: "shotoen",
    name: "松濤園・蒲刈島御番所跡",
    category: "歴史",
    lat: 34.1875829,
    lng: 132.6841754,
    description: "朝鮮通信使の歴史と、海の交流文化を伝える三之瀬の文化施設です。",
  },
  {
    id: "ushio-view",
    name: "潮流みはらし台",
    category: "絶景",
    lat: 34.187411,
    lng: 132.6813423,
    description: "橋と島々、行き交う船を眺められる小さな展望スポットです。",
  },
  {
    id: "ebisu",
    name: "蛭子神社（下蒲刈島）",
    category: "神社",
    lat: 34.1984,
    lng: 132.6842,
    description: "島の暮らしと海を見守ってきた、地域の大切な神社です。",
  },
  {
    id: "akinada-park",
    name: "安芸灘公園",
    category: "公園",
    lat: 34.2072,
    lng: 132.6767,
    description: "安芸灘大橋を間近に望める、旅のひと休みにぴったりの海辺の公園です。",
  },
  {
    id: "side-side",
    name: "side side cafe",
    category: "グルメ",
    lat: 34.1879,
    lng: 132.6833,
    description: "三之瀬のまち歩きで立ち寄りたい、島の空気を感じるカフェです。",
  },
];

const markerTone: Record<Exclude<Category, "すべて">, string> = {
  絶景: "blue",
  歴史: "coral",
  神社: "coral",
  グルメ: "green",
  公園: "green",
  美術館: "blue",
};

const markerAsset: Record<Exclude<Category, "すべて">, string> = {
  絶景: assetPath("marker-blue.png"),
  歴史: assetPath("marker-red.png"),
  神社: assetPath("marker-red.png"),
  グルメ: assetPath("marker-green.png"),
  公園: assetPath("marker-green.png"),
  美術館: assetPath("marker-blue.png"),
};

const myMapsInspiredStyle = [
  { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#52656b" }] },
  { featureType: "all", elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#c8d1d0" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#334f59" }] },
  { featureType: "administrative.neighborhood", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#496268" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#eef5e9" }] },
  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ color: "#dcebd6" }] },
  { featureType: "landscape.natural.landcover", elementType: "geometry", stylers: [{ color: "#e6f2df" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#d5eacb" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#52705b" }] },
  { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 3 }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ saturation: -55 }, { lightness: 18 }] },
  { featureType: "poi.business", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "poi.business", elementType: "labels.text.fill", stylers: [{ color: "#4f6064" }] },
  { featureType: "poi.government", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "poi.government", elementType: "labels.text.fill", stylers: [{ color: "#445e68" }] },
  { featureType: "poi.medical", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "poi.place_of_worship", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "poi.place_of_worship", elementType: "labels.text.fill", stylers: [{ color: "#655a70" }] },
  { featureType: "poi.school", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "poi.school", elementType: "labels.text.fill", stylers: [{ color: "#4d6670" }] },
  { featureType: "poi.sports_complex", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#e1e5e6" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#cbd1d3" }, { weight: 1 }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#606f74" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "on" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#d6dcde" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#bcc6c9" }, { weight: 1.2 }] },
  { featureType: "road.arterial", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#f3f4f2" }] },
  { featureType: "road.local", elementType: "geometry.stroke", stylers: [{ color: "#cfd5d5" }, { weight: 0.8 }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#a9ddf0" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3f7b91" }] },
];

type MapStatus = "loading" | "missing" | "ready" | "error";

type MiniAppId = "calculator" | "marble-catch";

const miniApps: { id: MiniAppId; name: string; description: string; icon: string; url: string }[] = [
  { id: "calculator", name: "しおり電卓", description: "旅費やお買い物の計算に", icon: "▦", url: "https://masaka2-afk.github.io/chibi-shiori-calculator/" },
  { id: "marble-catch", name: "しおりのビー玉キャッチ", description: "ビー玉を集めて遊ぼう", icon: "●", url: "https://akinada-shiori-game.netlify.app" },
];

function memoGroup(category: Place["category"]) {
  if (category === "歴史" || category === "神社") return "歴史・神社" as const;
  return category;
}

function pickMemo(category: Place["category"], previous = "") {
  const specific = shioriMemos.categories[memoGroup(category)] ?? [];
  const candidates = [...shioriMemos.common, ...specific];
  const available = candidates.filter((message) => message !== previous);
  const pool = available.length ? available : candidates;
  return pool[Math.floor(Math.random() * pool.length)] ?? shioriMemos.common[0];
}

export default function Home() {
  const [places, setPlaces] = useState<Place[]>(fallbackPlaces);
  const [category, setCategory] = useState<Category>("すべて");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Place>(fallbackPlaces[0]);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState("");
  const [mapsApiKey, setMapsApiKey] = useState("");
  const [mapsMapId, setMapsMapId] = useState("");
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [appsMenuOpen, setAppsMenuOpen] = useState(false);
  const [activeAppId, setActiveAppId] = useState<MiniAppId | null>(null);
  const [appLoaded, setAppLoaded] = useState(false);
  const [appSlow, setAppSlow] = useState(false);
  const [memoText, setMemoText] = useState(shioriMemos.common[0]);
  const [syncMeta, setSyncMeta] = useState<SyncMeta>({});
  const [syncing, setSyncing] = useState(false);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapsLibraryRef = useRef<any>(null);
  const markerConstructorRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const clusterRef = useRef<MarkerClusterer | null>(null);
  const activeApp = miniApps.find((app) => app.id === activeAppId) ?? null;

  const loadPlaces = async (manual = false) => {
    setSyncing(true);
    try {
      const config = staticConfig();
      const placesUrl = config?.placesUrl ?? "/api/places";
      const requestUrl = manual && config
        ? `${placesUrl}${placesUrl.includes("?") ? "&" : "?"}refresh=${Date.now()}`
        : placesUrl;
      const response = await fetch(requestUrl, { method: config ? "GET" : manual ? "POST" : "GET", cache: "no-store" });
      const data = await response.json() as { places?: Place[] } & SyncMeta;
      if (!response.ok || !data.places?.length) throw new Error(data.syncError || "同期に失敗しました");
      setPlaces(data.places);
      setSelected((current) => data.places?.find((place) => place.id === current.id) ?? data.places![0]);
      setSyncMeta({ updatedAt: data.updatedAt, cached: data.cached, syncError: data.syncError, spotCount: data.spotCount });
      if (manual) {
        setToast(data.cached ? "通信に失敗したため、前回のデータを表示しています" : `${data.places.length}スポットを再同期しました`);
        window.setTimeout(() => setToast(""), 3000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "同期に失敗しました";
      setSyncMeta((current) => ({ ...current, syncError: message, cached: true }));
      if (manual) {
        setToast("再同期できませんでした。前回のデータを表示しています");
        window.setTimeout(() => setToast(""), 3000);
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { void loadPlaces(false); }, []);

  useEffect(() => {
    const config = staticConfig();
    if (config) {
      if (config.apiKey) {
        setMapsMapId(config.mapId ?? "");
        setMapsApiKey(config.apiKey);
      } else {
        setMapStatus("missing");
      }
      return;
    }
    fetch("/api/maps-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((config: { apiKey?: string; mapId?: string; configured?: boolean }) => {
        if (config.configured && config.apiKey) {
          setMapsMapId(config.mapId ?? "");
          setMapsApiKey(config.apiKey);
        } else {
          setMapStatus("missing");
        }
      })
      .catch(() => setMapStatus("error"));
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ja");
    return places.filter((place) => {
      const inCategory = category === "すべて" || place.category === category;
      const inSearch = !keyword || `${place.name} ${place.description}`.toLocaleLowerCase("ja").includes(keyword);
      return inCategory && inSearch;
    });
  }, [places, category, query]);

  const selectPlace = (place: Place, moveMap = true) => {
    setSelected(place);
    setMemoText((previous) => pickMemo(place.category, previous));
    if (moveMap) {
      mapRef.current?.panTo({ lat: place.lat, lng: place.lng });
      mapRef.current?.setZoom(17);
    }
  };

  useEffect(() => {
    setMemoText((previous) => pickMemo(selected.category, previous));
  }, [selected.id, selected.category]);

  useEffect(() => {
    if (!mapsApiKey || !mapNode.current) return;

    const renderMap = async () => {
      if (!mapNode.current || !window.google?.maps?.importLibrary) return;
      const [{ Map: GoogleMap, LatLngBounds }, { AdvancedMarkerElement: GoogleMarker }] = await Promise.all([
        window.google.maps.importLibrary("maps"),
        window.google.maps.importLibrary("marker"),
      ]);
      if (!mapNode.current) return;
      mapsLibraryRef.current = { LatLngBounds };
      markerConstructorRef.current = GoogleMarker;
      const markerContent = (url: string, size: number, glow = false) => {
        const image = document.createElement("img");
        image.src = url;
        image.width = size;
        image.height = size;
        image.alt = "";
        image.draggable = false;
        image.style.display = "block";
        image.style.width = size + "px";
        image.style.height = size + "px";
        image.style.objectFit = "contain";
        image.style.filter = glow ? "drop-shadow(0 0 10px rgba(255,255,255,.95)) drop-shadow(0 0 8px rgba(20,127,189,.8))" : "drop-shadow(0 2px 3px rgba(20,72,88,.22))";
        return image;
      };
      const mapOptions: Record<string, unknown> = {
        center: { lat: 34.1889, lng: 132.687 },
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        backgroundColor: "#a9ddf0",
        gestureHandling: "greedy",
      };
      if (mapsMapId) mapOptions.mapId = mapsMapId;
      else mapOptions.styles = myMapsInspiredStyle;
      const map = mapRef.current ?? new GoogleMap(mapNode.current, mapOptions);
      mapRef.current = map;
      clusterRef.current?.clearMarkers();
      markerRefs.current.forEach((marker) => { marker.map = null; });
      markerRefs.current = filtered.map((place) => {
        const marker = new GoogleMarker({
          position: { lat: place.lat, lng: place.lng },
          map,
          title: place.name,
          content: markerContent(markerAsset[place.category], selected.id === place.id ? 62 : 48, selected.id === place.id),
        });
        marker.__placeId = place.id;
        marker.__category = place.category;
        marker.addListener("click", () => selectPlace(place));
        return marker;
      });
      clusterRef.current = new MarkerClusterer({
        map,
        markers: markerRefs.current,
        renderer: {
         /*
         render: ({ count, position }) => {
           position,
           title: `${count}スポット`,
           zIndex: 1000 + count,
           icon: {
             url: assetPath("marker-blue.png"),
             scaledSize: new Size(68, 68),
             anchor: new Point(34, 34),
           },
           label: { text: String(count), color: "#ffffff", fontSize: "14px", fontWeight: "800" },
         }),
           */
           render: ({ count, position }) => {
            const clusterContent = document.createElement("div");
            clusterContent.style.position = "relative";
            clusterContent.style.width = "68px";
            clusterContent.style.height = "68px";
            clusterContent.style.filter = "drop-shadow(0 2px 4px rgba(20,72,88,.28))";
            clusterContent.append(markerContent(assetPath("marker-blue.png"), 68));
            const label = document.createElement("span");
            label.textContent = String(count);
            label.style.position = "absolute";
            label.style.inset = "0";
            label.style.display = "grid";
            label.style.placeItems = "center";
            label.style.color = "#fff";
            label.style.font = "800 14px system-ui, sans-serif";
            label.style.pointerEvents = "none";
            clusterContent.append(label);
            return new GoogleMarker({ position, title: String(count) + "スポット", zIndex: 1000 + count, content: clusterContent });
          },
        },
      });
      if (filtered.length) {
        const bounds = new LatLngBounds();
        filtered.forEach((place) => bounds.extend({ lat: place.lat, lng: place.lng }));
        if (filtered.length === 1) {
          map.setCenter({ lat: filtered[0].lat, lng: filtered[0].lng });
          map.setZoom(15);
        } else {
          map.fitBounds(bounds, 48);
        }
      }
      setMapStatus("ready");
    };

    if (window.google?.maps?.importLibrary) {
      void renderMap();
      return;
    }
    window.__akinadaMapReady = () => { void renderMap(); };
    if (!document.querySelector("script[data-akinada-map]")) {
      const script = document.createElement("script");
      script.dataset.akinadaMap = "true";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsApiKey)}&loading=async&callback=__akinadaMapReady&v=weekly&language=ja&region=JP`;
      script.async = true;
      script.onerror = () => setMapStatus("error");
      document.head.appendChild(script);
    }
  }, [filtered, mapsApiKey, mapsMapId]);

  useEffect(() => {
    const mapsLibrary = mapsLibraryRef.current;
    if (!mapsLibrary) return;
    markerRefs.current.forEach((marker) => {
      const active = marker.__placeId === selected.id;
      const size = active ? 62 : 48;
      /*
      marker.setIcon({
        url: markerAsset[marker.__category as Exclude<Category, "すべて">],
        scaledSize: new mapsLibrary.Size(size, size),
        anchor: new mapsLibrary.Point(size / 2, size / 2),
      });
      */
      const content = marker.content as HTMLElement | undefined;
      const image = content instanceof HTMLImageElement ? content : content?.querySelector("img");
      if (image instanceof HTMLImageElement) {
        image.width = size;
        image.height = size;
        image.style.width = size + "px";
        image.style.height = size + "px";
        image.style.filter = active
          ? "drop-shadow(0 0 10px rgba(255,255,255,.95)) drop-shadow(0 0 8px rgba(20,127,189,.8))"
          : "drop-shadow(0 2px 3px rgba(20,72,88,.22))";
      }
      marker.zIndex = active ? 999 : undefined;
    });
  }, [selected.id]);

  const openMiniApp = (appId: MiniAppId) => {
    setAppsMenuOpen(false);
    setAppLoaded(false);
    setAppSlow(false);
    setActiveAppId(appId);
  };

  useEffect(() => {
    if (!activeAppId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const slowTimer = window.setTimeout(() => setAppSlow(true), 6000);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveAppId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(slowTimer);
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeAppId]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setToast("この端末では現在地を利用できません");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const current = { lat: coords.latitude, lng: coords.longitude };
        mapRef.current?.panTo(current);
        mapRef.current?.setZoom(14);
        const GoogleMarker = markerConstructorRef.current;
        if (mapRef.current && GoogleMarker) {
          const currentDot = document.createElement("div");
          currentDot.style.width = "18px";
          currentDot.style.height = "18px";
          currentDot.style.borderRadius = "50%";
          currentDot.style.background = "#147fbd";
          currentDot.style.border = "3px solid #fff";
          currentDot.style.boxShadow = "0 1px 7px rgba(20,72,88,.45)";
          new GoogleMarker({
            content: currentDot,
            position: current,
            map: mapRef.current,
            title: "現在地",
            /*
            icon: {
              path: SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#147fbd",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 3,
            },
            */
          });
        }
        setLocating(false);
        setToast("現在地を表示しました");
        window.setTimeout(() => setToast(""), 2400);
      },
      () => {
        setLocating(false);
        setToast("現在地の利用を許可してください");
        window.setTimeout(() => setToast(""), 2600);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src={assetPath("akinada-logo.png")} alt="安芸灘しおり" className="brand-logo" />
          <div>
            <p className="eyebrow">AKINADA SHIORI</p>
            <h1>Digital Guide</h1>
            <p className="tagline">旅のしおりは、しおりちゃんにおまかせ♪</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="apps-menu-button" onClick={() => setAppsMenuOpen((open) => !open)} aria-label="しおりアプリ" aria-expanded={appsMenuOpen} aria-haspopup="menu">
            <span aria-hidden="true">▦</span><strong>しおりアプリ</strong>
          </button>
          <a className="official-link" href="https://shiorichan-guide.my.canva.site/" target="_blank" rel="noreferrer">
            公式サイト <span aria-hidden="true">↗</span>
          </a>
          {appsMenuOpen && (
            <div className="apps-menu" role="menu" aria-label="しおりアプリ">
              <p><strong>しおりアプリ</strong><small>旅に便利なミニアプリ</small></p>
              {miniApps.map((app) => (
                <button key={app.id} role="menuitem" onClick={() => openMiniApp(app.id)}>
                  <span className={`app-icon ${app.id}`} aria-hidden="true">{app.icon}</span>
                  <span><strong>{app.name}</strong><small>{app.description}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <section className="finder" aria-label="観光スポット検索">
        <label className="searchbox">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="行きたい場所を探す"
            aria-label="観光地を検索"
          />
          {query && <button onClick={() => setQuery("")} aria-label="検索をクリア">×</button>}
        </label>
        <div className="category-strip" role="list" aria-label="カテゴリー">
          {categories.map((item) => (
            <button
              key={item.name}
              className={category === item.name ? "category active" : "category"}
              onClick={() => setCategory(item.name)}
              aria-pressed={category === item.name}
            >
              <span>{item.icon}</span>{item.name}
            </button>
          ))}
        </div>
        <p className="result-count"><strong>{filtered.length}</strong> スポットを表示中</p>
      </section>

      <section className="guide-layout">
        <div className="map-panel">
          <div ref={mapNode} className="google-map" aria-label="安芸灘の観光地図" />
          {mapStatus !== "ready" && (
            <div className="fallback-map" aria-label="安芸灘観光地図プレビュー">
              <div className="map-sea-label">SETO INLAND SEA</div>
              <div className="island island-one"><span>下蒲刈島</span></div>
              <div className="island island-two"><span>上蒲刈島</span></div>
              <div className="bridge-line" />
              {filtered.slice(0, 18).map((place, index) => (
                <button
                  key={place.id}
                  className={`map-pin ${markerTone[place.category]} ${selected.id === place.id ? "selected" : ""}`}
                  style={{
                    left: `${16 + ((place.lng - 132.66) / 0.085) * 68}%`,
                    top: `${10 + (1 - (place.lat - 34.155) / 0.07) * 76}%`,
                  }}
                  onClick={() => selectPlace(place)}
                  aria-label={place.name}
                  title={place.name}
                >
                  <span>{index + 1}</span>
                </button>
              ))}
              <p className={`preview-note ${mapStatus === "error" ? "error" : ""}`}>
                {mapStatus === "loading" && "ライブGoogleマップを読み込んでいます…"}
                {mapStatus === "missing" && "Google Maps APIキーを .env に設定してください"}
                {mapStatus === "error" && "Googleマップを読み込めませんでした。APIキーの設定を確認してください"}
              </p>
            </div>
          )}
          <button className="locate-button" onClick={locateMe} disabled={locating}>
            <span aria-hidden="true">⌖</span>{locating ? "確認中…" : "現在地"}
          </button>
          <div className="map-legend"><span className="dot blue" />絶景・文化 <span className="dot coral" />歴史・神社 <span className="dot green" />グルメ・公園</div>
        </div>

        <aside className="detail-card" aria-live="polite">
          <div className="detail-photo">
            <img src={selected.image || assetPath("shiori-guide.png")} alt={selected.name} />
            <span className={`category-badge ${markerTone[selected.category]}`}>{selected.category}</span>
            <div className="photo-wash" />
          </div>
          <div className="detail-content">
            <p className="island-label">安芸灘とびしま海道</p>
            <h2>{selected.name}</h2>
            <p className="description">{selected.description || "しおりちゃんと一緒に、島の景色と物語を見つけに行きましょう。"}</p>
            <div className="detail-actions">
              <a className="primary-action" href={navUrl} target="_blank" rel="noreferrer"><span>➤</span>ここへ行く</a>
              {selected.youtube && <a className="video-action" href={selected.youtube} target="_blank" rel="noreferrer"><span>▶</span>動画を見る</a>}
            </div>
            <div className="mini-guide">
              <img src={assetPath("shiori-icon.png")} alt="しおりちゃん" />
              <p><strong>しおりちゃんメモ</strong><br /><span key={`${selected.id}-${memoText}`}>{memoText}</span></p>
            </div>
          </div>
        </aside>
      </section>

      <section className="spot-rail" aria-label="スポット一覧">
        <div className="rail-heading">
          <div><p className="eyebrow">SHIORI&apos;S PICKS</p><h2>しおりちゃんのおすすめ</h2></div>
          <p>カードを選ぶと地図と詳細が切り替わります</p>
        </div>
        <div className="spot-cards">
          {filtered.slice(0, 8).map((place) => (
            <button key={place.id} className={selected.id === place.id ? "spot-card active" : "spot-card"} onClick={() => selectPlace(place)}>
              <span className={`spot-icon ${markerTone[place.category]}`}>{place.category === "神社" ? "⛩" : place.category === "グルメ" ? "☕" : "✦"}</span>
              <span><small>{place.category}</small><strong>{place.name}</strong></span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </section>

      <footer>
        <img src={assetPath("shiori-guide.png")} alt="案内する安芸灘しおり" />
        <p><strong>瀬戸内から、あなたの旅にやさしい風を。</strong><br />Googleマイマップを管理元にした、安芸灘しおり公式デジタルガイド</p>
        <div className="sync-panel">
          <p className="sync-meta">
            <strong>Googleマイマップ連携</strong>
            <span>{syncMeta.updatedAt ? `最終同期：${new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(syncMeta.updatedAt))}` : "同期情報を確認中…"}</span>
            <span>{syncMeta.spotCount ?? places.length}スポット {syncMeta.cached ? "・キャッシュ表示" : "・最新データ"}</span>
            {syncMeta.syncError && <span className="sync-warning">取得失敗時も前回データを表示します</span>}
          </p>
          <button className="sync-button" onClick={() => void loadPlaces(true)} disabled={syncing}>
            {syncing ? "同期中…" : "マイマップを再同期"}
          </button>
          <a href="https://www.google.com/maps/d/viewer?mid=1TbtYyvz6fS9qpn43ZbrWi6NnRYDaVXs" target="_blank" rel="noreferrer">管理マップを見る ↗</a>
        </div>
      </footer>
      {activeApp && (
        <div className="mini-app-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setActiveAppId(null);
        }}>
          <section className={`mini-app-modal ${activeApp.id}`} role="dialog" aria-modal="true" aria-labelledby="mini-app-title">
            <div className="mini-app-head">
              <div><small>SHIORI APPS</small><h2 id="mini-app-title">{activeApp.name}</h2></div>
              <button onClick={() => setActiveAppId(null)} aria-label={`${activeApp.name}を閉じる`}>×</button>
            </div>
            <div className="mini-app-frame-wrap">
              {!appLoaded && <div className="mini-app-loading">{activeApp.name}を開いています…</div>}
              <iframe
                src={activeApp.url}
                title={activeApp.name}
                loading="eager"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => { setAppLoaded(true); setAppSlow(false); }}
              />
            </div>
            <div className="mini-app-fallback">
              <span>{appSlow ? "表示に時間がかかっています。" : "表示できない場合は"}</span>
              <a href={activeApp.url} target="_blank" rel="noreferrer">新しいタブで開く ↗</a>
            </div>
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
