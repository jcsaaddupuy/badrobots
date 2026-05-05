---
name: osm-geography
description: "Search, filter, and geocode geographical data using OpenStreetMap Overpass API"
---

# OSM Geography - Geocoding & POI Discovery

Query OpenStreetMap data directly using the Overpass API. Find addresses, POIs (Points of Interest), calculate distances, and filter by location-based criteria.

## Quick Start

### 1. Geocode an Address (Address → Coordinates)

```bash
# Get coordinates for an address
curl -s "https://nominatim.openstreetmap.org/search?q=Eiffel+Tower+Paris&format=json" | jq '.[0] | {lat, lon, display_name}'
```

### 2. Reverse Geocode (Coordinates → Address)

```bash
# Get address from coordinates
curl -s "https://nominatim.openstreetmap.org/reverse?lat=48.8663&lon=2.4427&format=json" | jq '{address: .address.city, country: .address.country}'
```

### 3. Search POIs by Type & Location

```bash
# Find restaurants in a bounding box
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];
(
  node[amenity=restaurant](48.5,2.2,49.0,2.8);
  way[amenity=restaurant](48.5,2.2,49.0,2.8);
);
out center;' | jq '.elements[] | {id, lat: .center.lat, lon: .center.lon, name: .tags.name}'
```

---

## Core Components

### A. Geocoding (Address ↔ Coordinates)

#### Forward Geocoding: Address → Coordinates

```bash
# Basic search
CITY="Paris"
curl -s "https://nominatim.openstreetmap.org/search?q=$CITY&format=json" | jq '.[0]'

# Detailed address
ADDRESS="10 Rue de la Paix, Paris, France"
curl -s "https://nominatim.openstreetmap.org/search?q=$(echo "$ADDRESS" | jq -sRr @uri)&format=json" | jq '.[0] | {lat, lon, name: .display_name}'

# Get only coordinates quickly
curl -s "https://nominatim.openstreetmap.org/search?q=Eiffel+Tower+Paris&format=json&limit=1" | jq -r '.[0] | "\(.lat),\(.lon)"'
```

#### Reverse Geocoding: Coordinates → Address

```bash
# Get address from lat/lon
LAT="48.8566"; LON="2.3522"
curl -s "https://nominatim.openstreetmap.org/reverse?lat=$LAT&lon=$LON&format=json" | jq '.address'

# Get just city/country
curl -s "https://nominatim.openstreetmap.org/reverse?lat=48.8566&lon=2.3522&format=json" | jq '{city: .address.city, country: .address.country}'
```

---

### B. Overpass Query Basics

#### Query Structure

```
[out:json];                           # Output format
(
  node[TAG=VALUE](BBOX);              # Query nodes
  way[TAG=VALUE](BBOX);               # Query ways
);
out [OPTIONS];                        # Output options
```

#### Bounding Box Format

```
(south, west, north, east)
(48.5, 2.2, 49.0, 2.8)  ← ~50km x 50km region around Paris
```

#### Common Output Options

| Option | Purpose |
|--------|---------|
| `out ids` | Only OSM IDs |
| `out center` | Center point of ways |
| `out geom` | Full geometry/coordinates |
| `out body` | Full tag/metadata |
| `out count` | Just count of results |

---

### C. Query Patterns by POI Type

#### Food & Restaurants

```bash
# All restaurants
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];
(node[amenity=restaurant](48.5,2.2,49.0,2.8);
 way[amenity=restaurant](48.5,2.2,49.0,2.8););
out body;' | jq '.elements[] | {name: .tags.name, cuisine: .tags.cuisine}'

# Pizza places specifically
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];
(node[amenity=restaurant][cuisine~"pizza"](48.5,2.2,49.0,2.8);
 way[amenity=restaurant][cuisine~"pizza"](48.5,2.2,49.0,2.8););
out body;' | jq '.elements | length'

# Cafes with outdoor seating
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];
(node[amenity=cafe][outdoor_seating=yes](48.5,2.2,49.0,2.8);
 way[amenity=cafe][outdoor_seating=yes](48.5,2.2,49.0,2.8););
out center;' | jq '.elements[] | {name: .tags.name, lat: .center.lat, lon: .center.lon}'
```

#### Recreation & Tourism

