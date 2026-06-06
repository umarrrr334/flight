import L from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

const tileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function MapFocus({ flight, userPosition }) {
  const map = useMap();
  useEffect(() => {
    if (!flight) return;
    if (flight.route) {
      map.flyToBounds([
        [flight.route.origin.latitude, flight.route.origin.longitude],
        [flight.lat, flight.lon],
        [flight.route.destination.latitude, flight.route.destination.longitude]
      ], { padding: [80, 80], maxZoom: 7, duration: 1.2 });
    } else {
      map.flyTo([flight.lat, flight.lon], Math.max(map.getZoom(), 8), { duration: 0.8 });
    }
  }, [flight?.icao24, flight?.route?.origin?.icao_code, flight?.route?.destination?.icao_code, map]);
  useEffect(() => {
    if (userPosition) map.flyTo(userPosition, 8, { duration: 1.2 });
  }, [map, userPosition]);
  return null;
}

function MapEvents({ onBoundsChange }) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds(), map.getZoom()),
    zoomend: () => onBoundsChange(map.getBounds(), map.getZoom())
  });
  useEffect(() => onBoundsChange(map.getBounds(), map.getZoom()), [map, onBoundsChange]);
  return null;
}

function aircraftIcon(flight, selected) {
  const pattern = flight.pattern ?? "cruising";
  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div class="plane-marker pattern-${pattern} ${selected ? "is-selected" : ""}" style="--heading:${flight.heading}deg">
      <span class="plane-shadow"></span><span class="plane-altitude-line"></span><span class="plane-thrust"></span>
      <span class="plane-ring ring-a"></span><span class="plane-ring ring-b"></span><span class="plane-scan"></span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-4.5l8 2.5Z"/></svg>
      <span class="plane-id">${flight.callsign}</span>
    </div>`
  });
}

function airportIcon(airport, type) {
  return L.divIcon({
    className: "",
    iconSize: [92, 92],
    iconAnchor: [46, 46],
    html: `<div class="airport-marker airport-${type}">
      <span class="airport-ring ring-one"></span><span class="airport-ring ring-two"></span>
      <span class="airport-grid"></span><span class="airport-sweep"></span>
      <span class="airport-beacon"></span><span class="airport-tower"></span>
      <b>${airport.iata_code || airport.icao_code}</b><small>${type}</small>
    </div>`
  });
}

function mapAirportIcon(airport) {
  const major = airport.type === "large_airport";
  const code = airport.iata || airport.icao || airport.ident;
  return L.divIcon({
    className: "",
    iconSize: major ? [150, 38] : [118, 30],
    iconAnchor: major ? [10, 19] : [8, 15],
    html: `<div class="map-airport ${airport.type}">
      <span><i></i><i></i><b>⌖</b></span>
      <label><strong>${code}</strong><small>${airport.name}</small></label>
    </div>`
  });
}

export default function RadarMap({ flights, selected, onSelect, trail, userPosition, onBoundsChange, showAllTrails, effectsEnabled, airports }) {
  const center = userPosition ?? [20.5937, 78.9629];
  const route = selected?.route;
  const routePositions = route ? [
    [route.origin.latitude, route.origin.longitude],
    [selected.lat, selected.lon],
    [route.destination.latitude, route.destination.longitude]
  ] : [];
  return (
    <MapContainer center={center} zoom={5} minZoom={3} zoomControl={false} worldCopyJump>
      <TileLayer
        attribution="&copy; OpenStreetMap &copy; CARTO"
        url={tileUrl}
        subdomains="abcd"
        maxZoom={20}
      />
      <MapFocus flight={selected} userPosition={userPosition} />
      <MapEvents onBoundsChange={onBoundsChange} />
      {userPosition && <>
        <Circle center={userPosition} radius={50000} pathOptions={{ color: "#53e6c4", weight: 1, opacity: .45, fillOpacity: .025, dashArray: "4 8" }} />
        <CircleMarker center={userPosition} radius={6} pathOptions={{ color: "#07100f", weight: 3, fillColor: "#53e6c4", fillOpacity: 1 }}>
          <Tooltip permanent direction="right" offset={[9, 0]}>Your live location</Tooltip>
        </CircleMarker>
      </>}
      {showAllTrails && flights.map((flight) => flight.trail?.length > 1 && (
        <Polyline key={`trail-${flight.icao24}`} positions={flight.trail.map((point) => [point.lat, point.lon])} pathOptions={{ color: flight.pattern === "climbing" ? "#53e6c4" : flight.pattern === "descending" ? "#ff9d5c" : "#82928d", weight: 1, opacity: .32 }} />
      ))}
      {trail.length > 1 && (
        <Polyline positions={trail.map((point) => [point.lat, point.lon])} pathOptions={{ color: "#b8ff4a", weight: 2, opacity: 0.8, dashArray: "3 8" }} />
      )}
      {routePositions.length > 0 && <>
        <Polyline className="route-glow" positions={routePositions} pathOptions={{ color: "#53e6c4", weight: 7, opacity: .12 }} />
        <Polyline className="route-energy" positions={routePositions} pathOptions={{ color: "#b8ff4a", weight: 2, opacity: .8, dashArray: "4 14" }} />
        <Marker position={routePositions[0]} icon={airportIcon(route.origin, "origin")}><Tooltip direction="top" offset={[0, -42]}>{route.origin.name}</Tooltip></Marker>
        <Marker position={routePositions[2]} icon={airportIcon(route.destination, "destination")}><Tooltip direction="top" offset={[0, -42]}>{route.destination.name}</Tooltip></Marker>
      </>}
      {airports.map((airport) => (
        <Marker key={airport.ident} position={[airport.lat, airport.lon]} icon={mapAirportIcon(airport)} zIndexOffset={-500}>
          <Tooltip direction="top" offset={[0, -12]}>{airport.name} · {airport.municipality || airport.country}</Tooltip>
        </Marker>
      ))}
      {flights.map((flight) => (
        <Marker
          key={flight.icao24}
          position={[flight.lat, flight.lon]}
          icon={aircraftIcon(flight, flight.icao24 === selected?.icao24)}
          eventHandlers={{ click: () => onSelect(flight) }}
        />
      ))}
    </MapContainer>
  );
}
