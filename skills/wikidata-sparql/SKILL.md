---
name: wikidata-sparql
description: "Search engine for factual data using Wikidata SPARQL queries via curl. Use for factual questions about real-world entities, relationships, and data: people, places, organizations, events, scientific data, historical facts. Examples: 'cities with <100k population', 'Nobel Prize winners since 2010', 'chemical elements by atomic number', 'mountains over 8000m', 'US presidents born after 1900'. Query by properties (population, dates, locations, classifications), discover entity relationships, aggregate and filter data. Browse domain examples to find similar query patterns."
---

# Wikidata SPARQL

Search engine for factual data. Find query patterns by browsing domain examples below.

## Core Pattern

```bash
curl -G https://query.wikidata.org/sparql \
  --data-urlencode 'query=SPARQL_QUERY' \
  -H 'Accept: application/json'
```

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

**Step 1: Find entity IDs by keyword**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?item ?itemLabel WHERE { ?item rdfs:label ?label. FILTER(CONTAINS(LCASE(?label), "KEYWORD")). FILTER(LANG(?label) = "en"). SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 20' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.itemLabel.value) (\(.item.value | split("/")[-1]))"'
```

**Step 2: Explore entity properties**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?prop ?propLabel ?value ?valueLabel WHERE { wd:Qxxx ?prop ?value. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 50' -H 'Accept: application/json' | jq
```

**Step 3: Build targeted query with discovered properties**

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

## Domain Examples

### Geography

**Cities in France:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?city ?cityLabel WHERE { ?city wdt:P31 wd:Q515. ?city wdt:P17 wd:Q142. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 50' -H 'Accept: application/json' | jq -r '.results.bindings[] | .cityLabel.value'
```

**European capitals with coordinates:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?capital ?capitalLabel ?coord WHERE { ?country wdt:P31 wd:Q6256. ?country wdt:P36 ?capital. ?country wdt:P30 wd:Q46. ?capital wdt:P625 ?coord. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 30' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.capitalLabel.value): \(.coord.value)"'
```

**Mountains over 8000m:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?mountain ?mountainLabel ?elevation WHERE { ?mountain wdt:P31 wd:Q8502. ?mountain wdt:P2044 ?elevation. FILTER(?elevation > 8000). SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?elevation)' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.mountainLabel.value): \(.elevation.value)m"'
```

**Rivers by length:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?river ?riverLabel ?length WHERE { ?river wdt:P31 wd:Q4022. ?river wdt:P2043 ?length. FILTER(?length > 1000). SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?length) LIMIT 30' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.riverLabel.value): \(.length.value) km"'
```

### Science & Technology

**Chemical elements by atomic number:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?element ?elementLabel ?atomicNumber WHERE { ?element wdt:P31 wd:Q11344. ?element wdt:P1086 ?atomicNumber. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?atomicNumber LIMIT 30' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.atomicNumber.value): \(.elementLabel.value)"'
```

**Programming languages and creators:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?lang ?langLabel ?creator ?creatorLabel WHERE { ?lang wdt:P31 wd:Q9143. ?lang wdt:P178 ?creator. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 30' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.langLabel.value): \(.creatorLabel.value)"'
```

**Nobel Prize winners in Physics (after 2010):**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?person ?personLabel ?year WHERE { ?person wdt:P166 wd:Q38104. ?person p:P166 ?award. ?award pq:P585 ?year. FILTER(YEAR(?year) > 2010). SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?year) LIMIT 20' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.year.value | split("T")[0]): \(.personLabel.value)"'
```

**Planets with orbital periods:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?planet ?planetLabel ?orbitalPeriod WHERE { ?planet wdt:P31 wd:Q634. ?planet wdt:P2146 ?orbitalPeriod. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?orbitalPeriod' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.planetLabel.value): \(.orbitalPeriod.value) days"'
```

### Arts & Culture

**Films by Christopher Nolan:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?film ?filmLabel ?year WHERE { ?film wdt:P57 wd:Q25191. ?film wdt:P577 ?year. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?year' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.year.value | split("T")[0]): \(.filmLabel.value)"'
```

**Italian painters:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?painter ?painterLabel WHERE { ?painter wdt:P106 wd:Q1028181. ?painter wdt:P27 wd:Q38. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 30' -H 'Accept: application/json' | jq -r '.results.bindings[] | .painterLabel.value'
```

**UNESCO World Heritage Sites in Japan:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?site ?siteLabel WHERE { ?site wdt:P1435 wd:Q9259. ?site wdt:P17 wd:Q17. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 50' -H 'Accept: application/json' | jq -r '.results.bindings[] | .siteLabel.value'
```

### Sports

**Formula 1 World Champions (after 2010):**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?driver ?driverLabel ?year WHERE { ?driver wdt:P166 wd:Q9319. ?driver p:P166 ?award. ?award pq:P585 ?year. FILTER(YEAR(?year) > 2010). SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?year)' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.year.value | split("T")[0]): \(.driverLabel.value)"'
```

**Football clubs in England:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?club ?clubLabel WHERE { ?club wdt:P31 wd:Q476028. ?club wdt:P17 wd:Q21. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 30' -H 'Accept: application/json' | jq -r '.results.bindings[] | .clubLabel.value'
```

### History & Politics

**Roman Emperors with reign periods:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?emperor ?emperorLabel ?start ?end WHERE { ?emperor wdt:P39 wd:Q842606. ?emperor p:P39 ?pos. ?pos pq:P580 ?start. OPTIONAL { ?pos pq:P582 ?end }. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?start LIMIT 30' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.emperorLabel.value): \(.start.value | split("T")[0]) - \(.end.value | split("T")[0] // "?")"'
```

**US Presidents born after 1900:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?president ?presidentLabel ?birth WHERE { ?president wdt:P39 wd:Q11696. ?president wdt:P569 ?birth. FILTER(YEAR(?birth) > 1900). SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?birth' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.presidentLabel.value): \(.birth.value | split("T")[0])"'
```

### Biology

**Endangered species:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?species ?speciesLabel WHERE { ?species wdt:P141 wd:Q11394. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 50' -H 'Accept: application/json' | jq -r '.results.bindings[] | .speciesLabel.value'
```

**Mammals native to Australia:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?animal ?animalLabel WHERE { ?animal wdt:P171* wd:Q7377. ?animal wdt:P183 wd:Q408. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 30' -H 'Accept: application/json' | jq -r '.results.bindings[] | .animalLabel.value'
```

### Business & Organizations

**Universities ranked in top 100:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?uni ?uniLabel ?country ?countryLabel WHERE { ?uni wdt:P31 wd:Q3918. ?uni wdt:P17 ?country. ?uni wdt:P6879 ?rank. FILTER(?rank <= 100). SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 50' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.uniLabel.value), \(.countryLabel.value)"'
```

**Airlines by country:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?airline ?airlineLabel ?country ?countryLabel WHERE { ?airline wdt:P31 wd:Q46970. ?airline wdt:P17 ?country. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 50' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.airlineLabel.value): \(.countryLabel.value)"'
```

### Astronomy

**Satellites of Jupiter:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?moon ?moonLabel WHERE { ?moon wdt:P397 wd:Q319. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 80' -H 'Accept: application/json' | jq -r '.results.bindings[] | .moonLabel.value'
```

**Space missions to Mars:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?mission ?missionLabel ?launch WHERE { ?mission wdt:P31 wd:Q752783. ?mission wdt:P609 wd:Q111. ?mission wdt:P619 ?launch. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?launch) LIMIT 20' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.missionLabel.value): \(.launch.value | split("T")[0])"'
```

## Advanced Patterns

### Population Filtering
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?city ?cityLabel ?population WHERE { ?city wdt:P31 wd:Q515. ?city wdt:P1082 ?population. FILTER(?population < 100000 && ?population > 50000). SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?population) LIMIT 50' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.cityLabel.value): \(.population.value)"'
```

### Multiple Criteria
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?city ?cityLabel ?population ?country ?countryLabel WHERE { ?city wdt:P31 wd:Q515. ?city wdt:P1082 ?population. ?city wdt:P17 ?country. ?country wdt:P30 wd:Q46. FILTER(?population > 500000 && ?population < 1000000). SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?population) LIMIT 30' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.cityLabel.value), \(.countryLabel.value): \(.population.value)"'
```

### Aggregation (Count)
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?actor ?actorLabel (COUNT(?film) AS ?filmCount) WHERE { ?actor wdt:P106 wd:Q33999. ?film wdt:P161 ?actor. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?actor ?actorLabel ORDER BY DESC(?filmCount) LIMIT 20' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.actorLabel.value): \(.filmCount.value) films"'
```

### Transitive Relationships (Subclasses)
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?item ?itemLabel WHERE { ?item wdt:P31/wdt:P279* wd:Q515. ?item wdt:P17 wd:Q142. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 100' -H 'Accept: application/json' | jq
```
*The `*` operator follows subclass relationships transitively*

### Using Qualifiers (Time-bound)
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT ?person ?personLabel ?start ?end WHERE { ?person p:P39 ?statement. ?statement ps:P39 wd:Q30461. ?statement pq:P580 ?start. OPTIONAL { ?statement pq:P582 ?end }. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 20' -H 'Accept: application/json' | jq -r '.results.bindings[] | "\(.personLabel.value): \(.start.value | split("T")[0]) - \(.end.value | split("T")[0] // "present")"'
```

## Output Formats

**JSON (default):** `-H 'Accept: application/json'`  
**CSV:** `-H 'Accept: text/csv'`  
**TSV:** `-H 'Accept: text/tab-separated-values'`

**Parse with jq:**
```bash
| jq -r '.results.bindings[] | "\(.fieldLabel.value): \(.otherField.value)"'
```

## Debugging

**Raw entity dump:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT * WHERE { wd:Q90 ?p ?o. } LIMIT 100' -H 'Accept: application/json' | jq
```

**Statement inspection:**
```bash
curl -G https://query.wikidata.org/sparql --data-urlencode 'query=SELECT * WHERE { wd:Q90 p:P17 ?statement. ?statement ?p ?o. } LIMIT 50' -H 'Accept: application/json' | jq
```

## Common Pitfalls

- **Missing LIMIT** → timeout
- **No SERVICE wikibase:label** → Q-ids instead of readable labels
- **Forgetting FILTER for language** → labels in multiple languages
- **Using `p:` when `wdt:` suffices** → overcomplicated
- **Assuming data exists** → use `OPTIONAL` for properties that may not exist

## Data Availability Note

Wikidata coverage varies by topic. For sparse data (e.g., health statistics at city level):
- Query at country/region level (better coverage)
- Use `OPTIONAL` for properties that may not exist
- Check for external ID properties that link to other datasets
- Consider administrative divisions (`P131`) for hierarchical queries

## Resources

- **Query Service:** https://query.wikidata.org/ (visual testing)
- **Entity Explorer:** https://www.wikidata.org/wiki/Qxxx
- **Property Explorer:** https://www.wikidata.org/wiki/Property:Pxxx
