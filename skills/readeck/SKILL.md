---
name: readeck
description: Bookmark manager for saving, searching, and annotating web content. Use when: (1) saving a webpage for later reference, (2) searching previously saved bookmarks, (3) adding highlights/annotations to saved content, (4) user asks to "bookmark this" or "save this article". Requires READECK_BASE_URL and READECK_API_KEY environment variables.
---

# Readeck API

Save, search, annotate, and recall web bookmarks. Use as a persistent memory layer: bookmark valuable pages, highlight key passages with notes, and retrieve them during research.

## Authentication

All requests use Bearer token via `$READECK_BASE_URL` and `$READECK_API_KEY`.

## Save Bookmark

```bash
curl -s -X POST "$READECK_BASE_URL/api/bookmarks" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article", "labels": ["ai-assistant"]}'

# Wait for processing, then retrieve
sleep 5
curl -s "$READECK_BASE_URL/api/bookmarks?search=example.com" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '[.[] | {id,title,url,labels}]'
```

## List Bookmarks

Returns a compact summary — no article content.

```bash
curl -s "$READECK_BASE_URL/api/bookmarks" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '[.[] | {id,title,url,site,labels,description,word_count,reading_time,has_article,is_archived,is_marked,created}]'
```

Pagination:

```bash
curl -s "$READECK_BASE_URL/api/bookmarks?limit=20&offset=0" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '[.[] | {id,title,url,site,labels,description,word_count,reading_time,has_article,is_archived,is_marked,created}]'
```

## Search Bookmarks

Supports full-text search, label filter, and collection filter (combinable):

```bash
# Full-text search
curl -s "$READECK_BASE_URL/api/bookmarks?search=<query>" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '[.[] | {id,title,url,site,labels,description,word_count,reading_time,has_article,is_archived,is_marked,created}]'

# Filter by label
curl -s "$READECK_BASE_URL/api/bookmarks?labels=<label>" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '[.[] | {id,title,url,site,labels,description,word_count,reading_time,has_article,is_archived,is_marked,created}]'

# Filter by collection ID
curl -s "$READECK_BASE_URL/api/bookmarks?collection=<collection_id>" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '[.[] | {id,title,url,site,labels,description,word_count,reading_time,has_article,is_archived,is_marked,created}]'
```

## Get Bookmark Details

Metadata only — no article body.

```bash
curl -s "$READECK_BASE_URL/api/bookmarks/{ID}" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '{id,title,url,site,site_name,lang,authors,labels,description,word_count,reading_time,has_article,is_archived,is_marked,created,updated}'
```

## Get Article Content

The article endpoint returns HTML. Save it then strip tags for readable plain text:

```bash
# Save HTML
curl -s "$READECK_BASE_URL/api/bookmarks/{ID}/article" \
  -H "Authorization: Bearer $READECK_API_KEY" > article.html

# Plain text for reading / highlight lookup
python3 -c "
import re, sys
html = open(sys.argv[1]).read()
print(re.sub(r'<[^>]+>', '', html))
" article.html
```

## Get Bookmark with Highlights

No single combined endpoint exists. Make two calls and merge:

```bash
ID="{ID}"

# 1. Metadata
curl -s "$READECK_BASE_URL/api/bookmarks/$ID" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '{id,title,url,labels,description,word_count,reading_time,created}'

# 2. Highlights
curl -s "$READECK_BASE_URL/api/bookmarks/$ID/annotations" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '[.[] | {id,text,note,color,created}]'
```

## Get Highlights

```bash
curl -s "$READECK_BASE_URL/api/bookmarks/{ID}/annotations" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '[.[] | {id,text,note,color,created}]'
```

## Create Highlight

First, find the XPath and offsets for the text to highlight:

```bash
# One-liner: find paragraph index and offset for text
python3 -c "import sys,re,json;h=open(sys.argv[1]).read();p=[re.sub(r'<[^>]+>','',m.group(1)).strip()for m in re.finditer(r'<p[^>]*>(.*?)</p>',h,re.DOTALL)if re.sub(r'<[^>]+>','',m.group(1)).strip()];t=sys.argv[2];print(json.dumps({'found':any(t in x for x in p),'xpath':f'section[1]/div[1]/p[{next((i for i,x in enumerate(p,1)if t in x),0)}]','offsets':next(((x.find(t),x.find(t)+len(t))for x in p if t in x),(0,0))}))" article.html "text to highlight"
```

Then create the highlight (use `note` to store the key insight):

```bash
curl -s -X POST "$READECK_BASE_URL/api/bookmarks/{ID}/annotations" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "highlighted text", "note": "why this matters", "start_selector": "section[1]/div[1]/p[N]", "start_offset": X, "end_selector": "section[1]/div[1]/p[N]", "end_offset": Y, "color": "yellow"}'
```

If the response is `{"id": null}`, try inserting `div[1]/` before `p[N]` in the selectors.
Wikipedia-style articles typically use `section[1]/div[1]/p[N]`.

### Colors

`yellow`, `red`, `blue`, `green`, `transparent`

## Delete Highlight

```bash
curl -s -X DELETE "$READECK_BASE_URL/api/bookmarks/{ID}/annotations/{HIGHLIGHT_ID}" \
  -H "Authorization: Bearer $READECK_API_KEY"
```

## Get Collections

Collections group bookmarks by label filters. Use `labels` field to query bookmarks belonging to a collection.

```bash
curl -s "$READECK_BASE_URL/api/bookmarks/collections" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '[.[] | {id,name,labels}]'
```

To list bookmarks in a collection, use its `id`:

```bash
curl -s "$READECK_BASE_URL/api/bookmarks?collection=<collection_id>" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  | jq '[.[] | {id,title,url,labels,description,word_count,created}]'
```

## Memory Workflow

Use Readeck as a persistent knowledge base during research:

1. **Bookmark** pages worth keeping (`labels: ["topic", "ai-assistant"]`)
2. **Search** existing bookmarks before fetching new URLs (`?search=`, `?labels=`)
3. **Read** article content when deeper analysis is needed
4. **Highlight** key passages with a `note` explaining their relevance
5. **Recall** highlights later — they carry the distilled insight without re-reading the full article
