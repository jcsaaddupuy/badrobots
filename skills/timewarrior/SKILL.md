---
name: timewarrior
description: "TimeWarrior time tracking: start/stop intervals, query durations by tag or issue, compute totals for GitLab time reporting"
---

# TimeWarrior — AI Agent Reference

## How it integrates with TaskWarrior

The `~/.task/hooks/on-modify.timewarrior` hook is active. When you run `task ID start`, TimeWarrior automatically starts tracking with all the task's tags. When you run `task ID stop` or `task ID done`, tracking stops. **You do not need to call `timew start/stop` manually for TaskWarrior tasks.**

```
task 42 start   →  timew start "task title..." project tag1 tag2
task 42 done    →  timew stop
```

---

## Core commands

```bash
timew start "tag1" "tag2"     # start tracking with free-form tags
timew stop                     # stop current interval
timew summary                  # summary of all tracked time
timew summary :week            # this week only
timew summary :day             # today only
timew summary :ids :week       # include interval IDs (@N) in output
timew tags                     # list all known tags
timew export                   # JSON export of all intervals
timew export :week             # JSON export filtered to this week
```

---

## Export format

```json
[
  {
    "id": 6,
    "start": "20260507T130107Z",
    "end":   "20260507T130203Z",
    "tags":  ["my-project", "issue:#42", "some task description"]
  }
]
```

- `start` / `end`: compact ISO-8601 UTC (`YYYYMMDDTHHMMSSz`)
- `end` is absent when the interval is currently running
- `tags`: array of strings; a TaskWarrior task injects all its tags + full description as separate tag entries

---

## Tag conventions (TaskWarrior integration)

When a task is started via `task ID start`, the hook injects:
- The task description (full string) as one tag
- Each TaskWarrior tag as a separate tag
- The project name as a tag

**Issue references** land inside the description tag as `issue:#NN` or `issue:NN`.

---

## Compute time spent on a GitLab issue

```python
import json, re, subprocess
from datetime import datetime, timezone

def seconds_for_issue(issue_num: int) -> int:
    raw = subprocess.check_output(["timew", "export"])
    records = json.loads(raw)
    total = 0
    pattern = re.compile(r'issue:#?' + str(issue_num) + r'\b')
    for r in records:
        if not any(pattern.search(t) for t in r.get("tags", [])):
            continue
        start = datetime.strptime(r["start"], "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        if "end" in r:
            end = datetime.strptime(r["end"], "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        else:
            end = datetime.now(timezone.utc)   # still running
        total += int((end - start).total_seconds())
    return total

def to_gitlab_duration(secs: int) -> str:
    """Convert seconds to a GitLab-accepted duration string (e.g. '1h 30m')."""
    h = secs // 3600
    m = (secs % 3600) // 60
    s = secs % 60
    parts = []
    if h: parts.append(f"{h}h")
    if m: parts.append(f"{m}m")
    if s and not parts: parts.append(f"{s}s")   # only show seconds if < 1 min
    return " ".join(parts) or "0m"
```

---

## Shell one-liner: seconds for an issue

```bash
timew export | python3 -c "
import sys, json, re
from datetime import datetime, timezone
records = json.load(sys.stdin)
total = 0
pat = re.compile(r'issue:#?43\b')
for r in records:
    if not any(pat.search(t) for t in r.get('tags',[])):
        continue
    s = datetime.strptime(r['start'],'%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
    e = datetime.strptime(r['end'],'%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc) if 'end' in r else datetime.now(timezone.utc)
    total += int((e-s).total_seconds())
h,m = divmod(total//60, 60)
print(f'{h}h {m}m ({total}s)')
"
```

---

## Gotchas

- `timew summary TAG` filters only if TAG exactly matches one of the interval's tags. For issue refs embedded inside long description tags, always use `timew export` + Python grep.
- An interval without `end` is still running — always handle it as `now` in calculations.
- Duration format for GitLab: `Nh`, `Nm`, `Ns`, `NhNm`, `1h 30m`, `90m` all accepted. Avoid `1.5h` (works but inconsistent).
