--- 
name: osm-routing 
description: Calculate routes (walk, bike, car) using free OSM APIs - OSRM and Valhalla
---

# OSM Routing

Calculate routes using OSRM (fast) and Valhalla (quality).

---

## Quick Start

### OSRM - Fast (GET, 100ms)

```bash
# Car route
curl "https://router.project-osrm.org/route/v1/car/LON1,LAT1;LON2,LAT2" | jq '.routes[0]'

# Example: 2.4427,48.8663 → 2.4285,48.8485
curl -s "https://router.project-osrm.org/route/v1/bike/2.4427,48.8663;2.4285,48.8485" | jq '.routes[0] | {distance_m: .distance, duration_sec: .duration}'

# Walking route with full geometry (for plotting on maps)
curl -s "https://router.project-osrm.org/route/v1/foot/2.4427,48.8663;2.4285,48.8485?overview=full&geometries=geojson" | jq '.routes[0].geometry'
# Returns GeoJSON coordinates: [[lon, lat], [lon, lat], ...]
```

### Valhalla - Quality (POST, 300-500ms)

```bash
# Pedestrian (best for walking)
curl -s -X POST "https://valhalla1.openstreetmap.de/route" \
  -H "Content-Type: application/json" \
  -d '{"locations":[{"lat":48.8663,"lon":2.4427},{"lat":48.8485,"lon":2.4285}],"costing":"pedestrian"}' | \
  jq '.trip | {distance_m: .summary.length, duration_sec: .summary.time}'
```

---

## OSRM Routes

**Profiles:** foot, car, bike

### Basic Route

```bash
curl "https://router.project-osrm.org/route/v1/{profile}/{lon1},{lat1};{lon2},{lat2}"
```

### Walking Route with Full Geometry

```bash
# Returns GeoJSON polyline for plotting on maps
curl -s "https://router.project-osrm.org/route/v1/foot/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson" | jq '.routes[0].geometry'
# Coordinates: [[lon, lat], [lon, lat], ...]
```

### Multiple Waypoints

```bash
curl -s "https://router.project-osrm.org/route/v1/bike/2.4427,48.8663;2.4285,48.8485;2.3522,48.8530" | jq '.routes[0].legs[]'
```

### With Details

```bash
curl "https://router.project-osrm.org/route/v1/car/2.4427,48.8663;2.4285,48.8485?overview=full&steps=true&alternatives=true&geometries=geojson"
```

### Distance Matrix

```bash
curl -s "https://router.project-osrm.org/table/v1/bike/2.4427,48.8663;2.4285,48.8485;2.3522,48.8530" | jq '.distances'
```

### Snap to Road

```bash
curl -s "https://router.project-osrm.org/nearest/v1/car/2.4427,48.8663" | jq '.waypoints[0]'
```

---

## Valhalla Routes

**Costing:** pedestrian, bicycle, auto, taxi, bikeshare

### Pedestrian

```bash
curl -s -X POST "https://valhalla1.openstreetmap.de/route" \
  -H "Content-Type: application/json" \
  -d '{"locations":[{"lat":LAT1,"lon":LON1},{"lat":LAT2,"lon":LON2}],"costing":"pedestrian"}' | \
  jq '.trip | {distance: .summary.length, time: .summary.time}'
```

### Bicycle (Avoid Major Roads)

```bash
curl -s -X POST "https://valhalla1.openstreetmap.de/route" \
  -H "Content-Type: application/json" \
  -d '{"locations":[{"lat":48.8663,"lon":2.4427},{"lat":48.8485,"lon":2.4285}],"costing":"bicycle","costing_options":{"bicycle":{"use_roads":0.0}}}' | \
  jq '.trip.summary'
```

### Car (Avoid Tolls)

```bash
curl -s -X POST "https://valhalla1.openstreetmap.de/route" \
  -H "Content-Type: application/json" \
  -d '{"locations":[{"lat":48.8663,"lon":2.4427},{"lat":48.8485,"lon":2.4285}],"costing":"auto","costing_options":{"auto":{"toll_booth_factor":1000}}}' | \
  jq '.trip.summary'
```