```bash
# Museums
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];(node[tourism=museum](48.5,2.2,49.0,2.8); way[tourism=museum](48.5,2.2,49.0,2.8););out body;' | jq '.elements[] | {name: .tags.name, website: .tags.website}'

# Parks
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];(node[leisure=park](48.5,2.2,49.0,2.8); way[leisure=park](48.5,2.2,49.0,2.8););out center;' | jq '.elements[] | {name: .tags.name, lat: .center.lat, lon: .center.lon}'

# Picnic tables
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];(node[leisure=picnic_table](48.5,2.2,49.0,2.8); way[leisure=picnic_table](48.5,2.2,49.0,2.8););out geom;' | jq '.elements | length'
```

#### Infrastructure & Services

```bash
# Pharmacies with opening hours
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];(node[amenity=pharmacy][opening_hours](48.5,2.2,49.0,2.8); way[amenity=pharmacy][opening_hours](48.5,2.2,49.0,2.8););out body;' | jq '.elements[] | {name: .tags.name, hours: .tags.opening_hours}'

# Public transportation stops
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];(node[public_transport=stop_position][bus=yes](48.5,2.2,49.0,2.8); node[public_transport=stop_position][tram=yes](48.5,2.2,49.0,2.8););out body;' | jq '.elements | length'

# Libraries
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];(node[amenity=library](48.5,2.2,49.0,2.8); way[amenity=library](48.5,2.2,49.0,2.8););out body;' | jq '.elements[] | {name: .tags.name, website: .tags.website}'
```

---

### D. Filtering Techniques

#### By Tag Value (Exact Match)

```bash
# Exact match: amenity = restaurant
[amenity=restaurant]

# Multiple values (OR logic)
[amenity=restaurant] OR [amenity=cafe]
```

#### By Regex Pattern

```bash
# Partial match: cuisine contains "pizza"
[cuisine~"pizza"]

# Case-insensitive
[name~"(?i)paris"]

# Negation: NOT closed
[name!~"closed"]
```

#### By Tag Existence

```bash
# Has phone number
[phone]

# Has website
[website]

# Has opening hours
[opening_hours]
```

#### Multiple Conditions (AND Logic)

```bash
# Restaurants WITH outdoor seating
[amenity=restaurant][outdoor_seating=yes]

# Cafes with wifi
[amenity=cafe][wifi=yes]

# Shops open on weekends
[shop][opening_hours~"Su"]
```

#### Range Queries

```bash
# Stars >= 4 (if tagged)
# Note: OSM doesn't have native range, use multiple tags instead
[tourism=hotel][stars~"[4-5]"]
```

---

### E. Common Query Examples

#### Find All POIs in a City

```bash
# Get city bbox first
BBOX=$(curl -s "https://nominatim.openstreetmap.org/search?q=Paris&format=json" | jq -r '.[0] | "\(.boundingbox[0]),\(.boundingbox[2]),\(.boundingbox[1]),\(.boundingbox[3])"')

# Query all amenities in that bbox
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d "[out:json];(node[amenity]($BBOX); way[amenity]($BBOX););out count;" | jq '.elements'
```

#### Find Specific POI Near Address

```bash
# 1. Geocode address
COORDS=$(curl -s "https://nominatim.openstreetmap.org/search?q=Lyon&format=json&limit=1" | jq -r '.[0] | "\(.lat),\(.lon)"')

# 2. Create bbox (roughly ±0.05 degrees ≈ 5km)
LAT=$(echo $COORDS | cut -d, -f1); LON=$(echo $COORDS | cut -d, -f2)
BBOX="$((${LAT%.*}-1)),$((${LON%.*}-1)),$((${LAT%.*}+1)),$((${LON%.*}+1))"

# 3. Query restaurants in that area
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d "[out:json];(node[amenity=restaurant]($BBOX); way[amenity=restaurant]($BBOX););out body;" | jq '.elements[] | {name: .tags.name, lat: .lat, lon: .lon}'
```

#### Filter Results with Multiple Criteria

```bash
# Get restaurants with phone, website, AND hours
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];(node[amenity=restaurant][phone][website][opening_hours](48.5,2.2,49.0,2.8); way[amenity=restaurant][phone][website][opening_hours](48.5,2.2,49.0,2.8););out body;' | jq '.elements[] | {name: .tags.name, phone: .tags.phone, website: .tags.website}'
```

