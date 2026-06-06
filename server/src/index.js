import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDemoFlights } from "./data/demoFlights.js";
import { getCachedRoute, getRoute, warmRoutes } from "./services/adsbdb.js";
import { findAirports, getAirportStatus, loadAirports } from "./services/airports.js";
import { fetchOpenSkyFlights } from "./services/opensky.js";

const port = Number(process.env.PORT || 4000);
const origin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const pollInterval = Math.max(Number(process.env.POLL_INTERVAL_MS || 15000), 10000);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin } });

app.use(cors({ origin }));
app.use(express.json());
app.disable("x-powered-by");

let flights = [];
let history = new Map();
let source = "starting";
let lastUpdated = null;
let lastError = null;
let tick = 0;
let pollInProgress = false;

function rememberPositions(nextFlights) {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const flight of nextFlights) {
    const trail = history.get(flight.icao24) ?? [];
    trail.push({ lat: flight.lat, lon: flight.lon, altitude: flight.altitude, at: Date.now() });
    history.set(flight.icao24, trail.slice(-30));
  }
  for (const [icao24, trail] of history) {
    if (!trail.length || trail.at(-1).at < cutoff) history.delete(icao24);
  }
}

async function poll() {
  if (pollInProgress) return;
  pollInProgress = true;
  try {
    flights = await fetchOpenSkyFlights();
    source = "opensky";
    lastError = null;
  } catch (error) {
    flights = createDemoFlights(tick++);
    source = "demo";
    lastError = error.message;
  } finally {
    pollInProgress = false;
  }
  lastUpdated = new Date().toISOString();
  rememberPositions(flights);
  io.emit("flights:update", { source, lastUpdated, count: flights.length });
}

app.get("/api/health", (_req, res) => res.json({ ok: true, source, lastUpdated, lastError, airports: getAirportStatus() }));

app.get("/api/airports", (req, res) => {
  const { lamin, lomin, lamax, lomax, zoom } = req.query;
  const valid = [lamin, lomin, lamax, lomax].every((value) => Number.isFinite(Number(value)));
  if (!valid) return res.status(400).json({ message: "Valid map bounds are required." });
  if (Number(lamin) < -90 || Number(lamax) > 90 || Number(lomin) < -180 || Number(lomax) > 180) {
    return res.status(400).json({ message: "Map bounds are outside valid latitude or longitude ranges." });
  }
  const visible = findAirports({
    south: Number(lamin), west: Number(lomin), north: Number(lamax), east: Number(lomax), zoom: Number(zoom)
  });
  res.set("Cache-Control", "public, max-age=300");
  return res.json({ airports: visible, count: visible.length, source: "OurAirports" });
});

app.get("/api/flights/live", (req, res) => {
  const { lamin, lomin, lamax, lomax } = req.query;
  const includeTrails = req.query.trails === "true";
  const hasBounds = [lamin, lomin, lamax, lomax].every((value) => Number.isFinite(Number(value)));
  const visible = hasBounds
    ? flights.filter((flight) =>
        flight.lat >= Number(lamin) && flight.lat <= Number(lamax) &&
        flight.lon >= Number(lomin) && flight.lon <= Number(lomax))
    : flights;
  const limited = visible.slice(0, 1500).map((flight) => ({
    ...flight,
    route: getCachedRoute(flight.callsign),
    ...(includeTrails ? { trail: history.get(flight.icao24) ?? [] } : {})
  }));
  warmRoutes(visible).catch(() => {});
  res.json({ flights: limited, count: visible.length, source, lastUpdated, lastError });
});

app.get("/api/flights/:icao24", async (req, res) => {
  const flight = flights.find((item) => item.icao24 === req.params.icao24);
  if (!flight) return res.status(404).json({ message: "Aircraft not found in current live data." });
  const route = await getRoute(flight.callsign);
  return res.json({ ...flight, route, trail: history.get(flight.icao24) ?? [] });
});

app.get("/api/flights/:icao24/history", (req, res) => {
  res.json({ icao24: req.params.icao24, positions: history.get(req.params.icao24) ?? [] });
});

app.get("/api", (_req, res) => res.json({
  name: "SkyRadar API",
  version: "1.0.0",
  endpoints: ["/api/health", "/api/flights/live", "/api/flights/:icao24", "/api/airports", "/api/analytics/summary"]
}));

app.get("/api/analytics/summary", (_req, res) => {
  const airborne = flights.filter((flight) => !flight.onGround);
  const average = (key) => airborne.length
    ? airborne.reduce((sum, flight) => sum + flight[key], 0) / airborne.length
    : 0;
  const countries = Object.entries(flights.reduce((acc, flight) => {
    acc[flight.country] = (acc[flight.country] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  res.json({
    total: flights.length,
    airborne: airborne.length,
    averageAltitude: average("altitude"),
    averageVelocity: average("velocity"),
    fastest: [...airborne].sort((a, b) => b.velocity - a.velocity)[0] ?? null,
    countries,
    source,
    lastUpdated
  });
});

if (process.env.NODE_ENV === "production") {
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  app.use(express.static(publicDir));
  app.get("*splat", (_req, res) => res.sendFile(join(publicDir, "index.html")));
}

io.on("connection", (socket) => socket.emit("flights:update", { source, lastUpdated, count: flights.length }));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "An unexpected server error occurred." });
});

await poll();
loadAirports().catch((error) => console.warn(`Airport data unavailable: ${error.message}`));
setInterval(poll, pollInterval);
httpServer.listen(port, () => console.log(`SkyRadar server listening on http://localhost:${port}`));

function shutdown(signal) {
  console.log(`${signal} received, shutting down SkyRadar.`);
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
