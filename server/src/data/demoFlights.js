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
      source: "demo"
    };
  });
}
