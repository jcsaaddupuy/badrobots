--- 
name: itineraries 
description: Generate static and interactive map images from waypoints
---

# Itineraries

Generate map images from waypoints and routes with real OSM tile backgrounds.

## Critical Rules

1. **Always use `uv run --with PKG -- python`** (NOT `uvx`, NOT `python3`)
2. **Always set `ax.set_xlim()` and `ax.set_ylim()` BEFORE calling `ctx.add_basemap()`** — contextily needs axis bounds to know which tiles to fetch. Without bounds, you get a blank or solid-color image.
3. **Always use `contextily` for the basemap** — a map without tile background is useless.
4. **Use OSRM for real route polylines** — straight lines between waypoints are NOT itineraries.
5. **For interactive Leaflet maps: use CARTO Voyager tiles, NOT `tile.openstreetmap.org`** — OSM tiles return 403 from `file://` due to missing Referer header (see [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)).
6. **When adding multiple Leaflet tile layers, only call `.addTo(map)` on the DEFAULT layer** — the rest go in `LayerControl` only. Adding all layers to map stacks them, with the last one (often dark) obscuring everything.
7. **Compute bounds from ALL route coordinates, not just waypoints** — OSRM routes follow roads that extend beyond waypoint positions. Using only waypoints for bounds clips the route.

## Static Maps (matplotlib + contextily)

### Full Working Example

```bash
uv run --with matplotlib --with contextily --with requests -- python << 'EOF'
import matplotlib.pyplot as plt
import contextily as ctx
import requests

# ── 1. Define waypoints: (lat, lon, label) ──
waypoints = [
    (48.8566, 2.3522, "Eiffel Tower"),
    (48.8606, 2.3376, "Musée d'Orsay"),
    (48.8530, 2.3499, "Notre-Dame"),
]

# ── 2. Fetch real walking route from OSRM ──
def osrm_route(lon1, lat1, lon2, lat2):
    """Get GeoJSON route line from OSRM (foot profile)."""
    url = f"https://router.project-osrm.org/route/v1/foot/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson"
    r = requests.get(url, timeout=10)
    if r.ok and r.json().get("routes"):
        return r.json()["routes"][0]
    return None

fig, ax = plt.subplots(figsize=(12, 10))

total_dist = 0
all_route_lons = []
all_route_lats = []

for i in range(len(waypoints) - 1):
    lat1, lon1, _ = waypoints[i]
    lat2, lon2, _ = waypoints[i + 1]

    route = osrm_route(lon1, lat1, lon2, lat2)
    if route and "geometry" in route:
        coords = route["geometry"]["coordinates"]
        all_route_lons.extend([c[0] for c in coords])
        all_route_lats.extend([c[1] for c in coords])
        ax.plot([c[0] for c in coords], [c[1] for c in coords],
                color="#0066cc", linewidth=4, alpha=0.85, zorder=3)
        total_dist += route["distance"] / 1000
    else:
        # Fallback: straight line
        all_route_lons.extend([lon1, lon2])
        all_route_lats.extend([lat1, lat2])
        ax.plot([lon1, lon2], [lat1, lat2], "b--", linewidth=2, alpha=0.5, zorder=3)

# ── 3. Plot waypoints ──
for i, (lat, lon, label) in enumerate(waypoints):
    ax.plot(lon, lat, "o", color="red" if i > 0 else "green",
            markersize=16, markeredgecolor="white", markeredgewidth=2, zorder=5)
    ax.annotate(label, (lon, lat), xytext=(10, 10), textcoords="offset points",
                fontsize=9, fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.5", facecolor="white",
                          edgecolor="black", linewidth=1.5, alpha=0.9),
                arrowprops=dict(arrowstyle="->", lw=1.5, color="black"), zorder=6)

# ── 4. Set axis bounds from ROUTE coords (not waypoints) BEFORE basemap ──
# OSRM routes follow roads that extend beyond waypoint positions.
# If you use only waypoints for bounds, the route line will be clipped at edges.
margin_lon = max((max(all_route_lons) - min(all_route_lons)) * 0.15, 0.005)
margin_lat = max((max(all_route_lats) - min(all_route_lats)) * 0.15, 0.005)
ax.set_xlim(min(all_route_lons) - margin_lon, max(all_route_lons) + margin_lon)
ax.set_ylim(min(all_route_lats) - margin_lat, max(all_route_lats) + margin_lat)

# ── 5. Add OSM tile background ──
ctx.add_basemap(ax, crs="EPSG:4326", source=ctx.providers.OpenStreetMap.Mapnik, zoom="auto")

# ── 6. Save ──
ax.set_title(f"Walking Route — {total_dist:.1f} km", fontsize=13, fontweight="bold")
ax.set_xlabel("Longitude")
ax.set_ylabel("Latitude")
plt.tight_layout()
plt.savefig("route.png", dpi=150, bbox_inches="tight")
print(f"✓ Saved route.png ({total_dist:.1f}km)")
EOF
```

## Interactive Maps (Leaflet/Folium)

For browser-based interactive maps, use `folium` to generate Leaflet HTML.

**IMPORTANT: Never use `tile.openstreetmap.org` as default tile layer!**

OSM's tile server requires a valid `Referer` header (see [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)).
When opened from `file://`, the browser sends no Referer → all tile requests return **403 Forbidden**.

### Correct: CARTO Voyager (default, works from file://)

