---
name: litellm-provider-extension
description: Create or debug a Pi extension that registers a LiteLLM proxy as a provider, handling model discovery, parameter compatibility, and streaming. Use when integrating LiteLLM with Pi or troubleshooting proxy-based model providers.
---

# LiteLLM Provider Extension

Create a production-ready Pi extension that registers a LiteLLM proxy as a model provider with automatic model discovery and parameter compatibility handling.

## Overview

This skill implements a generic extension that:
- Auto-discovers models from LiteLLM's `/v1/models` endpoint
- Detects and filters unsupported parameters based on backend providers
- Handles streaming via wrapped Azure OpenAI Responses API
- Operates silently (minimal logging)

## Key Implementation Steps

### 1. Understand the Architecture

**Pi's Provider System:**
- Extensions register providers via `pi.registerProvider()`
- Providers specify: `baseUrl`, `apiKey`, `api` type, and `models` array
- Each model has: `id`, `name`, `reasoning`, `input`, `cost`, `contextWindow`, `maxTokens`, `compat` flags

**LiteLLM Challenges:**
- Different backends (Databricks, Azure, OpenAI) support different parameters
- Some models reject `store` or `prompt_cache_key` parameters
- Must filter parameters at stream time to avoid errors

### 2. Environment Setup

Required environment variables:
```bash
export OPENAI_BASE_URL="https://your-litellm-proxy.example.com"
export OPENAI_API_KEY="your-api-key"
```

### 3. Model Discovery

Fetch models from LiteLLM:
```typescript
const response = await fetch(`${baseUrl}/v1/models`, {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
});
const data = await response.json();
const models = data.data; // Array of { id, object, created, owned_by }
```

### 4. Parameter Compatibility Detection

**Known patterns from testing:**

| Model Pattern | `store` | `prompt_cache_key` | Backend |
|--------------|---------|-------------------|---------|
| `claude*` | ✅ | ❌ | Databricks |
| `gemini*` | ✅ | ❌ | Databricks |
| `gpt*` | ✅ | ✅ | Azure/OpenAI |
| `databricks*` | ✅ | ❌ | Databricks |
| Others | ✅ | ✅ | Default (fail-open) |

**Implementation:**
```typescript
function getParameterSupport(modelId: string) {
  if (modelId.includes("claude") || modelId.includes("gemini") || modelId.includes("databricks")) {
    return { store: true, prompt_cache_key: false };
  }
  return { store: true, prompt_cache_key: true };
}
```

**Why these patterns:**
- Databricks backend validates strictly and rejects `prompt_cache_key`
- Error example: `"message":"prompt_cache_key: Extra inputs are not permitted"`

### 5. Model Capability Detection

**Reasoning models:**
- Contains: `opus`, `with-reasoning`
- Starts with: `gpt-5`, `o1`, `o3`

**Multimodal (text + images):**
- Contains: `claude`, `gpt-4`, `gpt-5`, `gemini`, `sonnet`, `opus`, `haiku`, `nova`

**Context windows:**
- `opus`: 200K
- `gemini-2`: 1M
- `gpt-5`: 200K
- Default: 128K

**Max output tokens:**
- Conservative approach: 4096 default (prevents over-reservation)
- `opus-4.6`: 8192
- `gpt-5`: 8192
- `haiku`: 4096
- `sonnet`: 4096

**Why conservative?** Databricks reserves output capacity based on max_tokens.
Lower values = higher admission success rate.

### 6. Custom Streaming Function

The key to parameter filtering is a custom `streamSimple` function:

```typescript
function createLiteLLMStream(parameterSupport: Map<string, ParameterSupport>) {
  return function streamLiteLLM(model, context, options) {
    const stream = createAssistantMessageEventStream();
    
    (async () => {
      const support = parameterSupport.get(model.id);
      const wrappedOptions = { ...options };
      
      // Filter sessionId if prompt_cache_key not supported
      if (!support.prompt_cache_key && wrappedOptions.sessionId) {
        delete wrappedOptions.sessionId;
      }
      
      // Use built-in Azure streaming with filtered options
      const piAi = await import("@mariozechner/pi-ai");
      const azureStream = piAi.streamAzureOpenAIResponses(model, context, wrappedOptions);
      
      // Forward all events
      for await (const event of azureStream) {
        stream.push(event);
      }
    })();
    
    return stream;
  };
}
```

