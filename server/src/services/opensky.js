const API_URL = "https://opensky-network.org/api/states/all";
const TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

let accessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  if (!response.ok) throw new Error(`OpenSky authentication failed (${response.status})`);
  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 30) * 1000;
  return accessToken;
}

function parseState(state) {
  return {
    icao24: state[0],
    callsign: state[1]?.trim() || "UNKNOWN",
    country: state[2],
    lastContact: state[4],
    lon: state[5],
    lat: state[6],
    altitude: state[7] ?? state[13] ?? 0,
    onGround: state[8],
    velocity: state[9] ?? 0,
    heading: state[10] ?? 0,
    verticalRate: state[11] ?? 0,
    squawk: state[14] ?? null,
    source: "opensky"
  };
}

export async function fetchOpenSkyFlights() {
  const token = await getAccessToken();
  const response = await fetch(API_URL, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`OpenSky request failed (${response.status})`);
  const payload = await response.json();
  return (payload.states ?? [])
    .filter((state) => state[5] != null && state[6] != null)
    .map(parseState);
}
