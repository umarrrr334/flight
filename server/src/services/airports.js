const DATA_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
let airports = [];
let loadedAt = null;

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

export async function loadAirports() {
  const response = await fetch(DATA_URL, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`OurAirports request failed (${response.status})`);
  const lines = (await response.text()).split(/\r?\n/);
  const headers = parseCsvLine(lines.shift());
  airports = lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    return {
      ident: row.ident,
      type: row.type,
      name: row.name,
      lat: Number(row.latitude_deg),
      lon: Number(row.longitude_deg),
      elevation: Number(row.elevation_ft) || null,
      municipality: row.municipality,
      country: row.iso_country,
      icao: row.gps_code || row.ident,
      iata: row.iata_code || null
    };
  }).filter((airport) =>
    Number.isFinite(airport.lat) && Number.isFinite(airport.lon) &&
    !["closed", "heliport", "balloonport"].includes(airport.type));
  loadedAt = new Date().toISOString();
}

export function findAirports({ south, west, north, east, zoom = 5 }) {
  const allowedTypes = zoom < 5
    ? new Set(["large_airport"])
    : zoom < 8
      ? new Set(["large_airport", "medium_airport"])
      : new Set(["large_airport", "medium_airport", "small_airport", "seaplane_base"]);
  return airports.filter((airport) =>
    allowedTypes.has(airport.type) &&
    airport.lat >= south && airport.lat <= north &&
    airport.lon >= west && airport.lon <= east
  ).slice(0, 1200);
}

export function getAirportStatus() {
  return { count: airports.length, loadedAt };
}
