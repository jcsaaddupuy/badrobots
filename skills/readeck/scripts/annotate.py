#!/usr/bin/env python3
"""
Readeck annotate - create a highlight on a bookmark.

Usage:
  annotate.py <bookmark_id> "text to highlight" "annotation note" [color]

Finds the text in the article, computes the correct XPath + offsets,
and creates the highlight. Handles nested article structure properly.

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
    """Download article HTML from Readeck."""
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
    """Create annotation via Readeck API."""
    return api("POST", f"/api/bookmarks/{bid}/annotations", {
        "text": "_", "note": note,
        "start_selector": xpath, "start_offset": start,
        "end_selector": xpath, "end_offset": end,
        "color": color,
    })


def probe(bid, xpath, length=50):
    """Probe Readeck at xpath offset 0, returns extracted text or None."""
    resp = api("POST", f"/api/bookmarks/{bid}/annotations", {
        "text": "_", "note": "_", "start_selector": xpath,
        "start_offset": 0, "end_selector": xpath,
        "end_offset": length, "color": "transparent",
    })
    if not resp or resp.get("id") is None:
        return None
    text = resp.get("text", "")
    if resp.get("id"):
        api("DELETE", f"/api/bookmarks/{bid}/annotations/{resp['id']}")
    return text if text else None


# ── Paragraph extraction ─────────────────────────────────────────────────────

def extract_paragraphs(html):
    """
    Extract all paragraphs with their XPath from Readeck article HTML.
    Returns [(xpath, stripped_text)] in document order.

    Readeck uses XPath like: section[1]/div[1]/div[1]/p[1]
    We must track the full path including all nested divs.
    """
    result = []

    # Track path as we parse: [(tag, index), ...]
    path = []
    sibling_counts = {}  # (depth, tag) -> count
    current_text = []
    current_xpath = None
    in_content = False

    # Simple state machine
    i = 0
    while i < len(html):
        # Find next tag
        tag_start = html.find('<', i)
        if tag_start == -1:
            break

        tag_end = html.find('>', tag_start)
        if tag_end == -1:
            break

        tag_content = html[tag_start+1:tag_end]

        # Check if closing tag
        if tag_content.startswith('/'):
            tag_name = tag_content[1:].split()[0]
            if tag_name in ('p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'):
                if current_text and current_xpath:
                    text = unescape(''.join(current_text)).strip()
                    # Remove extra whitespace
                    text = ' '.join(text.split())
                    if text:
                        result.append((current_xpath, text))
                current_text = []
                current_xpath = None
            if path and path[-1][0] == tag_name:
                path.pop()
        else:
            # Opening tag - get tag name
            tag_name = tag_content.split()[0] if ' ' in tag_content else tag_content
            tag_name = tag_name.lower()

            if tag_name == 'section':
                path = [('section', 1)]
                sibling_counts = {(0, 'section'): 1}
            elif tag_name == 'article':
                depth = len(path)
                key = (depth, 'article')
                sibling_counts[key] = sibling_counts.get(key, 0) + 1
                path.append(('article', sibling_counts[key]))
            elif tag_name in ('div', 'section'):
                depth = len(path)
                key = (depth, tag_name)
                sibling_counts[key] = sibling_counts.get(key, 0) + 1
                path.append((tag_name, sibling_counts[key]))
            elif tag_name in ('p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'):
                depth = len(path)
                key = (depth, tag_name)
                sibling_counts[key] = sibling_counts.get(key, 0) + 1
                current_xpath = '/'.join(f'{t}[{n}]' for t, n in path) + f'/{tag_name}[{sibling_counts[key]}]'
                current_text = []

        # Collect text content between tags
        next_tag = html.find('<', tag_end + 1)
        if next_tag == -1:
            break
        if current_xpath is not None:
            text_chunk = html[tag_end + 1:next_tag]
            # Only add non-tag content
            if not text_chunk.strip().startswith('<'):
                current_text.append(text_chunk)

        i = next_tag

    return result


# ── Calibration ───────────────────────────────────────────────────────────────

def calibrate(bid, paragraphs):
    """
    Probe the first paragraph to verify XPath works.
    Returns True if calibration passed, False otherwise.
    """
    if not paragraphs:
        return False
    
    # Get first paragraph
    xpath, text = paragraphs[0]
    
    # Probe at offset 0
    probed = probe(bid, xpath, min(50, len(text)))
    return probed is not None and text[:30] in probed


# ── Main logic ───────────────────────────────────────────────────────────────

def find_and_annotate(bid, search_text, note, color):
    """Find text in article and create highlight."""
    html = get_article(bid)
    paragraphs = extract_paragraphs(html)

    if not paragraphs:
        return {"error": "No paragraphs found in article"}

    # Verify first paragraph XPath works (optional calibration)
    # calibrate(bid, paragraphs)  # Can skip for speed

    # Find all matches
    matches = []
    for xpath, text in paragraphs:
        if search_text in text:
            start = text.find(search_text)
            matches.append((xpath, start, start + len(search_text), search_text, text))
        elif len(search_text) >= 15:
            # Partial match
            for i in range(len(text) - 15):
                if search_text[:15] == text[i:i+15]:
                    end = min(i + len(search_text), len(text))
                    matches.append((xpath, i, end, text[i:end], text))
                    break

    if not matches:
        available = [f"'{t[:40]}...' ({x})" for x, t in paragraphs[:5]]
        return {"error": f"Text not found: '{search_text[:50]}'. Sample: {available}"}

    # Use best match (longest)
    best = max(matches, key=lambda m: len(m[3]))
    xpath, start, end, matched_text, full_text = best

    # Create annotation
    resp = make_annotation(bid, xpath, start, end, note, color)

    if resp and resp.get("id") and resp["id"] is not None:
        actual = resp.get("text", "")
        return {"status": "created", "id": resp["id"],
                "text": actual[:100] if actual else matched_text[:100],
                "xpath": xpath, "offsets": [start, end], "color": color}

    return {"error": f"Creation failed: {json.dumps(resp)}"}


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]
    if not args:
        print("Usage: annotate.py <bookmark_id> \"text to highlight\" [\"note\"] [color]")
        print("       annotate.py <bookmark_id> --list")
        print("Colors: yellow, red, blue, green, transparent")
        sys.exit(1)

    bid = args[0]

    if "--list" in args:
        html = get_article(bid)
        paragraphs = extract_paragraphs(html)
        for xpath, text in paragraphs[:30]:  # Limit output
            print(f"{xpath}: {text[:80].replace(chr(10), ' ')}")
        return

    if len(args) < 2:
        print("ERROR: search text required (or use --list)", file=sys.stderr)
        sys.exit(1)

    search_text = args[1]
    note = args[2] if len(args) > 2 else ""
    color = args[3] if len(args) > 3 else "yellow"

    if not os.environ.get("READECK_BASE_URL") or not os.environ.get("READECK_API_KEY"):
        print("ERROR: READECK_BASE_URL and READECK_API_KEY required", file=sys.stderr)
        sys.exit(1)

    result = find_and_annotate(bid, search_text, note, color)
    print(json.dumps(result, ensure_ascii=False))
    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    main()