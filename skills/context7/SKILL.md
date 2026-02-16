---
name: context7
description: Search and retrieve library documentation using Context7 API
---

# Context7 API - Agent Usage Guide

## Core Concept
Context7 provides up-to-date library documentation through a simple API. Use it to fetch relevant code examples, API references, and documentation for any library.

## Authentication
Context7 API requires an API key via the `x-api-key` header (not Bearer token).

**Required Environment Variable:**
- `CONTEXT7_API_KEY` - Your Context7 API key

**Never print or log the API key directly.**

## API Endpoints

### 1. Search for Libraries
Search for libraries by name or technology. Use this first to find the correct library ID.

**Endpoint:** `GET https://context7.com/api/v2/libs/search`

**Parameters:**
- `query` (required) - Search term (e.g., "react", "fastapi", "langchain")

**Example:**
```bash
curl -s "https://context7.com/api/v2/libs/search?query=react" \
  -H "x-api-key: $CONTEXT7_API_KEY"
```

**Response Fields:**
- `id` - Library ID (use this for context queries)
- `title` - Library name
- `description` - Brief description
- `totalSnippets` - Number of documentation snippets
- `trustScore` - Quality score (0-10)
- `benchmarkScore` - Performance score
- `verified` - Official verification status
- `score` - Relevance score for your query

### 2. Get Documentation Context
Retrieve relevant documentation snippets for a specific query.

**Endpoint:** `GET https://context7.com/api/v2/context`

**Parameters:**
- `libraryId` (required) - Library ID from search results (e.g., `/websites/react_dev`)
- `query` (required) - Your question or topic (e.g., "useEffect hook", "authentication")
- `type` (optional) - Response format: `json` (default) or `txt`
- `tokens` (optional) - Maximum tokens to return (default: varies)

**Example (JSON):**
```bash
curl -s "https://context7.com/api/v2/context?libraryId=/websites/react_dev&query=useEffect" \
  -H "x-api-key: $CONTEXT7_API_KEY"
```

**Example (Text):**
```bash
curl -s "https://context7.com/api/v2/context?libraryId=/websites/react_dev&query=useEffect&type=txt&tokens=500" \
  -H "x-api-key: $CONTEXT7_API_KEY"
```

**JSON Response Format:**
```json
{
  "results": [
    {
      "title": "useEffect Hook Reference",
      "content": "The useEffect Hook allows...",
      "source": "https://react.dev/reference/react/useEffect",
      "relevance": 0.95
    }
  ]
}
```

**Text Response Format:**
Plain markdown with relevant documentation sections, code examples, and references.

## Workflow

### Standard Workflow
```
1. Search for library
   ↓
   curl search endpoint with query
   ↓
2. Extract library ID from results
   ↓
   Parse JSON response, get "id" field
   ↓
3. Get documentation context
   ↓
   curl context endpoint with libraryId and query
   ↓
4. Parse and use documentation
   ↓
   Extract relevant snippets, examples, API docs
```

### Complete Example
```bash
#!/bin/bash

# Step 1: Search for library
echo "Searching for React..."
SEARCH_RESULT=$(curl -s "https://context7.com/api/v2/libs/search?query=react" \
  -H "x-api-key: $CONTEXT7_API_KEY")

# Step 2: Extract library ID (first result) using jq
LIBRARY_ID=$(echo "$SEARCH_RESULT" | jq -r '.results[0].id // empty')

if [ -z "$LIBRARY_ID" ]; then
  echo "No library found"
  exit 1
fi

echo "Found library: $LIBRARY_ID"

# Step 3: Get documentation
echo "Fetching useEffect documentation..."
curl -s "https://context7.com/api/v2/context?libraryId=$LIBRARY_ID&query=useEffect&type=txt&tokens=500" \
  -H "x-api-key: $CONTEXT7_API_KEY"
```

## Best Practices

### 1. Be Specific with Queries
```bash
# ✅ Good - specific question
curl -s "https://context7.com/api/v2/context?libraryId=/websites/react_dev&query=useEffect cleanup function" \
  -H "x-api-key: $CONTEXT7_API_KEY"

# ❌ Less optimal - vague query
curl -s "https://context7.com/api/v2/context?libraryId=/websites/react_dev&query=hooks" \
  -H "x-api-key: $CONTEXT7_API_KEY"
```

