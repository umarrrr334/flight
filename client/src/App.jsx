import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Building2, ChevronRight, Crosshair, Gauge,
  LocateFixed, MapPin, Orbit, Plane, Radio, RefreshCw, Route, Search, SlidersHorizontal, Wifi, X
} from "lucide-react";
import { io } from "socket.io-client";
import RadarMap from "./components/RadarMap.jsx";

const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_BASE_URL;
const apiUrl = (path) => `${API_BASE_URL}${path}`;
const toFeet = (meters) => meters * 3.28084;
const toKnots = (mps) => mps * 1.94384;
const getPattern = (flight) => flight.onGround ? "ground" : flight.verticalRate > 2 ? "climbing" : flight.verticalRate < -2 ? "descending" : "cruising";
const airportCode = (airport) => airport?.iata_code || airport?.iata || airport?.icao_code || airport?.icao || airport?.ident || "---";
const airportCity = (airport) => airport?.municipality || airport?.city || airport?.country_name || "Unknown";
const airportName = (airport) => airport?.name || "Airport information unavailable";
const hasRoute = (flight) => Boolean(flight.route?.origin && flight.route?.destination);
const routeLabel = (flight) => hasRoute(flight) ? `${airportCode(flight.route.origin)} ${airportCode(flight.route.destination)} ${airportCity(flight.route.origin)} ${airportCity(flight.route.destination)}` : "";

function Metric({ label, value, unit, icon: Icon }) {
  return (
    <div className="metric">
      <span className="metric-icon"><Icon size={15} /></span>
      <div><small>{label}</small><strong>{value}<em>{unit}</em></strong></div>
    </div>
  );
}

function FlightCard({ flight, selected, onClick }) {
  const routeReady = hasRoute(flight);
  const origin = airportCode(flight.route?.origin);
  const destination = airportCode(flight.route?.destination);
  return (
    <button className={`flight-card ${selected ? "selected" : ""} ${routeReady ? "has-route" : ""}`} onClick={onClick}>
      <div className="flight-card-top">
        <span className="flight-ident"><Plane size={14} /> {flight.callsign}</span>
        <span className="live-dot">LIVE</span>
      </div>
      <div className="flight-route">
        <strong>{origin}</strong>
        <span><i /><Plane size={13} /><i /></span>
        <strong>{destination}</strong>
      </div>
      <div className="route-name">{routeReady ? `${airportCity(flight.route.origin)} to ${airportCity(flight.route.destination)}` : "Resolving origin and destination..."}</div>
      <div className="flight-card-meta">
        <span>ALT <b>{formatter.format(toFeet(flight.altitude))} ft</b></span>
        <span>SPD <b>{formatter.format(toKnots(flight.velocity))} kt</b></span>
      </div>
    </button>
  );
}

