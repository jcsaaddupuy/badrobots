#!/usr/bin/env python3
"""
Readeck annotate — create a highlight on a bookmark.

Usage:
  annotate.py <bookmark_id> "text to highlight" "annotation note" [color]

Finds the text in the article, computes the correct XPath + offsets,
and creates the highlight. No DOM matching gymnastics.

Color: yellow (default), red, blue, green, transparent

Requires: READECK_BASE_URL, READECK_API_KEY
"""

import json, os, re, subprocess, sys, tempfile
from html import unescape

# ── API ──────────────────────────────────────────────────────────────────────

def api(method, path, data=None):
    base, key = os.environ["READECK_BASE_URL"], os.environ["READECK_API_KEY"]
    cmd = ["curl", "-s", "-X", method, f"{base}{path}",
           "-H", f"Authorization: Bearer {key}"]
    if data is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(data)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except (json.JSONDecodeError, TypeError):
        return None


def get_article(bookmark_id):
    tmp = tempfile.mktemp(suffix=".html")
    base, key = os.environ["READECK_BASE_URL"], os.environ["READECK_API_KEY"]
    subprocess.run(
        ["curl", "-s", f"{base}/api/bookmarks/{bookmark_id}/article",
         "-H", f"Authorization: Bearer {key}", "-o", tmp],
        capture_output=True, text=True)
    with open(tmp) as f:
        html = f.read()
    os.unlink(tmp)
    return html


def make_annotation(bid, xpath, start, end, note, color):
    return api("POST", f"/api/bookmarks/{bid}/annotations", {
        "text": "_", "note": note,
        "start_selector": xpath, "start_offset": start,
        "end_selector": xpath, "end_offset": end,
        "color": color,
    })


def probe(bid, xpath, length=40):
    """Probe Readeck at xpath offset 0 → returns text or None."""
    resp = api("POST", f"/api/bookmarks/{bid}/annotations", {
        "text": "_", "note": "_", "start_selector": xpath,
        "start_offset": 0, "end_selector": xpath,
        "end_offset": length, "color": "transparent",
    })
    if not resp or not resp.get("id") or resp["id"] is None:
        return None
    text = resp.get("text", "")
    api("DELETE", f"/api/bookmarks/{bid}/annotations/{resp['id']}")
    return text or None


# ── Core logic ───────────────────────────────────────────────────────────────

def extract_paragraphs(html):
    """
    Extract all <p> and <blockquote>/<p> from article HTML.
    Returns [(xpath, stripped_text)] in document order.

    For each <p>: strip ALL inner tags, unescape entities → plain text.
    Offsets in this text match Readeck's annotation engine.
    """
    # Find the <section> that wraps the article
    section = re.search(r'<section[^>]*>(.*)</section>', html, re.DOTALL)
    body = section.group(1) if section else html

    result = []
    p_count = 0
    bq_p_counts = {}  # blockquote_index → p_count

    # Walk through body finding <blockquote> and <p> in order
    # Simple approach: find all top-level elements in sequence
    pos = 0
    while pos < len(body):
        # Find next tag
        m = re.search(r'<(p|blockquote)[^>]*>', body[pos:])
        if not m:
            break
        tag = m.group(1)
        tag_start = pos + m.start()

        if tag == "p":
            # Find matching </p>
            end_m = re.search(r'</p>', body[tag_start:])
            if not end_m:
                break
            inner = body[tag_start + m.end() - m.start():tag_start + end_m.start()]
            text = unescape(re.sub(r'<[^>]+>', '', inner)).strip()
            if text:
                p_count += 1
                result.append((f"section[1]/p[{p_count}]", text))
            pos = tag_start + end_m.end()
        elif tag == "blockquote":
            # Find matching </blockquote>
            end_m = re.search(r'</blockquote>', body[tag_start:])
            if not end_m:
                break
            bq_inner = body[tag_start + m.end() - m.start():tag_start + end_m.start()]
            bq_idx = len(bq_p_counts) + 1
            bq_p_count = 0
            for pm in re.finditer(r'<p[^>]*>(.*?)</p>', bq_inner, re.DOTALL):
                text = unescape(re.sub(r'<[^>]+>', '', pm.group(1))).strip()
                if text:
                    bq_p_count += 1
                    result.append((f"section[1]/blockquote[{bq_idx}]/p[{bq_p_count}]", text))
            bq_p_counts[bq_idx] = bq_p_count
            pos = tag_start + end_m.end()
        else:
            pos = tag_start + m.end() - m.start()

    return result


