---
name: wikidata-sparql
description: "Search engine for factual data using Wikidata SPARQL queries with robust Python/uv run. Built-in retry logic handles rate limits (403/429) and server errors (502, 503, 504). Use for factual questions about real-world entities, relationships, and data: people, places, organizations, events, scientific data, historical facts. Examples: 'cities with <100k population', 'Nobel Prize winners since 2010', 'chemical elements by atomic number', 'mountains over 8000m', 'US presidents born after 1900'. Query by properties (population, dates, locations, classifications), discover entity relationships, aggregate and filter data. Includes exponential backoff retry strategy and 30s timeout."
---

# Wikidata SPARQL

Search engine for factual data. Find query patterns by browsing SPARQL examples below.

## Python Template

Use this template with any SPARQL query from the examples:

```bash
uv run --with requests python <<'EOF'
import requests, sys, json
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

q = """PASTE_SPARQL_QUERY_HERE"""

s = requests.Session()
retry = Retry(total=5, backoff_factor=1, status_forcelist=[403, 429, 502, 503, 504])
s.mount('https://', HTTPAdapter(max_retries=retry))

try:
    r = s.get('https://query.wikidata.org/sparql', params={'query': q}, headers={'Accept': 'application/json'}, timeout=30)
    r.raise_for_status()
    for b in r.json().get('results', {}).get('bindings', []):
        print(f"{b.get(list(b.keys())[0])['value']}")  # Adjust field names as needed
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
EOF
```

**Execution with `uv run`:**
- `total=5` - Maximum 5 retry attempts
- `backoff_factor=1` - Exponential backoff: 1s, 2s, 4s, 8s, 16s
- `status_forcelist=[403, 429, 502, 503, 504]` - Retry on rate limits (403/429 from Wikidata) and server errors
- `timeout=30` - 30 second request timeout
- Automatic dependency installation—no setup needed

## Essential Concepts

**Entities**: `Qxxx` (e.g., Q90 = Paris, Q5 = human)  
**Properties**: `Pxxx` (e.g., P17 = country, P31 = instance of)

**Namespaces:**
- `wd:` - entity reference (Q-ids)
- `wdt:` - direct property (use for 80% of queries)
- `p:` + `ps:` + `pq:` - statement with qualifiers (when you need dates/context)

**Always:**
- Include `SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }`
- Add `LIMIT` to prevent timeouts
- Start simple, add filters incrementally

## Discovery Workflow

**Find entity IDs by keyword:**
```bash
uv run --with requests python KEYWORD <<'EOF'
import requests, sys
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

keyword = sys.argv[1] if len(sys.argv) > 1 else 'Paris'
q = f'SELECT ?item ?itemLabel WHERE {{ ?item rdfs:label ?label. FILTER(CONTAINS(LCASE(?label), "{keyword}")). FILTER(LANG(?label) = "en"). SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }} }} LIMIT 20'

s = requests.Session()
retry = Retry(total=5, backoff_factor=1, status_forcelist=[403, 429, 502, 503, 504])
s.mount('https://', HTTPAdapter(max_retries=retry))

try:
    r = s.get('https://query.wikidata.org/sparql', params={'query': q}, headers={'Accept': 'application/json'}, timeout=30)
    r.raise_for_status()
    for b in r.json().get('results', {}).get('bindings', []):
        print(f"{b['itemLabel']['value']} ({b['item']['value'].split('/')[-1]})")
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
EOF
```

**Explore entity properties:**
```bash
uv run --with requests python Q90 <<'EOF'
import requests, sys, json
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

qid = sys.argv[1] if len(sys.argv) > 1 else 'Q90'
q = f'SELECT ?prop ?propLabel ?value ?valueLabel WHERE {{ wd:{qid} ?prop ?value. SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }} }} LIMIT 50'

s = requests.Session()
retry = Retry(total=5, backoff_factor=1, status_forcelist=[403, 429, 502, 503, 504])
s.mount('https://', HTTPAdapter(max_retries=retry))

try:
    r = s.get('https://query.wikidata.org/sparql', params={'query': q}, headers={'Accept': 'application/json'}, timeout=30)
    r.raise_for_status()
    print(json.dumps(r.json(), indent=2))
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
EOF
```

## Common Properties