export default function App() {
  const [flights, setFlights] = useState([]);
  const [source, setSource] = useState("connecting");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [trail, setTrail] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [airborneOnly, setAirborneOnly] = useState(true);
  const [mobileList, setMobileList] = useState(false);
  const [bounds, setBounds] = useState(null);
  const [pattern, setPattern] = useState("all");
  const [showAllTrails, setShowAllTrails] = useState(false);
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [airports, setAirports] = useState([]);
  const [movingFlights, setMovingFlights] = useState([]);
  const [showAirports, setShowAirports] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => setUserPosition([coords.latitude, coords.longitude]),
      () => setUserPosition((current) => current ?? [12.9716, 77.5946]),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!bounds) return;
    const controller = new AbortController();
    const loadVisibleFlights = () => {
      const params = new URLSearchParams({
        lamin: bounds.south, lomin: bounds.west, lamax: bounds.north, lomax: bounds.east,
        trails: String(showAllTrails)
      });
      setLoading(true);
      fetch(apiUrl(`/api/flights/live?${params}`), { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error("Live flight service is unavailable.");
        return res.json();
      }).then((data) => {
        setFlights((current) => {
          const knownRoutes = new Map(current.filter((flight) => flight.route).map((flight) => [flight.icao24, flight.route]));
          return data.flights.map((flight) => ({
            ...flight,
            route: flight.route ?? knownRoutes.get(flight.icao24) ?? null,
            pattern: getPattern(flight)
          }));
        });
        setSource(data.source); setLastUpdated(data.lastUpdated); setError("");
      }).catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setSource("offline");
          setError(requestError.message);
        }
      }).finally(() => setLoading(false));
    };
    loadVisibleFlights();
    return () => controller.abort();
  }, [bounds, showAllTrails, refreshSignal]);

  useEffect(() => {
    const socket = io(SOCKET_URL || undefined);
    socket.on("flights:update", () => setRefreshSignal((value) => value + 1));
    socket.on("connect_error", () => setError("Real-time connection interrupted. Retrying automatically."));
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const move = () => {
      const now = Date.now() / 1000;
      setMovingFlights(flights.map((flight) => {
        if (flight.onGround || !flight.velocity) return flight;
        const seconds = Math.min(Math.max(now - flight.lastContact, 0), 25);
        const distance = flight.velocity * seconds;
        const heading = flight.heading * Math.PI / 180;
        const lat = flight.lat + Math.cos(heading) * distance / 111320;
        const lonScale = Math.max(Math.cos(flight.lat * Math.PI / 180), .15);
        const lon = flight.lon + Math.sin(heading) * distance / (111320 * lonScale);
        return { ...flight, lat, lon, estimated: seconds > 1 };
      }));
    };
    move();
    const timer = setInterval(move, 250);
    return () => clearInterval(timer);
  }, [flights]);

  useEffect(() => {
    if (!bounds || !showAirports) {
      setAirports([]);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      lamin: bounds.south, lomin: bounds.west, lamax: bounds.north, lomax: bounds.east, zoom: bounds.zoom
    });
    fetch(apiUrl(`/api/airports?${params}`), { signal: controller.signal }).then((res) => res.json()).then((data) => setAirports(data.airports ?? [])).catch((requestError) => {
      if (requestError.name !== "AbortError") setAirports([]);
    });
    return () => controller.abort();
  }, [bounds, showAirports]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!selected) return setTrail([]);
    fetch(apiUrl(`/api/flights/${selected.icao24}/history`)).then((res) => res.json()).then((data) => setTrail(data.positions));
  }, [selected?.icao24, lastUpdated]);

  useEffect(() => {
    if (!selected) return;
    const current = movingFlights.find((flight) => flight.icao24 === selected.icao24);
    if (current) setSelected((previous) => ({ ...previous, ...current, route: current.route ?? previous.route }));
  }, [movingFlights]);

  const handleBoundsChange = useCallback((next, zoom) => setBounds({
    south: next.getSouth(),
    west: next.getWest(),
    north: next.getNorth(),
    east: next.getEast(),
    zoom
  }), []);

  const visibleFlights = useMemo(() => movingFlights.filter((flight) => {
    const text = `${flight.callsign} ${flight.country} ${flight.icao24} ${routeLabel(flight)}`.toLowerCase();
    return (!airborneOnly || !flight.onGround) && (pattern === "all" || flight.pattern === pattern) && text.includes(query.toLowerCase());
  }), [movingFlights, airborneOnly, pattern, query]);

  const stats = useMemo(() => {
    const flying = flights.filter((f) => !f.onGround);
    const avgAlt = flying.reduce((sum, f) => sum + f.altitude, 0) / (flying.length || 1);
    const avgSpeed = flying.reduce((sum, f) => sum + f.velocity, 0) / (flying.length || 1);
    return { count: flying.length, avgAlt, avgSpeed };
  }, [flights]);

  const locate = () => navigator.geolocation?.getCurrentPosition(
    ({ coords }) => setUserPosition([coords.latitude, coords.longitude]),
    () => setUserPosition([12.9716, 77.5946])
  );

  const selectFlight = async (flight) => {
    setSelected(flight);
    try {
      const response = await fetch(apiUrl(`/api/flights/${flight.icao24}`));
      if (response.ok) {
        const details = await response.json();
        setSelected({ ...details, pattern: getPattern(details) });
        setTrail(details.trail ?? []);
        setFlights((current) => current.map((item) => item.icao24 === details.icao24 ? { ...item, route: details.route } : item));
      }
    } catch {
      // Keep the live state visible when enrichment is unavailable.
    }
  };

  return (
    <main>
      <header>
        <div className="brand"><span><Plane size={20} /></span><div><b>SKYRADAR</b><small>LIVE AIRSPACE INTELLIGENCE</small></div></div>
        <div className="system-status"><i /> SYSTEM ONLINE <span>{source === "opensky" ? "LIVE ADS-B" : "DEMO FEED"}</span></div>
        <nav><button title="Refresh live data" onClick={() => setRefreshSignal((value) => value + 1)}><RefreshCw size={17} /></button><div className="avatar">CS</div></nav>
      </header>

      <section className="workspace">
        <aside className={`sidebar ${mobileList ? "mobile-open" : ""}`}>
          <div className="sidebar-aura" />
          <div className="panel-heading">
            <div><span className="eyebrow">AIRSPACE MONITOR</span><h1>Aircraft nearby</h1></div>
            <button className="mobile-close" onClick={() => setMobileList(false)}><X size={18} /></button>
          </div>
          <label className="search"><Search size={16} /><input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search callsign, country, ICAO..." /><kbd>Ctrl K</kbd></label>
          <div className="filter-row">
            <button className={airborneOnly ? "active" : ""} onClick={() => setAirborneOnly(!airborneOnly)}><SlidersHorizontal size={14} /> Airborne</button>
            <span>{visibleFlights.length} results</span>
          </div>
          <div className="pattern-filters">
            {["all", "cruising", "climbing", "descending", "ground"].map((item) => <button key={item} className={pattern === item ? "active" : ""} onClick={() => setPattern(item)}>{item}</button>)}
          </div>
          <div className="flight-list">
            {loading && flights.length === 0 && <div className="list-state"><RefreshCw className="spin" size={18} /> Acquiring live aircraft...</div>}
            {!loading && visibleFlights.length === 0 && <div className="list-state"><Plane size={18} /> No aircraft match this view and filter.</div>}
            {visibleFlights.slice(0, 100).map((flight) => <FlightCard key={flight.icao24} flight={flight} selected={selected?.icao24 === flight.icao24} onClick={() => selectFlight(flight)} />)}
          </div>
          <div className="sidebar-footer"><Radio size={14} /> Next sweep in ~15 sec <span>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "--:--"}</span></div>
        </aside>

        <section className={`map-shell ${effectsEnabled ? "effects-on" : ""}`}>
          <RadarMap flights={visibleFlights} selected={selected} onSelect={selectFlight} trail={trail} userPosition={userPosition} onBoundsChange={handleBoundsChange} showAllTrails={showAllTrails} effectsEnabled={effectsEnabled} airports={airports} />
          {effectsEnabled && (
            <div className="cinematic-fx" aria-hidden="true">
              <div className="aurora-field" />
              <div className="starfield">
                {Array.from({ length: 24 }, (_, index) => (
                  <i key={index} style={{ "--i": index, "--x": (index * 37) % 100, "--y": (index * 61) % 100 }} />
                ))}
              </div>
              <div className="projection-grid"><i /><i /><i /><i /></div>
              <div className="orbital-rings"><i /><i /><i /></div>
              <div className="signal-columns"><i /><i /><i /><i /><i /></div>
            </div>
          )}
          <div className="map-vignette" />
          {effectsEnabled && <><div className="hologram-overlay"><div className="radar-disc"><i /><i /><i /><span /><b /><em /></div><div className="holo-reticle"><i /><i /><i /></div><div className="scanlines" /><div className="glitch-slice one" /><div className="glitch-slice two" /><div className="hud-corner tl" /><div className="hud-corner tr" /><div className="hud-corner bl" /><div className="hud-corner br" /></div><div className="hologram-map-label"><span>HOLOGRAPHIC AIRSPACE</span><b>LIVE VECTOR FIELD</b></div></>}
          {error && <div className="error-banner"><AlertTriangle size={14} /> {error}<button onClick={() => setRefreshSignal((value) => value + 1)}>Retry</button></div>}
          <div className="map-top">
            <div className="data-pill"><Wifi size={13} /> {source === "opensky" ? "OPENSKY NETWORK" : source === "demo" ? "SIMULATED FALLBACK" : "CONNECTING"} <b>{visibleFlights.length} flights - {airports.length} airports</b></div>
            <div className="layer-buttons">
              <button className={`layers ${showAirports ? "active" : ""}`} onClick={() => setShowAirports(!showAirports)}><Building2 size={16} /> Airports</button>
              <button className={`layers ${showAllTrails ? "active" : ""}`} onClick={() => setShowAllTrails(!showAllTrails)}><Route size={16} /> Flight paths</button>
            </div>
          </div>
          <div className="map-tools">
            <button onClick={locate} title="Locate me"><LocateFixed size={18} /></button>
            <button title="Center selected" onClick={() => selected && setSelected({ ...selected })}><Crosshair size={18} /></button>
            <button className={effectsEnabled ? "active" : ""} title="Toggle holographic effects" onClick={() => setEffectsEnabled(!effectsEnabled)}><Orbit size={18} /></button>
          </div>
          <button className="mobile-list-button" onClick={() => setMobileList(true)}><Plane size={16} /> {visibleFlights.length} aircraft</button>

          <div className="stats-strip">
            <Metric icon={Activity} label="AIRBORNE NOW" value={formatter.format(stats.count)} unit="flights" />
            <Metric icon={Gauge} label="AVG. ALTITUDE" value={formatter.format(toFeet(stats.avgAlt))} unit="ft" />
            <Metric icon={Plane} label="AVG. SPEED" value={formatter.format(toKnots(stats.avgSpeed))} unit="kt" />
          </div>
          <div className="map-legend"><span><i className="cruising" />Cruising</span><span><i className="climbing" />Climbing</span><span><i className="descending" />Descending</span><span><i className="airport" />Airport</span></div>

          {selected && (
            <article className="detail-card">
              <button className="detail-close" onClick={() => setSelected(null)}><X size={15} /></button>
              <div className="detail-kicker"><span><i /> TRACKING</span> ICAO - {selected.icao24.toUpperCase()} {selected.estimated && <b>INTERPOLATED</b>}</div>
              <div className="detail-title"><div className="big-plane"><Plane size={22} /></div><div><h2>{selected.callsign}</h2><p>{selected.country}</p></div><ChevronRight size={17} /></div>
              <div className={`pattern-badge ${selected.pattern}`}>{selected.pattern} flight pattern</div>
              {hasRoute(selected) ? (
                <div className="route-detail">
                  <div><span>ORIGIN</span><strong>{airportCode(selected.route.origin)}</strong><p>{airportName(selected.route.origin)}</p><small>{airportCity(selected.route.origin)}, {selected.route.origin.country_name ?? selected.route.origin.country ?? "Unknown"}</small></div>
                  <Plane size={17} />
                  <div><span>DESTINATION</span><strong>{airportCode(selected.route.destination)}</strong><p>{airportName(selected.route.destination)}</p><small>{airportCity(selected.route.destination)}, {selected.route.destination.country_name ?? selected.route.destination.country ?? "Unknown"}</small></div>
                  <footer>{selected.route.airline?.name ?? "Airline unavailable"} - {selected.route.callsign_iata ?? selected.callsign}</footer>
                </div>
              ) : <div className="route-unavailable">Origin and destination are not published for this callsign.</div>}
              <div className="detail-grid">
                <div><span>ALTITUDE</span><strong>{formatter.format(toFeet(selected.altitude))}<small> ft</small></strong></div>
                <div><span>GROUND SPEED</span><strong>{formatter.format(toKnots(selected.velocity))}<small> kt</small></strong></div>
                <div><span>HEADING</span><strong>{selected.heading.toFixed(0)}<small> deg</small></strong></div>
                <div><span>VERTICAL RATE</span><strong>{selected.verticalRate > 0 ? "+" : ""}{formatter.format(selected.verticalRate * 196.85)}<small> ft/m</small></strong></div>
              </div>
              <div className="coordinates"><MapPin size={14} /> {selected.lat.toFixed(4)}, {selected.lon.toFixed(4)} <span>{trail.length} trail points</span></div>
            </article>
          )}
        </section>
      </section>
    </main>
  );
}
