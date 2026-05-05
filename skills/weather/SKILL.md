---
name: weather
description: "Get weather forecasts from free APIs - Open-Meteo (no key, unlimited)"
---

# Weather Forecasting

Open-Meteo: free weather API, no key required, unlimited calls.

---

## Quick Start

### Current Weather

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=48.86&longitude=2.44&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Europe/Paris" | jq '.current'
```

### Daily Forecast

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe/Paris" | jq '.daily'
```

### Hourly Forecast

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&hourly=temperature_2m,precipitation,weather_code&forecast_days=2" | jq '.hourly | .time[0:12]'
```

---

## Open-Meteo

**Base:** `https://api.open-meteo.com/v1/forecast`

### France AROME (1.3km)

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&models=meteofrance_arome_france&current=temperature_2m,weather_code" | jq '.current'
```

### Multiple Models

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&daily=temperature_2m_max&models=meteofrance_arpege_world,gfs_025,ecmwf_ifs025" | jq '.models'
```

### Historical Data

```bash
curl -s "https://archive-api.open-meteo.com/v1/archive?latitude=LAT&longitude=LON&start_date=2025-01-01&end_date=2026-05-04&daily=temperature_2m_max,temperature_2m_min,precipitation_sum" | jq '.daily'
```

---

## Weather Codes (WMO)

```
0      Clear
1-2    Mostly clear
3      Overcast
45-48  Foggy
51-55  Drizzle
61-67  Rain
71-77  Snow
80-82  Rain showers
85-86  Snow showers
95-99  Thunderstorm
```

---

## Examples

### Multi-Location

```bash
for city in "Paris:48.8566:2.3522" "Lyon:45.7640:4.8357"; do
  IFS=':' read name lat lon <<< "$city"
  TEMP=$(curl -s "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&current=temperature_2m" | jq '.current.temperature_2m')
  echo "$name: ${TEMP}°C"
done
```

### Caching (30 min)

```bash
CACHE="/tmp/weather.json"
if [ -f "$CACHE" ] && [ $(($(date +%s) - $(stat -f%m "$CACHE"))) -lt 1800 ]; then
  cat "$CACHE"
else
  curl -s "https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&current=temperature_2m" | tee "$CACHE"
fi
```

### Rain Check

```bash
RAIN=$(curl -s "https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&daily=precipitation_sum" | jq '.daily.precipitation_sum[0]')
[ $(echo "$RAIN > 5" | bc -l) -eq 1 ] && echo "Heavy rain: ${RAIN}mm"
```

---

**Resources:** [Open-Meteo Docs](https://open-meteo.com/en/docs)
