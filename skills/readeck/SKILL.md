---
name: readeck
description: "Bookmark manager for saving, searching, and annotating web content. Use when: (1) saving a webpage for later reference, (2) searching previously saved bookmarks, (3) adding highlights/annotations to saved content, (4) user asks to 'bookmark this' or 'save this article'. Requires READECK_BASE_URL and READECK_API_KEY environment variables."
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

# Plain text for reading
python3 -c "import re,sys;html=open(sys.argv[1]).read();print(re.sub(r'<[^>]+>','',html))" article.html
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

Use `scripts/annotate.py` — it automatically extracts paragraphs with correct XPath and creates the highlight:

```bash
# bookmark_id "text to highlight" "annotation note" color
uv run SKILL_DIR/scripts/annotate.py <ID> "text to highlight" "why this matters" yellow

# Colors: yellow (default), red, blue, green, transparent
uv run SKILL_DIR/scripts/annotate.py <ID> "text" "note" red

# List all paragraphs in the article (debug)
uv run SKILL_DIR/scripts/annotate.py <ID> --list
```

### How annotate.py works

1. Downloads article HTML from Readeck
2. Parses the full DOM structure, tracking nested `<div>` elements to build correct XPath (e.g., `section[1]/div[1]/div[1]/p[1]`)
3. Strips HTML tags and unescapes entities to get plain text with character offsets
4. Searches for the target text in extracted paragraphs
5. Creates the highlight with correct XPath and offset

### Colors

`yellow`, `red`, `blue`, `green`, `transparent`

### Manual creation (expert)

Readeck uses XPath selectors that reflect the actual DOM structure. The path must include all nested `div` elements:

```bash
curl -s -X POST "$READECK_BASE_URL/api/bookmarks/{ID}/annotations" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "highlighted text", "note": "why this matters", "start_selector": "section[1]/div[1]/div[1]/p[1]", "start_offset": X, "end_selector": "section[1]/div[1]/div[1]/p[1]", "end_offset": Y, "color": "yellow"}'
```

**Gotchas:**

- XPath includes all nested `div` elements: `section[1]/div[N]/div[N]/p[N]` - NOT just `section[1]/p[N]`
- Offsets are in stripped+unescaped text, NOT raw HTML
- Blockquotes use: `section[1]/div[...]/blockquote[N]/p[N]`
- Always use `--list` first to see the correct XPath for paragraphs

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
