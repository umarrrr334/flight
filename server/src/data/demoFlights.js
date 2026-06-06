const seeds = [
  ["a1b2c3", "IGO613", "India", 77.52, 12.94, 9450, 242, 18],
  ["a1b2c4", "AIC505", "India", 77.21, 13.18, 7620, 218, 142],
  ["a1b2c5", "UAE568", "United Arab Emirates", 76.88, 12.61, 10980, 271, 103],
  ["a1b2c6", "QTR573", "Qatar", 77.92, 13.42, 11580, 284, 228],
  ["a1b2c7", "VTI811", "India", 77.04, 12.78, 4260, 176, 62],
  ["a1b2c8", "SIA510", "Singapore", 78.11, 12.42, 10320, 263, 311],
  ["a1b2c9", "AXB145", "India", 76.71, 13.02, 6120, 201, 87],
  ["a1b2ca", "BAW119", "United Kingdom", 77.37, 13.63, 12180, 294, 191],
  ["a1b2cb", "SLK443", "Sri Lanka", 77.73, 12.24, 8820, 231, 344],
  ["a1b2cc", "THA325", "Thailand", 78.32, 13.16, 11240, 278, 256],
  ["a1b2cd", "IGO897", "India", 76.53, 12.41, 5340, 192, 31],
  ["a1b2ce", "AIC804", "India", 78.01, 13.81, 9870, 248, 216]
];

const airports = {
  BLR: { iata_code: "BLR", icao_code: "VOBL", name: "Kempegowda International Airport", municipality: "Bengaluru", country_name: "India", latitude: 13.1986, longitude: 77.7066 },
  BOM: { iata_code: "BOM", icao_code: "VABB", name: "Chhatrapati Shivaji Maharaj International Airport", municipality: "Mumbai", country_name: "India", latitude: 19.0896, longitude: 72.8656 },
  CCU: { iata_code: "CCU", icao_code: "VECC", name: "Netaji Subhas Chandra Bose International Airport", municipality: "Kolkata", country_name: "India", latitude: 22.6547, longitude: 88.4467 },
  CMB: { iata_code: "CMB", icao_code: "VCBI", name: "Bandaranaike International Airport", municipality: "Colombo", country_name: "Sri Lanka", latitude: 7.1808, longitude: 79.8841 },
  DEL: { iata_code: "DEL", icao_code: "VIDP", name: "Indira Gandhi International Airport", municipality: "Delhi", country_name: "India", latitude: 28.5562, longitude: 77.1 },
  DOH: { iata_code: "DOH", icao_code: "OTHH", name: "Hamad International Airport", municipality: "Doha", country_name: "Qatar", latitude: 25.2731, longitude: 51.6081 },
  DXB: { iata_code: "DXB", icao_code: "OMDB", name: "Dubai International Airport", municipality: "Dubai", country_name: "United Arab Emirates", latitude: 25.2532, longitude: 55.3657 },
  HYD: { iata_code: "HYD", icao_code: "VOHS", name: "Rajiv Gandhi International Airport", municipality: "Hyderabad", country_name: "India", latitude: 17.2313, longitude: 78.4299 },
  LHR: { iata_code: "LHR", icao_code: "EGLL", name: "Heathrow Airport", municipality: "London", country_name: "United Kingdom", latitude: 51.47, longitude: -0.4543 },
  MAA: { iata_code: "MAA", icao_code: "VOMM", name: "Chennai International Airport", municipality: "Chennai", country_name: "India", latitude: 12.9941, longitude: 80.1709 },
  SIN: { iata_code: "SIN", icao_code: "WSSS", name: "Singapore Changi Airport", municipality: "Singapore", country_name: "Singapore", latitude: 1.3644, longitude: 103.9915 },
  BKK: { iata_code: "BKK", icao_code: "VTBS", name: "Suvarnabhumi Airport", municipality: "Bangkok", country_name: "Thailand", latitude: 13.69, longitude: 100.7501 }
};

const routes = {
  IGO613: ["BLR", "DEL", "IndiGo"],
  AIC505: ["DEL", "BLR", "Air India"],
  UAE568: ["DXB", "BLR", "Emirates"],
  QTR573: ["BLR", "DOH", "Qatar Airways"],
  VTI811: ["HYD", "BLR", "Vistara"],
  SIA510: ["SIN", "BLR", "Singapore Airlines"],
  AXB145: ["BLR", "BOM", "Air India Express"],
  BAW119: ["LHR", "BLR", "British Airways"],
  SLK443: ["CMB", "BLR", "SriLankan Airlines"],
  THA325: ["BKK", "BLR", "Thai Airways"],
  IGO897: ["BLR", "CCU", "IndiGo"],
  AIC804: ["MAA", "BLR", "Air India"]
};

function demoRoute(callsign) {
  const route = routes[callsign];
  if (!route) return null;
  const [origin, destination, airline] = route;
  return {
    callsign,
    callsign_iata: callsign,
    airline: { name: airline },
    origin: airports[origin],
    destination: airports[destination]
  };
}

export function createDemoFlights(tick = 0) {
  return seeds.map(([icao24, callsign, country, lon, lat, altitude, velocity, heading], index) => {
    const distance = tick * velocity * 0.0000015;
    const radians = (heading * Math.PI) / 180;
    return {
      icao24,
      callsign,
      country,
      lon: lon + Math.sin(radians) * distance,
      lat: lat + Math.cos(radians) * distance,
      altitude: altitude + Math.sin(tick / 4 + index) * 80,
      velocity,
      heading,
      verticalRate: Math.sin(index) * 3,
      onGround: false,
      lastContact: Math.floor(Date.now() / 1000),
      source: "demo",
      route: demoRoute(callsign)
    };
  });
}
