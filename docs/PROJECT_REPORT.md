# SkyRadar Project Report

## Abstract

SkyRadar is a web-based airspace visualization system that collects live aircraft states, enriches them with route and airport information, and presents them on an interactive map. The project demonstrates full-stack development, external API integration, geospatial filtering, real-time communication, caching, responsive design, and graceful failure handling.

## Problem Statement

Raw ADS-B feeds are difficult for non-specialists to interpret. SkyRadar converts aircraft state vectors into a searchable visual dashboard and combines multiple open datasets to provide useful context such as airline, origin, destination, nearby airports, altitude, speed, and flight pattern.

## Objectives

- Visualize live aircraft positions in a selected map region.
- Enrich raw aircraft states with understandable route information.
- Show airport infrastructure without cluttering low-zoom views.
- Provide smooth movement despite slower upstream polling intervals.
- Remain usable during API failures or rate limits.
- Deliver a responsive interface suitable for desktop and mobile.

## Main Modules

| Module | Responsibility |
| --- | --- |
| OpenSky service | Fetch and normalize live aircraft state vectors |
| Polling pipeline | Update cache, position trails, and clients |
| ADSBDB service | Resolve callsigns and cache route details |
| Airport service | Load, parse, filter, and serve global airport data |
| Express API | Expose aircraft, airport, health, and analytics endpoints |
| Socket.IO | Notify clients when a new live snapshot is available |
| React dashboard | Search, filter, select, and display airspace data |
| Leaflet map | Render moving aircraft, airports, trails, and routes |

## Key Algorithms

### Bounding-Box Filtering

Only aircraft and airports inside the current map bounds are returned. Airport types are also filtered by zoom level, preventing thousands of small-airport markers from overwhelming the browser.

### Dead Reckoning

Between live reports, an aircraft position is estimated from its latest latitude, longitude, ground speed, heading, and elapsed time. The estimate is limited to 25 seconds and corrected whenever a new OpenSky state arrives.

### Route Caching

Resolved ADSBDB routes are cached for 24 hours. Unresolved callsigns are cached for one hour. This improves response time and avoids unnecessary load on the free API.

### Graceful Fallback

If OpenSky cannot be reached, the server emits realistic simulated aircraft. The UI clearly labels the source as a simulated fallback rather than presenting it as live data.

## Non-Functional Requirements

- Responsive layout for desktop and mobile
- Clear loading, empty, offline, and unavailable-route states
- Reduced-motion support
- Cancellable client requests during rapid map movement
- API validation and bounded response sizes
- No required paid services or API keys

## Testing Checklist

- Production frontend build succeeds.
- Health, live-flight, airport, aircraft-detail, and analytics endpoints return valid JSON.
- Invalid airport bounds return HTTP 400.
- OpenSky failure activates the demo fallback.
- Selecting a resolved commercial flight displays its route.
- Aircraft move smoothly and correct after new live reports.
- Airport visibility changes by map zoom.
- Search, filters, map layers, keyboard shortcuts, and mobile list work.

## Limitations

- Anonymous OpenSky access may be rate-limited.
- Callsign-derived routes can be missing or historically incorrect.
- Position trails are stored in memory and disappear after restart.
- The project does not currently include user accounts, alerts, or a persistent database.
- Dead-reckoned positions are estimates, not new ADS-B measurements.

## Future Scope

- PostgreSQL/TimescaleDB flight-history persistence
- Redis live cache and horizontal scaling
- Authentication, saved flights, and geofence alerts
- Historical replay and airspace heatmaps
- Airport runway and weather overlays
- Automated unit, integration, and browser tests

## Demo and Viva Talking Points

1. Explain why ADS-B state data and route data come from separate sources.
2. Demonstrate bounding-box filtering by moving and zooming the map.
3. Select a flight and explain route caching and route uncertainty.
4. Explain dead reckoning and why estimated movement is capped.
5. Disconnect or block OpenSky to demonstrate graceful fallback.
6. Discuss how Redis and PostgreSQL would support production scaling.
