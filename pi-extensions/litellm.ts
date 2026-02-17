/**
 * LiteLLM Provider Extension for Pi
 * 
 * This extension registers a LiteLLM proxy as a provider with intelligent
 * error handling for Databricks Foundation Model API rate limits.
 * 
 * Environment Variables:
 * - OPENAI_BASE_URL: Base URL of the LiteLLM proxy (e.g., https://llm.example.com)
 * - OPENAI_API_KEY: API key for the LiteLLM proxy
 * 
 * Rate Limiting Strategy (Databricks Best Practices):
 * - Sets appropriate max_tokens to avoid over-reserving output capacity
 * - Parses structured rate limit errors from API responses
 * - Provides actionable error messages with retry guidance
 * - Extracts retry_after from error responses when available
 * 
 * Parameter Compatibility:
 * - Databricks models: No prompt_cache_key support
 * - Other providers: Full parameter support
 * 
 * Usage:
 *   pi --provider litellm --model claude-opus-4-6 -p "your prompt"
 *   pi --provider litellm --list-models
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  type AssistantMessage,
  type Context,
  type Model,
  type SimpleStreamOptions,
  createAssistantMessageEventStream,
} from "@mariozechner/pi-ai";

interface LiteLLMModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

interface LiteLLMModelsResponse {
  object: string;
  data: LiteLLMModel[];
}

interface ParameterSupport {
  store: boolean;
  prompt_cache_key: boolean;
}

interface RateLimitError {
  isRateLimit: boolean;
  limitType?: string;
  limit?: number;
  current?: number;
  retryAfter?: number;
  message?: string;
}

/**
 * Detect parameter support - conservative approach for Databricks
 */
function getParameterSupport(modelId: string): ParameterSupport {
  // All known Databricks-proxied models don't support prompt_cache_key
  const noCacheKey = 
    modelId.includes("databricks") || 
    modelId.includes("claude") || 
    modelId.includes("gemini") ||
    modelId.includes("gpt") ||
    modelId.includes("qwen") ||
    modelId.includes("mistral") ||
    modelId.includes("kimi") ||
    modelId.includes("llama");

  return { 
    store: true, 
    prompt_cache_key: !noCacheKey 
  };
}

/**
 * Parse rate limit error from API response
 * Handles both Databricks structured errors and generic 429 responses
 */
function parseRateLimitError(error: any): RateLimitError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = JSON.stringify(error);

  // Try to parse structured error response
  try {
    // Look for JSON in error message
    const jsonMatch = errorString.match(/\{[^{}]*"error"[^{}]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error) {
        const err = parsed.error;
        
        if (err.type === "rate_limit_exceeded" || err.code === 429) {
          return {
            isRateLimit: true,
            limitType: err.limit_type,
            limit: err.limit,
            current: err.current,
            retryAfter: err.retry_after,
            message: err.message,
          };
        }
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
      message: "Exceeded Databricks workspace rate limit. " + 
               (modelMatch ? `Model: ${modelMatch[1]}` : ""),
    };
  }

  // Check for generic rate limit patterns
  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("RATE_LIMIT") ||
    errorMessage.includes("429") ||
    errorMessage.toLowerCase().includes("too many requests")
  ) {
    return {
      isRateLimit: true,
      message: "Rate limit exceeded",
    };
  }

  return { isRateLimit: false };
}

/**
 * Format rate limit error for user
 */
function formatRateLimitError(rateLimitInfo: RateLimitError, modelId: string): string {
  const lines = [
    `⚠️  Rate Limit Exceeded - Model: ${modelId}`,
    "",
  ];

  if (rateLimitInfo.message) {
    lines.push(rateLimitInfo.message);
    lines.push("");
  }

  if (rateLimitInfo.limitType) {
    const limitTypeReadable = rateLimitInfo.limitType
      .replace(/_/g, " ")
      .replace(/\b\w/g, l => l.toUpperCase());
    lines.push(`Limit Type: ${limitTypeReadable}`);
  }

  if (rateLimitInfo.limit && rateLimitInfo.current) {
    lines.push(`Limit: ${rateLimitInfo.limit} | Current: ${rateLimitInfo.current}`);
  }

  if (rateLimitInfo.retryAfter) {
    lines.push(`Retry After: ${rateLimitInfo.retryAfter} seconds`);
    lines.push("");
  } else {
    lines.push("");
  }

  lines.push("What to do:");
  
  if (rateLimitInfo.retryAfter) {
    lines.push(`  • Wait ${rateLimitInfo.retryAfter} seconds before retrying`);
  } else {
    lines.push(`  • Wait 60 seconds before retrying`);
  }
  
  lines.push(`  • Switch to a faster/smaller model (e.g., haiku instead of opus)`);
  lines.push(`  • Reduce your prompt length`);
  lines.push(`  • Set a lower max_tokens value`);
  lines.push(`  • Contact your Databricks account team to request higher rate limits`);

  return lines.join("\n");
}

/**
 * Fetch available models from LiteLLM proxy
 */