### Turn-by-Turn

```bash
curl -s -X POST "https://valhalla1.openstreetmap.de/route" \
  -H "Content-Type: application/json" \
  -d '{"locations":[{"lat":48.8663,"lon":2.4427},{"lat":48.8485,"lon":2.4285}],"costing":"pedestrian"}' | \
  jq '.trip.legs[].maneuvers[] | {instruction, distance: .distance.value, time: .time}'
```

### Multiple Waypoints

```bash
curl -s -X POST "https://valhalla1.openstreetmap.de/route" \
  -H "Content-Type: application/json" \
  -d '{"locations":[{"lat":48.8663,"lon":2.4427},{"lat":48.8566,"lon":2.3522},{"lat":48.8485,"lon":2.4285}],"costing":"bicycle"}' | \
  jq '.trip | {total_distance: .summary.length, legs: (.legs | length)}'
```

### Isochrone (Reachability)

```bash
curl -s -X POST "https://valhalla1.openstreetmap.de/isochrone" \
  -H "Content-Type: application/json" \
  -d '{"locations":[{"lat":48.8663,"lon":2.4427}],"costing":"bicycle","contours":[{"time":15}]}' | \
  jq '.features[0].geometry'
```

---

## API Selection

| Use | API | Command |
|-----|-----|---------|
| Walking route (geometry for maps) | OSRM | `GET /route/v1/foot/...?overview=full&geometries=geojson` |
| Quick car | OSRM | GET simple |
| Pedestrian (detailed) | Valhalla | POST pedestrian |
| Bike avoid roads | Valhalla | POST + options |
| Multiple points | OSRM | table |
| Directions | Valhalla | maneuvers |

---

## Advanced

### Compare Both

```bash
OSRM=$(curl -s "https://router.project-osrm.org/route/v1/bike/2.4427,48.8663;2.4285,48.8485" | jq '.routes[0].distance')
VALHALLA=$(curl -s -X POST "https://valhalla1.openstreetmap.de/route" \
  -H "Content-Type: application/json" \
  -d '{"locations":[{"lat":48.8663,"lon":2.4427},{"lat":48.8485,"lon":2.4285}],"costing":"bicycle"}' | \
  jq '.trip.summary.length')
echo "OSRM: ${OSRM}m | Valhalla: ${VALHALLA}m"
```

### Nearest Destination

```bash
for loc in "48.8566:2.3522" "48.8485:2.4285"; do
  IFS=':' read lat lon <<< "$loc"
  TIME=$(curl -s "https://router.project-osrm.org/route/v1/bike/2.4427,48.8663;$lon,$lat" | jq '.routes[0].duration')
  echo "$lat,$lon: ${TIME}s"
done | sort -t: -k2 -n
```

### Test All Modes

```bash
for mode in foot car bike; do
  OSRM=$(curl -s "https://router.project-osrm.org/route/v1/$mode/2.4427,48.8663;2.4285,48.8485" | jq '.routes[0] | "\(.distance)m / \(.duration)s"')
  echo "$mode: $OSRM"
done

for costing in pedestrian bicycle auto; do
  VALHALLA=$(curl -s -X POST "https://valhalla1.openstreetmap.de/route" \
    -H "Content-Type: application/json" \
    -d "{\"locations\":[{\"lat\":48.8663,\"lon\":2.4427},{\"lat\":48.8485,\"lon\":2.4285}],\"costing\":\"$costing\"}" | \
    jq '.trip.summary | "\(.length)m / \(.time)s"')
  echo "$costing: $VALHALLA"
done
```

---

**API Choice:** OSRM fast/simple, Valhalla better pedestrian/bike/details
**Resources:** [OSRM](https://project-osrm.org/docs/v5.24.0/api/) | [Valhalla](https://valhalla.readthedocs.io/) | [OSM Wiki](https://wiki.openstreetmap.org/wiki/Routing)