**Why this approach:**
- Reuses battle-tested `streamAzureOpenAIResponses` implementation
- `sessionId` option becomes `prompt_cache_key` parameter in Azure provider
- `compat.supportsStore` flag handles `store` parameter automatically
- No need to reimplement stream parsing/event handling

### 7. Provider Registration

```typescript
pi.registerProvider("litellm", {
  baseUrl: normalizedBaseUrl,
  apiKey,
  api: "azure-openai-responses",  // Use Azure API (most compatible)
  authHeader: true,                // Add Authorization: Bearer header
  models,
  streamSimple: createLiteLLMStream(parameterSupport),
});
```

### 8. Testing Strategy

**Test each parameter support pattern:**

```bash
# Claude (no prompt_cache_key)
pi --provider litellm --model claude-haiku-4-5 -p "test"

# GPT (full support)
pi --provider litellm --model gpt-5.2 -p "test"

# Gemini (no prompt_cache_key)
pi --provider litellm --model gemini-2-5-pro -p "test"
```

**What to verify:**
- No API errors about unsupported parameters
- Responses complete successfully
- No verbose logging pollution

### 9. Rate Limit Handling (Databricks Best Practices)

**IMPORTANT:** Use **reactive** error handling, NOT proactive rate limiting.

**Why reactive wins:**
- ✅ Databricks does admission control with pre-admission checks
- ✅ Token bucket with automatic credit-back (unused tokens returned)
- ✅ Structured 429 errors with `retry_after`, `limit_type`, `limit`, `current`
- ✅ Client-side tracking is error-prone and causes false positives
- ✅ Can't know actual workspace tier limits or other users' consumption

**Key Databricks concepts:**
1. **Output tokens are RESERVED** based on `max_tokens` before admission
2. **Credit-back system** returns unused tokens immediately to allowance
3. **Pre-admission checks** reject requests before processing (get 429 instantly)
4. **Sliding window** with burst capacity allows short bursts above nominal rate
5. **Most restrictive applies** - ITPM, OTPM, or QPH (whichever hits first)

**Implementation strategy:**

**Step 1: Set conservative max_tokens**
```typescript
// Databricks reserves output capacity based on max_tokens
// Lower values = higher admission success rate
let maxTokens = 4096; // Conservative default
if (modelId.includes("opus-4.6")) maxTokens = 8192;
if (modelId.includes("haiku")) maxTokens = 4096;
if (modelId.includes("sonnet")) maxTokens = 4096;
if (modelId.includes("gpt-5")) maxTokens = 8192;
```

**Step 2: Parse structured rate limit errors**
```typescript
function parseRateLimitError(error: any): RateLimitError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = JSON.stringify(error);

  // Look for structured JSON error response
  try {
    const jsonMatch = errorString.match(/\{[^{}]*"error"[^{}]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error?.type === "rate_limit_exceeded") {
        return {
          isRateLimit: true,
          limitType: parsed.error.limit_type,
          limit: parsed.error.limit,
          current: parsed.error.current,
          retryAfter: parsed.error.retry_after,
          message: parsed.error.message,
        };
      }
    }
  } catch (e) {
    // Fallback to pattern matching
  }

  // Check for Databricks REQUEST_LIMIT_EXCEEDED
  if (errorMessage.includes("REQUEST_LIMIT_EXCEEDED")) {
    const modelMatch = errorMessage.match(/rate limit for ([\w-]+)/i);
    const typeMatch = errorMessage.match(/(input|output) tokens per minute/i);
    
    return {
      isRateLimit: true,
      limitType: typeMatch ? `${typeMatch[1]}_tokens_per_minute` : "unknown",
      message: "Exceeded Databricks workspace rate limit",
    };
  }

  // Generic rate limit patterns
  if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
    return { isRateLimit: true, message: "Rate limit exceeded" };
  }

  return { isRateLimit: false };
}
```

**Step 3: Format user-friendly error messages**
```typescript
function formatRateLimitError(info: RateLimitError, modelId: string): string {
  const lines = [
    `⚠️  Rate Limit Exceeded - Model: ${modelId}`,
    "",
    info.message || "Rate limit exceeded",
    "",
  ];

  if (info.limitType) {
    lines.push(`Limit Type: ${info.limitType.replace(/_/g, " ")}`);
  }

  if (info.limit && info.current) {
    lines.push(`Limit: ${info.limit} | Current: ${info.current}`);
  }

  if (info.retryAfter) {
    lines.push(`Retry After: ${info.retryAfter} seconds`);
  }

  lines.push("");
  lines.push("What to do:");
  lines.push(`  • Wait ${info.retryAfter || 60} seconds before retrying`);
  lines.push(`  • Switch to a smaller model (e.g., haiku instead of opus)`);
  lines.push(`  • Reduce prompt length or max_tokens`);
  lines.push(`  • Contact Databricks account team for higher limits`);

  return lines.join("\n");
}
```