def calibrate(bid, paragraphs):
    """
    Probe section[1]/p[1] to find how many nav paragraphs Readeck skips.
    Returns the index offset (0, 1, 2, ...) to subtract from our count.
    """
    our_p1_text = None
    for xpath, text in paragraphs:
        if xpath == "section[1]/p[1]":
            our_p1_text = text
            break
    if not our_p1_text:
        return 0

    # Probe Readeck's p[1]
    readeck_p1 = probe(bid, "section[1]/p[1]")
    if not readeck_p1:
        return 0

    # Find which of our paragraphs matches Readeck's p[1]
    for i, (xpath, text) in enumerate(paragraphs):
        if "/p[" in xpath and text[:30] == readeck_p1[:30]:
            # Our (i+1)th p matches Readeck's p[1] → offset is i
            return i
    return 0


def adjust_xpath(xpath, offset):
    """Shift p[N] indices by -offset to account for skipped nav paragraphs."""
    if offset == 0:
        return xpath
    return re.sub(r'/p\[(\d+)\]', lambda m: f'/p[{int(m.group(1)) - offset}]', xpath)


def find_and_annotate(bid, search_text, note, color):
    """Main logic: find text in article, create highlight."""
    html = get_article(bid)
    paragraphs = extract_paragraphs(html)

    # Find the paragraph containing the search text
    matches = []
    for xpath, text in paragraphs:
        if search_text in text:
            start = text.find(search_text)
            matches.append((xpath, start, start + len(search_text), search_text))
        elif len(search_text) >= 20 and search_text[:20] in text:
            frag = search_text[:20]
            s = text.find(frag)
            e = min(s + len(search_text), len(text))
            matches.append((xpath, s, e, text[s:e]))

    if not matches:
        return {"error": f"Text not found: '{search_text[:60]}'"}

    # Use the best (longest) match
    best = max(matches, key=lambda m: len(m[3]))
    xpath, start, end, matched = best

    # Calibrate: check if our p-index matches Readeck's
    offset = calibrate(bid, paragraphs)
    adjusted_xpath = adjust_xpath(xpath, offset)

    # Create the annotation
    resp = make_annotation(bid, adjusted_xpath, start, end, note, color)

    if resp and resp.get("id") and resp["id"] is not None:
        # Check if the actual text matches what we expected
        actual = resp.get("text", "")
        if actual and search_text[:20] not in actual:
            # Offset mismatch — try the un-adjusted xpath
            if offset > 0:
                resp2 = make_annotation(bid, xpath, start, end, note, color)
                if resp2 and resp2.get("id") and resp2["id"] is not None:
                    api("DELETE", f"/api/bookmarks/{bid}/annotations/{resp['id']}")
                    actual2 = resp2.get("text", "")
                    if search_text[:20] in actual2:
                        return {"status": "created", "id": resp2["id"],
                                "text": actual2[:100], "xpath": xpath,
                                "offsets": [start, end], "color": color}
                    # Neither worked perfectly — return the adjusted one
                    api("DELETE", f"/api/bookmarks/{bid}/annotations/{resp2['id']}")
        return {"status": "created", "id": resp["id"],
                "text": actual[:100], "xpath": adjusted_xpath,
                "offsets": [start, end], "color": color}
    else:
        # Try un-adjusted xpath as fallback
        if offset > 0:
            resp = make_annotation(bid, xpath, start, end, note, color)
            if resp and resp.get("id") and resp["id"] is not None:
                return {"status": "created", "id": resp["id"],
                        "text": resp.get("text", "")[:100], "xpath": xpath,
                        "offsets": [start, end], "color": color}
        return {"error": f"Creation failed: {json.dumps(resp)}"}


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print("Usage: annotate.py <bookmark_id> \"text to highlight\" [\"note\"] [color]")
        print("Colors: yellow, red, blue, green, transparent")
        sys.exit(1)

    bid = sys.argv[1]
    search_text = sys.argv[2]
    note = sys.argv[3] if len(sys.argv) > 3 else ""
    color = sys.argv[4] if len(sys.argv) > 4 else "yellow"

    if not os.environ.get("READECK_BASE_URL") or not os.environ.get("READECK_API_KEY"):
        print("ERROR: READECK_BASE_URL and READECK_API_KEY required", file=sys.stderr)
        sys.exit(1)

    result = find_and_annotate(bid, search_text, note, color)
    print(json.dumps(result, ensure_ascii=False))
    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    main()