### 2. Choose the Right Library
When search returns multiple results, consider:
- **verified** status (official docs preferred)
- **trustScore** (higher is better, 0-10 scale)
- **benchmarkScore** (documentation quality)
- **totalSnippets** (more comprehensive)

```bash
# Parse and select best result using jq
BEST_LIBRARY=$(curl -s "https://context7.com/api/v2/libs/search?query=fastapi" \
  -H "x-api-key: $CONTEXT7_API_KEY" | \
  jq -r '.results | sort_by(-.trustScore, -.verified) | .[0].id')
```

### 3. Use Text Format for Code Generation
The `type=txt` format is better for:
- Code generation tasks
- Direct inclusion in prompts
- Reading in terminal

The `type=json` format is better for:
- Programmatic parsing
- Extracting specific fields (title, source URL)
- Building structured responses

### 4. Control Response Size
Use `tokens` parameter to limit response length:
```bash
# Quick reference - ~500 tokens
curl -s "https://context7.com/api/v2/context?libraryId=/websites/react_dev&query=useState&tokens=500" \
  -H "x-api-key: $CONTEXT7_API_KEY"

# Detailed docs - ~2000 tokens
curl -s "https://context7.com/api/v2/context?libraryId=/websites/react_dev&query=useState&tokens=2000" \
  -H "x-api-key: $CONTEXT7_API_KEY"
```

### 5. Cache Results
Documentation doesn't change frequently. Cache results to avoid rate limits:
```bash
CACHE_DIR="/tmp/context7_cache"
mkdir -p "$CACHE_DIR"

# Create cache key from query
CACHE_KEY=$(echo "$LIBRARY_ID-$QUERY" | md5)
CACHE_FILE="$CACHE_DIR/$CACHE_KEY.txt"

# Check cache first
if [ -f "$CACHE_FILE" ] && [ $(find "$CACHE_FILE" -mmin -1440 2>/dev/null) ]; then
  cat "$CACHE_FILE"
else
  # Fetch and cache
  curl -s "https://context7.com/api/v2/context?libraryId=$LIBRARY_ID&query=$QUERY&type=txt" \
    -H "x-api-key: $CONTEXT7_API_KEY" | tee "$CACHE_FILE"
fi
```

## Rate Limits

**Without API key:** Severely limited
**With API key (free tier):** 1000 requests per period

Check response headers:
- `ratelimit-limit` - Total requests allowed
- `ratelimit-remaining` - Requests remaining
- `ratelimit-reset` - Unix timestamp of reset

**Handle rate limits:**
```bash
response=$(curl -s -w "\n%{http_code}" "https://context7.com/api/v2/libs/search?query=react" \
  -H "x-api-key: $CONTEXT7_API_KEY")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "429" ]; then
  echo "Rate limit exceeded. Try again later."
  exit 1
fi

echo "$body"
```

## Error Handling

### Common Error Codes

| Code | Error | Meaning | Action |
|------|-------|---------|--------|
| 200 | Success | Request completed | Process response |
| 400 | Bad Request | Invalid parameters | Check query params |
| 401 | Unauthorized | Invalid API key | Verify CONTEXT7_API_KEY |
| 404 | Not Found | Library doesn't exist | Check library ID |
| 429 | Rate Limited | Too many requests | Wait and retry |
| 503 | Service Unavailable | Search failed | Retry later |

### Error Response Format
```json
{
  "error": "no_libraries_found",
  "message": "No libraries found for \"xyz\". Try a different search term."
}
```

### Robust Error Handling
```bash
fetch_context() {
  local library_id="$1"
  local query="$2"
  local max_retries=3
  local retry_count=0
  
  while [ $retry_count -lt $max_retries ]; do
    response=$(curl -s -w "\n%{http_code}" \
      "https://context7.com/api/v2/context?libraryId=$library_id&query=$query&type=txt" \
      -H "x-api-key: $CONTEXT7_API_KEY")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    case $http_code in
      200)
        echo "$body"
        return 0
        ;;
      429|503)
        retry_count=$((retry_count + 1))
        sleep $((2 ** retry_count))  # Exponential backoff
        ;;
      *)
        echo "Error: HTTP $http_code" >&2
        echo "$body" >&2
        return 1
        ;;
    esac
  done
  
  echo "Max retries exceeded" >&2
  return 1
}
```

