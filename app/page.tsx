"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
};

declare global {
  interface Window {
    google?: any;
    __akinadaMapReady?: () => void;
  }
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

type MapStatus = "loading" | "missing" | "ready" | "error";

function calculateExpression(expression: string) {
  const normalized = expression.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  const parts = normalized.match(/(?:\d+\.?\d*|\.\d+|[+\-*/])/g);
  if (!parts || parts.join("") !== normalized || !/\d$/.test(normalized)) return null;
  const values: (number | string)[] = parts.map((part) => (/[+\-*/]/.test(part) ? part : Number(part)));
  for (let index = 1; index < values.length - 1;) {
    const operator = values[index];
    if (operator === "*" || operator === "/") {
      const left = Number(values[index - 1]);
      const right = Number(values[index + 1]);
      if (operator === "/" && right === 0) return null;
      values.splice(index - 1, 3, operator === "*" ? left * right : left / right);
      index = 1;
    } else {
      index += 2;
    }
  }
  let result = Number(values[0]);
  for (let index = 1; index < values.length; index += 2) {
    const operator = values[index];
    const right = Number(values[index + 1]);
    result = operator === "+" ? result + right : result - right;
  }
  return Number.isFinite(result) ? Math.round((result + Number.EPSILON) * 1e10) / 1e10 : null;
}

export default function Home() {
  const [places, setPlaces] = useState<Place[]>(fallbackPlaces);
  const [category, setCategory] = useState<Category>("すべて");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Place>(fallbackPlaces[0]);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState("");
  const [mapsApiKey, setMapsApiKey] = useState("");
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculation, setCalculation] = useState("0");
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);

  useEffect(() => {
    fetch("/api/places")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { places?: Place[] }) => {
        if (data.places?.length) setPlaces(data.places);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/maps-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((config: { apiKey?: string; configured?: boolean }) => {
        if (config.configured && config.apiKey) {
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

  useEffect(() => {
    if (!mapsApiKey || !mapNode.current) return;

    const renderMap = () => {
      if (!mapNode.current || !window.google) return;
      const map = mapRef.current ?? new window.google.maps.Map(mapNode.current, {
        center: { lat: 34.1889, lng: 132.687 },
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#3e7189" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#a9deeb" }] },
          { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4b91a9" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#edf6ef" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
          { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7093a2" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
      mapRef.current = map;
      markerRefs.current.forEach((marker) => marker.setMap(null));
      markerRefs.current = filtered.map((place) => {
        const marker = new window.google.maps.Marker({
          position: { lat: place.lat, lng: place.lng },
          map,
          title: place.name,
        });
        marker.addListener("click", () => setSelected(place));
        return marker;
      });
      if (filtered.length) {
        const bounds = new window.google.maps.LatLngBounds();
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

    if (window.google?.maps) {
      renderMap();
      return;
    }
    window.__akinadaMapReady = renderMap;
    if (!document.querySelector("script[data-akinada-map]")) {
      const script = document.createElement("script");
      script.dataset.akinadaMap = "true";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsApiKey)}&callback=__akinadaMapReady&v=weekly&language=ja&region=JP`;
      script.async = true;
      script.onerror = () => setMapStatus("error");
      document.head.appendChild(script);
    }
  }, [filtered, mapsApiKey]);

  const pressCalculator = (value: string) => {
    if (value === "C") {
      setCalculation("0");
      return;
    }
    if (value === "⌫") {
      setCalculation((current) => current.length > 1 ? current.slice(0, -1) : "0");
      return;
    }
    if (value === "=") {
      const result = calculateExpression(calculation);
      setCalculation(result === null ? "計算できません" : String(result));
      return;
    }
    setCalculation((current) => {
      const reset = current === "0" || current === "計算できません";
      if (/[+−×÷]/.test(value) && (reset || /[+−×÷]$/.test(current))) return current;
      return `${reset ? "" : current}${value}`.slice(0, 20);
    });
  };

  const choosePlace = (place: Place) => {
    setSelected(place);
    mapRef.current?.panTo({ lat: place.lat, lng: place.lng });
    mapRef.current?.setZoom(15);
  };

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
        if (mapRef.current && window.google) {
          new window.google.maps.Marker({
            position: current,
            map: mapRef.current,
            title: "現在地",
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#147fbd",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 3,
            },
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
          <img src="/akinada-logo.png" alt="安芸灘しおり" className="brand-logo" />
          <div>
            <p className="eyebrow">AKINADA SHIORI</p>
            <h1>Digital Guide</h1>
            <p className="tagline">旅のしおりは、しおりちゃんにおまかせ♪</p>
          </div>
        </div>
        <a className="official-link" href="https://shiorichan-guide.my.canva.site/" target="_blank" rel="noreferrer">
          公式サイト <span aria-hidden="true">↗</span>
        </a>
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
                  onClick={() => choosePlace(place)}
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
            <img src={selected.image || "/shiori-guide.png"} alt={selected.name} />
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
              <img src="/shiori-icon.png" alt="しおりちゃん" />
              <p><strong>しおりちゃんメモ</strong><br />島の道はゆっくり走ってね。気になる景色を見つけたら、ちょっと寄り道もおすすめ♪</p>
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
            <button key={place.id} className={selected.id === place.id ? "spot-card active" : "spot-card"} onClick={() => choosePlace(place)}>
              <span className={`spot-icon ${markerTone[place.category]}`}>{place.category === "神社" ? "⛩" : place.category === "グルメ" ? "☕" : "✦"}</span>
              <span><small>{place.category}</small><strong>{place.name}</strong></span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </section>

      <footer>
        <img src="/shiori-guide.png" alt="案内する安芸灘しおり" />
        <p><strong>瀬戸内から、あなたの旅にやさしい風を。</strong><br />Googleマイマップを管理元にした、安芸灘しおり公式デジタルガイド</p>
        <a href="https://www.google.com/maps/d/viewer?mid=1TbtYyvz6fS9qpn43ZbrWi6NnRYDaVXs" target="_blank" rel="noreferrer">管理マップを見る ↗</a>
      </footer>
      {mapStatus === "ready" && (
        <button className="calculator-launch" onClick={() => setCalculatorOpen(true)} aria-label="しおり電卓を開く">
          <span aria-hidden="true">♢</span>しおり電卓
        </button>
      )}
      {calculatorOpen && (
        <div className="calculator-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCalculatorOpen(false);
        }}>
          <section className="calculator" role="dialog" aria-modal="true" aria-labelledby="calculator-title">
            <div className="calculator-head">
              <div><small>SHIORI MINI APP</small><h2 id="calculator-title">しおり電卓</h2></div>
              <button onClick={() => setCalculatorOpen(false)} aria-label="しおり電卓を閉じる">×</button>
            </div>
            <output className="calculator-display" aria-live="polite">{calculation}</output>
            <div className="calculator-keys">
              {["C", "⌫", "÷", "×", "7", "8", "9", "−", "4", "5", "6", "+", "1", "2", "3", "=", "0", "."].map((key) => (
                <button
                  key={key}
                  className={`${/[+−×÷=]/.test(key) ? "operator" : ""} ${key === "0" ? "wide" : ""} ${key === "=" ? "equals" : ""}`}
                  onClick={() => pressCalculator(key)}
                >{key}</button>
              ))}
            </div>
            <p>旅の予算計算にも使ってね♪</p>
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