**Step 4: Handle in streaming function**
```typescript
try {
  const azureStream = streamAzureOpenAIResponses(model, context, options);
  for await (const event of azureStream) {
    stream.push(event);
  }
} catch (error) {
  const rateLimitInfo = parseRateLimitError(error);
  
  if (rateLimitInfo.isRateLimit) {
    output.stopReason = "error";
    output.errorMessage = formatRateLimitError(rateLimitInfo, model.id);
  } else {
    output.stopReason = "error";
    output.errorMessage = error.message;
  }
  
  stream.push({ type: "error", reason: output.stopReason, error: output });
} finally {
  stream.end();
}
```

**Databricks Rate Limits (Enterprise Tier):**
- Claude Opus 4.6: 200K ITPM, 20K OTPM
- Claude Sonnet 4.5: 50K ITPM, 5K OTPM
- Claude Haiku 4.5: 50K ITPM, 5K OTPM
- GPT-5.2: 50K ITPM, 5K OTPM, 360K QPH
- Gemini 2.5 Pro: 200K ITPM, 20K OTPM, 360K QPH

**DON'T implement:**
- ❌ Client-side token bucket tracking
- ❌ Pre-request rate limit checks
- ❌ Credit-back tracking
- ❌ Sliding window calculations

**Reason:** Databricks does this better server-side with full visibility.

**Reference:** https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/limits

**Why NOT proactive rate limiting?**

Initially considered: Client-side token bucket to pre-reject requests.

**Why it doesn't work:**
- ❌ Can't know actual workspace tier limits (varies by customer)
- ❌ Can't track other users/sessions in same workspace
- ❌ Can't track Databricks credit-back system (returns unused tokens)
- ❌ Can't replicate sliding window algorithm accurately
- ❌ Creates false positives (blocking valid requests)
- ❌ Adds 200+ lines of complex, error-prone code

**Databricks provides everything needed:**
```json
{
  "error": {
    "type": "rate_limit_exceeded",
    "code": 429,
    "limit_type": "input_tokens_per_minute",
    "limit": 200000,
    "current": 200150,
    "retry_after": 15
  }
}
```

Let the experts handle rate limiting. Focus on clear error messages.

### 10. Common Errors and Solutions

**Error:** `"prompt_cache_key: Extra inputs are not permitted"`
- **Cause:** Model backend doesn't support prompt_cache_key
- **Solution:** Filter `sessionId` option for that model

**Error:** `"REQUEST_LIMIT_EXCEEDED"` or `429 Too Many Requests`
- **Cause:** Exceeded ITPM, OTPM, or QPH limits
- **Solution:** Parse error, show retry_after, suggest smaller model/lower max_tokens

**Error:** `Cannot find module 'openai'`
- **Cause:** Trying to import OpenAI SDK directly
- **Solution:** Use dynamic import of `@mariozechner/pi-ai` instead

**Error:** Model not found
- **Cause:** Model name mismatch or not in `/v1/models` response
- **Solution:** Check `pi --provider litellm --list-models`

**Error:** Infinite loop / repeated requests
- **Cause:** Stream not properly forwarding events
- **Solution:** Ensure `for await` loop pushes all events and calls `stream.end()`

## Complete Implementation Template

See `~/.pi/agent/extensions/litellm.ts` for the full reference implementation.

Key files to create:
1. **Extension:** `~/.pi/agent/extensions/litellm.ts` (main code)
2. **Documentation:** `~/.pi/agent/extensions/README-litellm.md` (usage guide)

## Extension Structure