| Property | ID | Example |
|----------|-----|---------|
| instance of | P31 | human (Q5), city (Q515) |
| country | P17 | France (Q142) |
| population | P1082 | numeric value |
| coordinate location | P625 | lat/long |
| occupation | P106 | engineer (Q82955) |
| date of birth | P569 | date |
| subclass of | P279 | hierarchy |
| start time / end time | P580 / P582 | qualifiers |

## SPARQL Query Examples

### Geography

Cities in France:
```sparql
SELECT ?city ?cityLabel WHERE {
  ?city wdt:P31 wd:Q515.
  ?city wdt:P17 wd:Q142.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 50
```

European capitals with coordinates:
```sparql
SELECT ?capital ?capitalLabel ?coord WHERE {
  ?country wdt:P31 wd:Q6256.
  ?country wdt:P36 ?capital.
  ?country wdt:P30 wd:Q46.
  ?capital wdt:P625 ?coord.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 30
```

Mountains over 8000m:
```sparql
SELECT ?mountain ?mountainLabel ?elevation WHERE {
  ?mountain wdt:P31 wd:Q8502.
  ?mountain wdt:P2044 ?elevation.
  FILTER(?elevation > 8000).
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?elevation)
```

Rivers by length:
```sparql
SELECT ?river ?riverLabel ?length WHERE {
  ?river wdt:P31 wd:Q4022.
  ?river wdt:P2043 ?length.
  FILTER(?length > 1000).
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?length) LIMIT 30
```

### Science & Technology

Chemical elements by atomic number:
```sparql
SELECT ?element ?elementLabel ?atomicNumber WHERE {
  ?element wdt:P31 wd:Q11344.
  ?element wdt:P1086 ?atomicNumber.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY ?atomicNumber LIMIT 30
```

Programming languages and creators:
```sparql
SELECT ?lang ?langLabel ?creator ?creatorLabel WHERE {
  ?lang wdt:P31 wd:Q9143.
  ?lang wdt:P178 ?creator.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 30
```

Nobel Prize winners in Physics (after 2010):
```sparql
SELECT ?person ?personLabel ?year WHERE {
  ?person wdt:P166 wd:Q38104.
  ?person p:P166 ?award.
  ?award pq:P585 ?year.
  FILTER(YEAR(?year) > 2010).
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?year) LIMIT 20
```

Planets with orbital periods:
```sparql
SELECT ?planet ?planetLabel ?orbitalPeriod WHERE {
  ?planet wdt:P31 wd:Q634.
  ?planet wdt:P2146 ?orbitalPeriod.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY ?orbitalPeriod
```

### Arts & Culture

Films by Christopher Nolan:
```sparql
SELECT ?film ?filmLabel ?year WHERE {
  ?film wdt:P57 wd:Q25191.
  ?film wdt:P577 ?year.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY ?year
```

Italian painters:
```sparql
SELECT ?painter ?painterLabel WHERE {
  ?painter wdt:P106 wd:Q1028181.
  ?painter wdt:P27 wd:Q38.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 30
```

UNESCO World Heritage Sites in Japan:
```sparql
SELECT ?site ?siteLabel WHERE {
  ?site wdt:P1435 wd:Q9259.
  ?site wdt:P17 wd:Q17.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 50
```

### Sports

Formula 1 World Champions (after 2010):
```sparql
SELECT ?driver ?driverLabel ?year WHERE {
  ?driver wdt:P166 wd:Q9319.
  ?driver p:P166 ?award.
  ?award pq:P585 ?year.
  FILTER(YEAR(?year) > 2010).
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?year)
```

Football clubs in England:
```sparql
SELECT ?club ?clubLabel WHERE {
  ?club wdt:P31 wd:Q476028.
  ?club wdt:P17 wd:Q21.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 30
```

### History & Politics

Roman Emperors with reign periods:
```sparql
SELECT ?emperor ?emperorLabel ?start ?end WHERE {
  ?emperor wdt:P39 wd:Q842606.
  ?emperor p:P39 ?pos.
  ?pos pq:P580 ?start.
  OPTIONAL { ?pos pq:P582 ?end }.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY ?start LIMIT 30
```

US Presidents born after 1900:
```sparql
SELECT ?president ?presidentLabel ?birth WHERE {
  ?president wdt:P39 wd:Q11696.
  ?president wdt:P569 ?birth.
  FILTER(YEAR(?birth) > 1900).
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY ?birth
```

