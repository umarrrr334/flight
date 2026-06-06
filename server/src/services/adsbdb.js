const API_URL = "https://api.adsbdb.com/v0";
const routeCache = new Map();
const pending = new Map();
const POSITIVE_TTL = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL = 60 * 60 * 1000;

function cleanCallsign(callsign) {
  return callsign?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cachedRoute(callsign) {
  const item = routeCache.get(callsign);
  if (!item || item.expiresAt < Date.now()) return undefined;
  return item.route;
}

export async function getRoute(callsign) {
  const clean = cleanCallsign(callsign);
  if (!clean || clean === "UNKNOWN") return null;
  const cached = cachedRoute(clean);
  if (cached !== undefined) return cached;
  if (pending.has(clean)) return pending.get(clean);

  const request = fetch(`${API_URL}/callsign/${encodeURIComponent(clean)}`, {
    signal: AbortSignal.timeout(6000)
  }).then(async (response) => {
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.response?.flightroute ?? null;
  }).catch(() => null).then((route) => {
    routeCache.set(clean, {
      route,
      expiresAt: Date.now() + (route ? POSITIVE_TTL : NEGATIVE_TTL)
    });
    pending.delete(clean);
    return route;
  });
  pending.set(clean, request);
  return request;
}

export function getCachedRoute(callsign) {
  return cachedRoute(cleanCallsign(callsign)) ?? null;
}

export async function warmRoutes(flights, limit = 120) {
  const unresolved = flights
    .filter((flight) => !flight.route && flight.callsign !== "UNKNOWN" && cachedRoute(cleanCallsign(flight.callsign)) === undefined)
    .slice(0, limit);
  if (unresolved.length === 0) return 0;
  for (let index = 0; index < unresolved.length; index += 8) {
    await Promise.all(unresolved.slice(index, index + 8).map((flight) => getRoute(flight.callsign)));
  }
  return unresolved.length;
}