---

### F. Distance Calculation

#### Using jq + Math (Haversine)

```bash
# Calculate distance between two points
# Format: LAT1,LON1 LAT2,LON2
POINT1="48.8566,2.3522"  # Eiffel Tower
POINT2="48.8693,2.3412"  # Arc de Triomphe

LAT1=$(echo $POINT1 | cut -d, -f1); LON1=$(echo $POINT1 | cut -d, -f2)
LAT2=$(echo $POINT2 | cut -d, -f1); LON2=$(echo $POINT2 | cut -d, -f2)

# Haversine in jq (approximate for short distances)
jq -n \
  --arg lat1 "$LAT1" --arg lon1 "$LON1" \
  --arg lat2 "$LAT2" --arg lon2 "$LON2" \
  '
  def rad: . * 3.14159 / 180;
  def haversine:
    (($lat2 | tonumber | rad) - ($lat1 | tonumber | rad)) as $dlat |
    (($lon2 | tonumber | rad) - ($lon1 | tonumber | rad)) as $dlon |
    (($dlat / 2 | sin) * ($dlat / 2 | sin) + 
     (($lat1 | tonumber | rad) | cos) * (($lat2 | tonumber | rad) | cos) * 
     (($dlon / 2 | sin) * ($dlon / 2 | sin))) as $a |
    (2 * (($a | sqrt | atan) + ((1 - $a) | sqrt | atan))) as $c |
    (6371 * $c * 1000) as $meters |
    $meters;
  haversine
  '
```

#### Using Python for Complex Calculations

```bash
python3 -c "
import math
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# Example: distance from Eiffel Tower to Arc de Triomphe
dist = haversine(48.8566, 2.3522, 48.8693, 2.3412)
print(f'{dist:.0f}m')
"
```

---

### G. Advanced Patterns

#### Union Queries (Multiple POI Types)

```bash
# Find restaurants OR cafes OR bars
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];
(
  node[amenity=restaurant](48.5,2.2,49.0,2.8);
  node[amenity=cafe](48.5,2.2,49.0,2.8);
  node[amenity=bar](48.5,2.2,49.0,2.8);
  way[amenity=restaurant](48.5,2.2,49.0,2.8);
  way[amenity=cafe](48.5,2.2,49.0,2.8);
  way[amenity=bar](48.5,2.2,49.0,2.8);
);
out body;' | jq '.elements | length'
```

#### Historic/Cultural POIs

```bash
# Museums, galleries, artworks, memorials
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];
(
  node[tourism=museum](48.5,2.2,49.0,2.8);
  node[tourism=gallery](48.5,2.2,49.0,2.8);
  node[tourism=artwork](48.5,2.2,49.0,2.8);
  node[historic=memorial](48.5,2.2,49.0,2.8);
  way[tourism=museum](48.5,2.2,49.0,2.8);
  way[tourism=gallery](48.5,2.2,49.0,2.8);
  way[historic=memorial](48.5,2.2,49.0,2.8);
);
out body;' | jq '.elements | group_by(.tags | keys[]) | map({type: .[0].tags | keys[0], count: length})'
```

#### Accessibility Queries

```bash
# Wheelchair accessible facilities
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];(node[wheelchair=yes](48.5,2.2,49.0,2.8); way[wheelchair=yes](48.5,2.2,49.0,2.8););out body;' | jq '.elements[] | {name: .tags.name, wheelchair: .tags.wheelchair}'

# Facilities with accessible toilets
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];(node[toilets=yes][wheelchair=yes](48.5,2.2,49.0,2.8); way[toilets=yes][wheelchair=yes](48.5,2.2,49.0,2.8););out body;' | jq '.elements | length'
```

#### Time-Based Queries

```bash
# Open now (Monday 10am example - requires local date logic)
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];(node[amenity=restaurant][opening_hours~"Mo 0[0-9]:"](48.5,2.2,49.0,2.8); way[amenity=restaurant][opening_hours~"Mo 0[0-9]:"](48.5,2.2,49.0,2.8););out body;' | jq '.elements | length'
```

---

## Common Tag Reference