## Integration with Other Skills

### With Python
When generating Python code:
```bash
# Get FastAPI authentication docs using jq
LIBRARY_ID=$(curl -s "https://context7.com/api/v2/libs/search?query=fastapi" \
  -H "x-api-key: $CONTEXT7_API_KEY" | jq -r '.results[0].id')

curl -s "https://context7.com/api/v2/context?libraryId=$LIBRARY_ID&query=oauth2 authentication&type=txt" \
  -H "x-api-key: $CONTEXT7_API_KEY"
```

### With LangGraph
Get LangGraph documentation for implementation:
```bash
# Search for LangGraph
curl -s "https://context7.com/api/v2/libs/search?query=langgraph" \
  -H "x-api-key: $CONTEXT7_API_KEY"

# Get specific patterns
curl -s "https://context7.com/api/v2/context?libraryId=/langchain-ai/langgraph&query=StateGraph conditional edges&type=txt" \
  -H "x-api-key: $CONTEXT7_API_KEY"
```

### With Docker
Get containerization best practices:
```bash
curl -s "https://context7.com/api/v2/libs/search?query=docker" \
  -H "x-api-key: $CONTEXT7_API_KEY"

curl -s "https://context7.com/api/v2/context?libraryId=/docker/docs&query=multi-stage builds&type=txt" \
  -H "x-api-key: $CONTEXT7_API_KEY"
```

## Useful Helpers

### Search and Get Helper Function
```bash
# Add to ~/.bashrc or script
context7() {
  local library_search="$1"
  local query="$2"
  local format="${3:-txt}"
  
  # Search for library and get first result's ID using jq
  local library_id=$(curl -s "https://context7.com/api/v2/libs/search?query=$library_search" \
    -H "x-api-key: $CONTEXT7_API_KEY" | jq -r '.results[0].id // empty')
  
  if [ -z "$library_id" ]; then
    echo "No library found for: $library_search" >&2
    return 1
  fi
  
  # Get documentation
  curl -s "https://context7.com/api/v2/context?libraryId=$library_id&query=$query&type=$format" \
    -H "x-api-key: $CONTEXT7_API_KEY"
}

# Usage
context7 "react" "useEffect cleanup"
context7 "fastapi" "dependency injection" "json"
```

### Pretty Print JSON Results
```bash
context7_json() {
  curl -s "https://context7.com/api/v2/context?libraryId=$1&query=$2" \
    -H "x-api-key: $CONTEXT7_API_KEY" | jq '.'
}
```

## When to Use Context7

**Use Context7 when:**
- ✅ Need up-to-date documentation for a library
- ✅ Want code examples for specific features
- ✅ Checking API signatures and parameters
- ✅ Learning best practices for a technology
- ✅ Verifying current syntax/patterns

**Don't use Context7 when:**
- ❌ You already know the answer
- ❌ Documentation is already in the codebase
- ❌ Question is about project-specific code
- ❌ Rate limit is exhausted

## Quick Reference

### One-liner: Search and Get Context
```bash
# Quick lookup using jq
curl -s "https://context7.com/api/v2/libs/search?query=react" -H "x-api-key: $CONTEXT7_API_KEY" | \
jq -r '.results[0].id' | \
xargs -I {} curl -s "https://context7.com/api/v2/context?libraryId={}&query=useEffect&type=txt" -H "x-api-key: $CONTEXT7_API_KEY"
```

### Common Libraries
Popular library IDs you might use frequently:
- React: `/websites/react_dev`
- FastAPI: `/fastapi/fastapi` (verify with search)
- LangChain: `/langchain-ai/langchain`
- Next.js: `/vercel/next.js`
- TypeScript: `/microsoft/TypeScript`

Always search first to get the most current/relevant library ID.

## Cross-References

Related skills:
- **jq**: [../jq/SKILL.md](../jq/SKILL.md) - JSON parsing with jq
- **Python Development**: [../python/SKILL.md](../python/SKILL.md)
- **OpenAI API**: [../openai/SKILL.md](../openai/SKILL.md)
- **LangGraph**: [../langgraph/SKILL.md](../langgraph/SKILL.md)
- **Docker**: [../docker/SKILL.md](../docker/SKILL.md)
- **General Practices**: [../general/SKILL.md](../general/SKILL.md)