### Biology

Endangered species:
```sparql
SELECT ?species ?speciesLabel WHERE {
  ?species wdt:P141 wd:Q11394.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 50
```

Mammals native to Australia:
```sparql
SELECT ?animal ?animalLabel WHERE {
  ?animal wdt:P171* wd:Q7377.
  ?animal wdt:P183 wd:Q408.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 30
```

### Business & Organizations

Universities ranked in top 100:
```sparql
SELECT ?uni ?uniLabel ?country ?countryLabel WHERE {
  ?uni wdt:P31 wd:Q3918.
  ?uni wdt:P17 ?country.
  ?uni wdt:P6879 ?rank.
  FILTER(?rank <= 100).
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 50
```

Airlines by country:
```sparql
SELECT ?airline ?airlineLabel ?country ?countryLabel WHERE {
  ?airline wdt:P31 wd:Q46970.
  ?airline wdt:P17 ?country.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 50
```

### Astronomy

Satellites of Jupiter:
```sparql
SELECT ?moon ?moonLabel WHERE {
  ?moon wdt:P397 wd:Q319.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 80
```

Space missions to Mars:
```sparql
SELECT ?mission ?missionLabel ?launch WHERE {
  ?mission wdt:P31 wd:Q752783.
  ?mission wdt:P609 wd:Q111.
  ?mission wdt:P619 ?launch.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?launch) LIMIT 20
```

## Advanced Patterns

Population filtering (50k-100k):
```sparql
SELECT ?city ?cityLabel ?population WHERE {
  ?city wdt:P31 wd:Q515.
  ?city wdt:P1082 ?population.
  FILTER(?population < 100000 && ?population > 50000).
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?population) LIMIT 50
```

Multiple criteria (European cities 500k-1M):
```sparql
SELECT ?city ?cityLabel ?population ?country ?countryLabel WHERE {
  ?city wdt:P31 wd:Q515.
  ?city wdt:P1082 ?population.
  ?city wdt:P17 ?country.
  ?country wdt:P30 wd:Q46.
  FILTER(?population > 500000 && ?population < 1000000).
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?population) LIMIT 30
```

Aggregation (actors by film count):
```sparql
SELECT ?actor ?actorLabel (COUNT(?film) AS ?filmCount) WHERE {
  ?actor wdt:P106 wd:Q33999.
  ?film wdt:P161 ?actor.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} GROUP BY ?actor ?actorLabel ORDER BY DESC(?filmCount) LIMIT 20
```

Transitive relationships (French cities including subcategories):
```sparql
SELECT ?item ?itemLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:Q515.
  ?item wdt:P17 wd:Q142.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 100
```

Time-bound qualifiers (historical positions with date ranges):
```sparql
SELECT ?person ?personLabel ?start ?end WHERE {
  ?person p:P39 ?statement.
  ?statement ps:P39 wd:Q30461.
  ?statement pq:P580 ?start.
  OPTIONAL { ?statement pq:P582 ?end }.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 20
```

## Debugging Queries

Raw entity dump (e.g., Paris):
```sparql
SELECT * WHERE { wd:Q90 ?p ?o. } LIMIT 100
```

Statement inspection (e.g., Paris' country):
```sparql
SELECT * WHERE {
  wd:Q90 p:P17 ?statement.
  ?statement ?p ?o.
} LIMIT 50
```

## Common Pitfalls

- **Missing LIMIT** → timeout
- **No SERVICE wikibase:label** → Q-ids instead of readable labels
- **Forgetting FILTER for language** → labels in multiple languages
- **Using `p:` when `wdt:` suffices** → overcomplicated
- **Assuming data exists** → use `OPTIONAL` for properties that may not exist

## Data Availability

Wikidata coverage varies by topic. For sparse data (e.g., health statistics at city level):
- Query at country/region level (better coverage)
- Use `OPTIONAL` for properties that may not exist
- Check for external ID properties that link to other datasets
- Consider administrative divisions (`P131`) for hierarchical queries

## Resources

- **Query Service:** https://query.wikidata.org/ (visual testing & debug)
- **Entity Explorer:** https://www.wikidata.org/wiki/Qxxx
- **Property Explorer:** https://www.wikidata.org/wiki/Property:Pxxx