### Amenities
```
restaurant, cafe, bar, pizza, fast_food, school, hospital, pharmacy, 
library, bank, post_office, parking, fuel
```

### Tourism
```
museum, gallery, artwork, monument, information, hotel, guest_house
```

### Leisure
```
park, playground, sports_centre, swimming_pool, picnic_table, garden
```

### Historic
```
memorial, castle, church, chapel, archaeological_site, battlefield
```

### Shops
```
bakery, supermarket, clothes, books, electronics, grocery, wine
```

---

## Optimization Tips

### 1. Use Appropriate Output Mode

```bash
# Just count (fastest)
out count;

# Only IDs (smallest data)
out ids;

# Only centers (good for visualizing ways)
out center;

# Full data (slowest, most info)
out body;
```

### 2. Limit Results with Bbox

```bash
# Instead of querying entire country, use specific bbox
# Smaller bbox = faster response
(48.84,2.42,48.89,2.46)  # ~5km x 5km region
```

### 3. Filter Early

```bash
# Do filtering in query, not post-processing
# Bad: query all restaurants, then filter by phone
# Good: query [amenity=restaurant][phone]
```

### 4. Batch Multiple Queries

```bash
# One API call with multiple queries is faster than N calls
[out:json];
(node[amenity=restaurant](bbox); node[amenity=cafe](bbox); node[amenity=bar](bbox););
out body;
```

---

## Error Handling

### Check API Status

```bash
# Test API connectivity
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[out:json];out;' | jq '.elements'

# If timeout, try alternative endpoint (slower but usually available)
# https://overpass.openstreetmap.ru/api/interpreter
```

### Handle Large Queries

```bash
# Add timeout parameter (in seconds)
curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d '[timeout:30];[out:json];(node[amenity=restaurant](bbox););out body;'
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Timeout | Query too large | Split bbox into smaller areas |
| 400 Bad Request | Invalid syntax | Check OverPass QL syntax |
| Memory exceeded | Too many results | Add more filters or smaller bbox |
| Rate limited | Too many requests | Add delays between requests |

---

## Complete Workflow Example

```bash
#!/bin/bash
# Find all cafes with wifi in a city

# 1. Geocode city
CITY="${1:-Paris}"
BBOX=$(curl -s "https://nominatim.openstreetmap.org/search?q=$CITY&format=json" | jq -r '.[0] | "\(.boundingbox[0]),\(.boundingbox[2]),\(.boundingbox[1]),\(.boundingbox[3])"')

# 2. Query cafes with wifi
RESULTS=$(curl -s -X POST "https://overpass-api.de/api/interpreter" \
  -d "[out:json];(node[amenity=cafe][wifi=yes]($BBOX); way[amenity=cafe][wifi=yes]($BBOX););out body;" | jq '.elements')

# 3. Extract data and count
echo "$RESULTS" | jq '.[] | {name: .tags.name, phone: .tags.phone}'
echo "Total: $(echo "$RESULTS" | jq 'length')"
```

---

## Resources

- **Overpass QL Documentation:** https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
- **Nominatim API:** https://nominatim.org/release-docs/latest/api/Overview/
- **Tag List:** https://wiki.openstreetmap.org/wiki/Map_Features
- **Query Examples:** https://overpass-turbo.eu/
- **API Status:** https://overpass-api.de/api/status

---

## Quick Reference

```bash
# Geocode address
curl -s "https://nominatim.openstreetmap.org/search?q=ADDRESS&format=json" | jq '.[0]'

# Reverse geocode
curl -s "https://nominatim.openstreetmap.org/reverse?lat=LAT&lon=LON&format=json" | jq '.address'

# Query POIs
curl -s -X POST "https://overpass-api.de/api/interpreter" -d '[out:json];(node[TAG=VALUE](BBOX););out OPTION;' | jq '.elements'

# Count results
curl -s -X POST "https://overpass-api.de/api/interpreter" -d '[out:json];(node[TAG](BBOX););out count;' | jq '.elements[0].tags.total'

# Get coordinates quickly
curl -s "https://nominatim.openstreetmap.org/search?q=QUERY&format=json&limit=1" | jq -r '.[0] | "\(.lat),\(.lon)"'
```

---

**Dependencies:** curl, jq (optional: python3 for Haversine)