```python
import folium

TILE_URL = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

m = folium.Map(location=[48.8566, 2.3522], zoom_start=13, tiles=None)

# Default layer — only this one gets .add_to()
folium.TileLayer(tiles=TILE_URL, attr=TILE_ATTR, name="CARTO Voyager").add_to(m)

# Optional layers — do NOT call .add_to(), they go in LayerControl only
folium.TileLayer(
    tiles="https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr='&copy; OpenStreetMap contributors',
    name="OpenStreetMap"
)  # NO .add_to() — only available via layer switch

folium.LayerControl().add_to(m)
m.save("map.html")
```

### Why not OSM tiles?

| Scenario | OSM tiles | CARTO Voyager |
|----------|-----------|---------------|
| Served from `https://` | Works (Referer present) | Works |
| Opened from `file://` | **403 Forbidden** | Works |
| Heavy traffic | Blocked (no SLA) | CDN-backed |
| Attribution required | © OpenStreetMap | © OpenStreetMap + © CARTO |

### Available CARTO tile styles

```
https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png    # Colorful, readable (RECOMMENDED)
https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png               # Light/minimal
https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png                # Dark theme
```

## Step-by-Step Breakdown (Static Maps)

### Step 1: Waypoints

```python
# Format: (lat, lon, label)
waypoints = [
    (48.8566, 2.3522, "Start"),
    (48.8606, 2.3376, "Middle"),
    (48.8530, 2.3499, "End"),
]
```

### Step 2: Real Routes (OSRM)

```python
# OSRM foot profile — returns actual road/path geometry
# NOTE: OSRM uses LON,LAT order in the URL
url = f"https://router.project-osrm.org/route/v1/foot/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson"

# Collect ALL route coordinates for bounds calculation
coords = route["geometry"]["coordinates"]
all_route_lons.extend([c[0] for c in coords])
all_route_lats.extend([c[1] for c in coords])

ax.plot([c[0] for c in coords], [c[1] for c in coords],
        color="blue", linewidth=4, zorder=3)
```

**OSRM profiles:** `foot`, `bike`, `car`

### Step 3: Set Bounds from Route Coordinates (REQUIRED before basemap!)

```python
# contextily CANNOT fetch tiles without axis bounds.
# You MUST call set_xlim/set_ylim BEFORE add_basemap.
#
# CRITICAL: compute bounds from ALL route coordinates, not just waypoints.
# The OSRM route follows roads and can extend well beyond waypoint positions.
# Using only waypoints for bounds clips the route at viewport edges.

margin_lon = max((max(all_route_lons) - min(all_route_lons)) * 0.15, 0.005)
margin_lat = max((max(all_route_lats) - min(all_route_lats)) * 0.15, 0.005)
ax.set_xlim(min(all_route_lons) - margin_lon, max(all_route_lons) + margin_lon)
ax.set_ylim(min(all_route_lats) - margin_lat, max(all_route_lats) + margin_lat)
```

### Step 4: Add Basemap

```python
# MUST be called after set_xlim/set_ylim
ctx.add_basemap(ax, crs="EPSG:4326", source=ctx.providers.OpenStreetMap.Mapnik, zoom="auto")
```

**Alternative tile sources (contextily):**

```python
ctx.providers.OpenStreetMap.Mapnik    # Default street map
ctx.providers.Stamen.Terrain          # Terrain/relief
ctx.providers.Stamen.Toner            # Black & white
ctx.providers.CartoDB.Positron        # Light/minimal
ctx.providers.CartoDB.DarkMatter      # Dark theme
```

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `ctx.add_basemap()` before `set_xlim/set_ylim` | Blank or solid-color image | Set bounds FIRST |
| Using `uvx` instead of `uv run --with` | Package not found | Use `uv run --with PKG -- python` |
| Using `python3` instead of `python` | Command not found in uv | Use `python` |
| Drawing straight lines between waypoints | Not a real itinerary | Use OSRM to get route geometry |
| No `crs="EPSG:4326"` in add_basemap | Wrong projection / distorted map | Always pass `crs="EPSG:4326"` for lat/lon data |
| Using `tile.openstreetmap.org` in Leaflet from `file://` | 403 Forbidden on all tiles | Use CARTO Voyager (see Interactive Maps section) |
| All tile layers `.addTo(map)` in Leaflet | Layers stack, last obscures map | Only default layer `.addTo()`, rest in LayerControl |
| Bounds from waypoints only, not route coords | Route clipped / outside viewport | Collect ALL route lon/lat from OSRM, compute bounds from those |

## Output

```python
plt.savefig("route.png", dpi=150, bbox_inches="tight")           # Standard
plt.savefig("route.png", dpi=300, bbox_inches="tight")           # High quality
plt.savefig("route.png", dpi=150, bbox_inches="tight", facecolor="white")  # Explicit bg
```

## Data Sources

- **osm-geography skill**: Geocode places, search POIs
- **osm-routing skill**: OSRM + Valhalla route calculations

## Dependencies

### Static maps (matplotlib)
```
uv run --with matplotlib --with contextily --with requests -- python
```

### Interactive maps (folium)
```
uv run --with folium --with requests -- python
```

**Resources:** [Matplotlib](https://matplotlib.org/) | [Contextily](https://contextily.readthedocs.io/) | [Folium](https://python-visualization.github.io/folium/) | [OSRM API](https://project-osrm.org/docs/v5.24.0/api/) | [OSM Tile Policy](https://operations.osmfoundation.org/policies/tiles/) | [CARTO Basemaps](https://carto.com/basemaps) | [uv docs](https://docs.astral.sh/uv/guides/scripts/)
