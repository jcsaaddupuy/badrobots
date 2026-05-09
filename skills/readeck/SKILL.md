---
name: readeck
description: Bookmark manager for saving, searching, and annotating web content. Use when: (1) saving a webpage for later reference, (2) searching previously saved bookmarks, (3) adding highlights/annotations to saved content, (4) user asks to "bookmark this" or "save this article". Requires READECK_BASE_URL and READECK_API_KEY environment variables.
---

# Readeck API

Save, search, and annotate web bookmarks.

## Authentication

All requests use Bearer token:

```bash
curl -s "$READECK_BASE_URL/api/bookmarks" \
  -H "Authorization: Bearer $READECK_API_KEY"
```

## Save Bookmark

```bash
curl -s -X POST "$READECK_BASE_URL/api/bookmarks" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article", "labels": ["ai-assistant"]}'

# Wait for processing, then get ID
sleep 5
curl -s "$READECK_BASE_URL/api/bookmarks?search=example.com" \
  -H "Authorization: Bearer $READECK_API_KEY" | jq '.[0].id'
```

## Get Article Content

```bash
curl -s "$READECK_BASE_URL/api/bookmarks/{ID}/article" \
  -H "Authorization: Bearer $READECK_API_KEY" > article.html
```

## Add Annotation

Find XPath and offsets:

```bash
# One-liner: find paragraph index and offset for text
python3 -c "import sys,re,json;h=open(sys.argv[1]).read();p=[re.sub(r'<[^>]+>','',m.group(1)).strip()for m in re.finditer(r'<p[^>]*>(.*?)</p>',h,re.DOTALL)if re.sub(r'<[^>]+>','',m.group(1)).strip()];t=sys.argv[2];print(json.dumps({'found':any(t in x for x in p),'xpath':f'section[1]/div[1]/p[{next((i for i,x in enumerate(p,1)if t in x),0)}]','offsets':next(((x.find(t),x.find(t)+len(t))for x in p if t in x),(0,0))}))" article.html "text to highlight"
```

Create annotation:

```bash
curl -s -X POST "$READECK_BASE_URL/api/bookmarks/{ID}/annotations" \
  -H "Authorization: Bearer $READECK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "highlighted text", "note": "your note", "start_selector": "section[1]/div[1]/p[N]", "start_offset": X, "end_selector": "section[1]/div[1]/p[N]", "end_offset": Y, "color": "yellow"}'
```

If annotation returns `{"id": null}`, try adding `div[1]/` before `p[N]`. Wikipedia articles work with `section[1]/div[1]/p[N]`.

## Colors

`yellow`, `red`, `blue`, `green`, `transparent`

## Get/Delete Annotations

```bash
# List annotations
curl -s "$READECK_BASE_URL/api/bookmarks/{ID}/annotations" \
  -H "Authorization: Bearer $READECK_API_KEY" | jq '.[] | {id, text}'

# Delete annotation
curl -s -X DELETE "$READECK_BASE_URL/api/bookmarks/{ID}/annotations/{ANN_ID}" \
  -H "Authorization: Bearer $READECK_API_KEY"
```

## List Bookmarks

```bash
curl -s  "$READECK_BASE_URL/api/bookmarks" \
  -H "Authorization: Bearer $READECK_API_KEY"
```

## List Collections

```bash
curl -s  "$READECK_BASE_URL/api/bookmarks/collections" \
  -H "Authorization: Bearer $READECK_API_KEY"
```


## Delete Bookmark

```bash
curl -s -X DELETE "$READECK_BASE_URL/api/bookmarks/{ID}" \
  -H "Authorization: Bearer $READECK_API_KEY"
```
