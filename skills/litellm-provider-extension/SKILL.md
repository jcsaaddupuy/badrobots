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
- `opus`: 16K
- `gemini`: 8K
- `gpt-5`: 32K
- Default: 16K

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

### 9. Common Errors and Solutions

**Error:** `"prompt_cache_key: Extra inputs are not permitted"`
- **Cause:** Model backend doesn't support prompt_cache_key
- **Solution:** Filter `sessionId` option for that model

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

// 3. Helper functions
function getParameterSupport(modelId: string): ParameterSupport { ... }
function detectModelCapabilities(modelId: string) { ... }
async function fetchAvailableModels(baseUrl, apiKey) { ... }
function createLiteLLMStream(parameterSupport) { ... }

// 4. Main export
export default async function (pi: ExtensionAPI) {
  // Check environment
  // Fetch models
  // Build parameter support map
  // Build model configurations
  // Register provider
}
```

## Best Practices

1. **No runtime API testing** - Use pattern-based detection for fast startup
2. **Fail-open for unknown models** - Assume full support rather than breaking
3. **Minimal logging** - Only log errors/warnings, not info messages
4. **Leverage existing implementations** - Wrap Azure provider, don't reimplement
5. **Document parameter support** - Include compatibility matrix in README

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
```

## Reference Documentation

- **Pi Extensions:** `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
- **Custom Providers:** `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/custom-provider.md`
- **Azure Provider Source:** `pi-mono/packages/ai/src/providers/azure-openai-responses.ts`
- **LiteLLM Docs:** https://docs.litellm.ai/

## Session Learning Summary

From this implementation session:
1. **Parameter testing reveals reality** - Don't assume, test actual API responses
2. **Claude models (Databricks)** - Accept `store` but reject `prompt_cache_key`
3. **GPT models support everything** - Both parameters work fine
4. **Gemini models (Databricks)** - Same limitations as Claude
5. **Filtering at stream-time works** - Remove `sessionId` option before calling Azure provider
6. **Pattern-based detection is fast** - No need to test on every startup
7. **Wrapping existing providers** - Safer than reimplementing stream parsing

## Troubleshooting Checklist

- [ ] Environment variables set (`OPENAI_BASE_URL`, `OPENAI_API_KEY`)
- [ ] LiteLLM proxy accessible (test `/v1/models` endpoint)
- [ ] Extension file in correct location (`~/.pi/agent/extensions/`)
- [ ] No syntax errors (TypeScript compilation via jiti)
- [ ] Provider shows in `--list-models` output
- [ ] Test model responds without errors
- [ ] No verbose logging pollution
- [ ] Parameter support matches model backend

## Related Skills

- **api-integration** - General API integration patterns
- **typescript-extension** - TypeScript extension development
- **debugging-streaming** - Debug stream-based APIs
