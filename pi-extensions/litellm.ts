/**
 * LiteLLM Provider Extension for Pi
 * 
 * This extension registers a LiteLLM proxy as a provider, automatically discovering
 * available models and handling parameter compatibility issues.
 * 
 * Environment Variables:
 * - OPENAI_BASE_URL: Base URL of the LiteLLM proxy (e.g., https://llm.example.com)
 * - OPENAI_API_KEY: API key for the LiteLLM proxy
 * 
 * Parameter Compatibility:
 * Different backend providers have different parameter support:
 * - Claude models (Databricks): store=yes, prompt_cache_key=no
 * - Gemini models (Databricks): store=yes, prompt_cache_key=no
 * - GPT models: store=yes, prompt_cache_key=yes
 * - Others: Assume full support (fail-open)
 * 
 * The extension automatically filters unsupported parameters to prevent API errors.
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

/**
 * Detect parameter support based on model name patterns.
 * Based on actual testing:
 * - Claude models (Databricks backend): store=true, prompt_cache_key=false
 * - GPT models: store=true, prompt_cache_key=true
 * - Gemini models (Databricks backend): store=true, prompt_cache_key=false
 * - Other models: assume both supported (fail-open)
 */
function getParameterSupport(modelId: string): ParameterSupport {
  // Claude models - Databricks doesn't support prompt_cache_key
  if (modelId.includes("claude")) {
    return { store: true, prompt_cache_key: false };
  }
  if (modelId.includes("qwen3")) {
    return { store: true, prompt_cache_key: false };
  }
  // Gemini models - Databricks doesn't support prompt_cache_key
  if (modelId.includes("gemini")) {
    return { store: true, prompt_cache_key: false };
  }

  // GPT models - full support
  if (modelId.includes("gpt")) {
    return { store: true, prompt_cache_key: true };
  }

  // Databricks-prefixed models - likely don't support prompt_cache_key
  if (modelId.includes("databricks")) {
    return { store: true, prompt_cache_key: false };
  }

  // Other models - assume full support (fail-open)
  return { store: true, prompt_cache_key: true };
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
 * Detect model capabilities based on name patterns and known model families.
 */
function detectModelCapabilities(modelId: string) {
  // Reasoning models
  const isReasoning =
    modelId.includes("with-reasoning") ||
    modelId.includes("opus") ||
    modelId.startsWith("gpt-5") ||
    modelId.startsWith("o1") ||
    modelId.startsWith("o3");

  // Multimodal support (most modern models support images)
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

  // Context window (conservative defaults, can be overridden)
  let contextWindow = 128000;
  if (modelId.includes("opus")) contextWindow = 200000;
  if (modelId.includes("gemini-2")) contextWindow = 1000000;
  if (modelId.includes("gpt-5")) contextWindow = 200000;

  // Max tokens
  let maxTokens = 16384;
  if (modelId.includes("opus")) maxTokens = 16384;
  if (modelId.includes("gemini")) maxTokens = 8192;
  if (modelId.includes("gpt-5")) maxTokens = 32768;

  return {
    reasoning: isReasoning,
    input: isMultimodal ? (["text", "image"] as const) : (["text"] as const),
    contextWindow,
    maxTokens,
  };
}

/**
 * Custom streaming function for LiteLLM that filters unsupported parameters
 */
function createLiteLLMStream(parameterSupport: Map<string, ParameterSupport>) {
  return function streamLiteLLM(
    model: Model<any>,
    context: Context,
    options?: SimpleStreamOptions
  ) {
    const stream = createAssistantMessageEventStream();

    (async () => {
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

      try {
        stream.push({ type: "start", partial: output });

        // Import streaming implementation from pi-ai
        const piAi = await import("@mariozechner/pi-ai");

        // Get parameter support for this model
        const support = parameterSupport.get(model.id) || { store: true, prompt_cache_key: true };

        // Create a wrapped options object with filtered sessionId if needed
        const wrappedOptions = { ...options };
        if (!support.prompt_cache_key && wrappedOptions.sessionId) {
          delete wrappedOptions.sessionId;
        }

        // Use the built-in azure streaming function with filtered options
        const azureStream = (piAi as any).streamAzureOpenAIResponses(model, context, wrappedOptions);

        // Forward all events
        for await (const event of azureStream) {
          stream.push(event);
        }
      } catch (error) {
        output.stopReason = options?.signal?.aborted ? "aborted" : "error";
        output.errorMessage = error instanceof Error ? error.message : String(error);
        stream.push({ type: "error", reason: output.stopReason, error: output });
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
      // Use compat to mark parameter support
      compat: {
        supportsStore: support.store,
      },
    };
  });

  // Register the provider with custom streaming function
  pi.registerProvider("litellm", {
    baseUrl: normalizedBaseUrl,
    apiKey,
    api: "azure-openai-responses",
    authHeader: true,
    models,
    streamSimple: createLiteLLMStream(parameterSupport),
  });
}