```typescript
// 1. Imports
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createAssistantMessageEventStream, ... } from "@mariozechner/pi-ai";

// 2. Type definitions
interface ParameterSupport { store: boolean; prompt_cache_key: boolean; }
interface RateLimitError { isRateLimit: boolean; limitType?: string; ... }

// 3. Helper functions
function getParameterSupport(modelId: string): ParameterSupport { ... }
function detectModelCapabilities(modelId: string) { ... }
async function fetchAvailableModels(baseUrl, apiKey) { ... }
function parseRateLimitError(error: any): RateLimitError { ... }
function formatRateLimitError(info: RateLimitError, modelId: string): string { ... }
function createLiteLLMStream(parameterSupport) { ... }

// 4. Main export
export default async function (pi: ExtensionAPI) {
  // Check environment
  // Fetch models
  // Build parameter support map
  // Build model configurations (with conservative max_tokens)
  // Register provider
}
```

## Best Practices

1. **No runtime API testing** - Use pattern-based detection for fast startup
2. **Fail-open for unknown models** - Assume full support rather than breaking
3. **Minimal logging** - Only log errors/warnings, not info messages
4. **Leverage existing implementations** - Wrap Azure provider, don't reimplement
5. **Document parameter support** - Include compatibility matrix in README
6. **Conservative max_tokens** - Prevents over-reserving output capacity
7. **Reactive error handling** - Let Databricks handle rate limiting, parse structured errors
8. **User-friendly error messages** - Show retry_after, limit type, and actionable suggestions
9. **Don't track client-side** - Databricks credit-back system makes it impossible to track accurately

## Verification

After implementation:
```bash
# Check registration
pi --provider litellm --list-models

# Test various backends
pi --provider litellm --model claude-opus-4-6 -p "hello"
pi --provider litellm --model gpt-5.2 -p "count to 3"
pi --provider litellm --model gemini-2-5-pro -p "hi"

# Verify clean output (no verbose logs)
pi --provider litellm --model gpt-5.2 -p "test" 2>&1 | head -5

# Check max_tokens are conservative (4-8K, not 16K+)
pi --provider litellm --list-models | grep litellm | head -5
# Should show max-out around 4.1K-8.2K

# Test rate limit error formatting (if you can trigger it)
# Make rapid requests to potentially hit limits
for i in {1..10}; do
  pi --provider litellm --model claude-opus-4-6 -p "Count to $i"
done
# Should see clear error message with retry guidance if rate limited
```

## Reference Documentation

- **Pi Extensions:** `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
- **Custom Providers:** `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/custom-provider.md`
- **Azure Provider Source:** `pi-mono/packages/ai/src/providers/azure-openai-responses.ts`
- **LiteLLM Docs:** https://docs.litellm.ai/
- **Databricks Rate Limits:** https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/limits

## Session Learning Summary

From implementation sessions:

**Parameter Compatibility:**
1. **Parameter testing reveals reality** - Don't assume, test actual API responses
2. **Claude models (Databricks)** - Accept `store` but reject `prompt_cache_key`
3. **GPT models (Databricks)** - Same as Claude on Databricks backend
4. **Gemini models (Databricks)** - Same limitations as Claude
5. **Filtering at stream-time works** - Remove `sessionId` option before calling Azure provider
6. **Pattern-based detection is fast** - No need to test on every startup
7. **Wrapping existing providers** - Safer than reimplementing stream parsing

**Rate Limit Handling:**
1. **Reactive > Proactive** - Let Databricks handle admission control, parse errors
2. **Conservative max_tokens** - Reduces output reservation, increases admission success
3. **Databricks credits back** - Unused tokens returned automatically, can't track client-side
4. **Structured errors** - Parse `retry_after`, `limit_type`, `limit`, `current` from 429s
5. **Pre-admission checks** - Databricks rejects before processing, get 429 immediately
6. **User guidance matters** - Show exactly which limit hit and how long to wait
7. **Don't replicate server logic** - Client-side tracking causes false positives

**Key insight:** Databricks API is designed for reactive handling. Don't fight it.

## Troubleshooting Checklist

- [ ] Environment variables set (`OPENAI_BASE_URL`, `OPENAI_API_KEY`)
- [ ] LiteLLM proxy accessible (test `/v1/models` endpoint)
- [ ] Extension file in correct location (`~/.pi/agent/extensions/`)
- [ ] No syntax errors (TypeScript compilation via jiti)
- [ ] Provider shows in `--list-models` output
- [ ] Test model responds without errors
- [ ] No verbose logging pollution
- [ ] Parameter support matches model backend
- [ ] Rate limit errors show clear, actionable messages
- [ ] max_tokens set conservatively (4-8K, not 16K+)

## Related Skills

- **api-integration** - General API integration patterns
- **typescript-extension** - TypeScript extension development
- **debugging-streaming** - Debug stream-based APIs