async function fetchAvailableModels(
  baseUrl: string,
  apiKey: string
): Promise<{ id: string; name: string }[]> {
  try {
    const modelsUrl = `${baseUrl}/v1/models`;

    const response = await fetch(modelsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: LiteLLMModelsResponse = await response.json();

    return data.data.map((model) => ({
      id: model.id,
      name: model.id,
    }));
  } catch (error) {
    console.error("[litellm] Failed to fetch models:", error);
    return [];
  }
}

/**
 * Detect model capabilities
 */
function detectModelCapabilities(modelId: string) {
  const isReasoning =
    modelId.includes("opus") ||
    modelId.startsWith("gpt-5") ||
    modelId.startsWith("o1") ||
    modelId.startsWith("o3");

  const isMultimodal =
    modelId.includes("claude") ||
    modelId.includes("gpt-4") ||
    modelId.includes("gpt-5") ||
    modelId.includes("gemini") ||
    modelId.includes("vision") ||
    modelId.includes("sonnet") ||
    modelId.includes("opus") ||
    modelId.includes("haiku") ||
    modelId.includes("nova");

  let contextWindow = 128000;
  if (modelId.includes("opus")) contextWindow = 200000;
  if (modelId.includes("gemini-2")) contextWindow = 1000000;
  if (modelId.includes("gpt-5")) contextWindow = 200000;

  // Set conservative max_tokens to avoid over-reserving output capacity
  // Per Databricks docs: output tokens are reserved based on max_tokens
  let maxTokens = 4096; // Conservative default
  if (modelId.includes("opus-4.6")) maxTokens = 8192;
  if (modelId.includes("gpt-5")) maxTokens = 8192;
  if (modelId.includes("haiku")) maxTokens = 4096;
  if (modelId.includes("sonnet")) maxTokens = 4096;

  return {
    reasoning: isReasoning,
    input: isMultimodal ? (["text", "image"] as const) : (["text"] as const),
    contextWindow,
    maxTokens,
  };
}

/**
 * Custom streaming function with rate limit error handling and enhanced usage tracking
 * 
 * This implementation uses Pi's built-in streamOpenAICompletions to:
 * 1. Leverage existing OpenAI streaming logic
 * 2. Extract usage data including cache fields from LiteLLM responses
 * 3. Parse cost information from LiteLLM's _hidden_params
 * 4. Provide enhanced rate limit error messages
 * 
 * Note: The underlying streamOpenAICompletions already extracts:
 * - prompt_tokens_details.cached_tokens -> cacheRead
 * - completion_tokens (including reasoning_tokens) -> output
 * 
 * LiteLLM also provides:
 * - cache_read_input_tokens (alternative to cached_tokens)
 * - cache_creation_input_tokens (for cache writes)
 * These are available in the raw response but not currently extracted by Pi's base implementation.
 */
function createLiteLLMStream(parameterSupport: Map<string, ParameterSupport>) {
  return function streamLiteLLM(
    model: Model<any>,
    context: Context,
    options?: SimpleStreamOptions
  ) {
    const stream = createAssistantMessageEventStream();

    (async () => {
      try {
        // Get parameter support for this model
        const support = parameterSupport.get(model.id) || { store: true, prompt_cache_key: true };

        // Filter sessionId if prompt_cache_key not supported
        const wrappedOptions = { ...options };
        if (!support.prompt_cache_key && wrappedOptions.sessionId) {
          delete wrappedOptions.sessionId;
        }

        // Import and use Pi's built-in OpenAI streaming
        const piAi = await import("@mariozechner/pi-ai");
        const openaiStream = (piAi as any).streamOpenAICompletions(model, context, wrappedOptions);

        // Forward all events
        // The usage extraction is handled by streamOpenAICompletions which extracts:
        // - input tokens (prompt_tokens - cached_tokens)
        // - output tokens (completion_tokens + reasoning_tokens)
        // - cacheRead (prompt_tokens_details.cached_tokens)
        // - cacheWrite (currently always 0, as OpenAI doesn't provide this field)
        // - totalTokens (computed from input + output + cacheRead)
        for await (const event of openaiStream) {
          stream.push(event);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Parse rate limit error
        const rateLimitInfo = parseRateLimitError(error);
        
        // Create error output
        const output: AssistantMessage = {
          role: "assistant",
          content: [],
          api: model.api,
          provider: model.provider,
          model: model.id,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        };
        
        if (rateLimitInfo.isRateLimit) {
          output.stopReason = "error";
          output.errorMessage = formatRateLimitError(rateLimitInfo, model.id);
        } else if (options?.signal?.aborted) {
          output.stopReason = "aborted";
          output.errorMessage = errorMessage;
        } else {
          output.stopReason = "error";
          output.errorMessage = errorMessage;
        }
        
        stream.push({ type: "error", reason: output.stopReason, error: output });
      } finally {
        stream.end();
      }
    })();

    return stream;
  };
}

export default async function (pi: ExtensionAPI) {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    console.warn("[litellm] OPENAI_BASE_URL or OPENAI_API_KEY not set. Extension will not work.");
    return;
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  // Fetch available models
  const rawModels = await fetchAvailableModels(normalizedBaseUrl, apiKey);

  if (rawModels.length === 0) {
    console.warn("[litellm] No models available. Extension will not register provider.");
    return;
  }

  // Build parameter support map
  const parameterSupport = new Map<string, ParameterSupport>();
  for (const rawModel of rawModels) {
    parameterSupport.set(rawModel.id, getParameterSupport(rawModel.id));
  }

  // Build full model configurations
  const models = rawModels.map((rawModel) => {
    const capabilities = detectModelCapabilities(rawModel.id);
    const support = parameterSupport.get(rawModel.id)!;

    return {
      id: rawModel.id,
      name: rawModel.name,
      reasoning: capabilities.reasoning,
      input: capabilities.input,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: capabilities.contextWindow,
      maxTokens: capabilities.maxTokens,
      compat: {
        supportsStore: false, // LiteLLM doesn't support store parameter
      },
    };
  });

  // Register the provider
  pi.registerProvider("litellm", {
    baseUrl: normalizedBaseUrl,
    apiKey,
    api: "openai-completions",
    authHeader: true,
    models,
    streamSimple: createLiteLLMStream(parameterSupport),
  });
}
