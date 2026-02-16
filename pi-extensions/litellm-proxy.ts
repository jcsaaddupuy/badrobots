import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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

interface ModelCacheEntry {
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
}

// Default models to use before fetching or if fetch fails
const DEFAULT_MODELS: ModelCacheEntry[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 1.25 },
    contextWindow: 128000,
    maxTokens: 16384,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0.075 },
    contextWindow: 128000,
    maxTokens: 16384,
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 10, output: 30, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 4096,
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    contextWindow: 200000,
    maxTokens: 8192,
  },
];

function getCacheFilePath(): string {
  const piDir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
  return path.join(piDir, "litellm-models-cache.json");
}

function loadCachedModels(): ModelCacheEntry[] | null {
  try {
    const cachePath = getCacheFilePath();
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load cached models:", error);
  }
  return null;
}

function saveCachedModels(models: ModelCacheEntry[]): void {
  try {
    const cachePath = getCacheFilePath();
    fs.writeFileSync(cachePath, JSON.stringify(models, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save cached models:", error);
  }
}

function mapToProviderModel(model: LiteLLMModel): ModelCacheEntry {
  // Try to infer model properties from the ID
  const id = model.id.toLowerCase();
  
  // Detect reasoning models
  const reasoning = id.includes("o1") || id.includes("o3");
  
  // Detect multimodal models
  const supportsImages = 
    id.includes("gpt-4") || 
    id.includes("claude-3") || 
    id.includes("gemini") ||
    id.includes("vision");
  
  // Estimate context window (rough heuristics)
  let contextWindow = 128000; // default
  if (id.includes("gpt-4o")) contextWindow = 128000;
  else if (id.includes("gpt-4-turbo")) contextWindow = 128000;
  else if (id.includes("gpt-4-32k")) contextWindow = 32768;
  else if (id.includes("gpt-4")) contextWindow = 8192;
  else if (id.includes("gpt-3.5-turbo-16k")) contextWindow = 16384;
  else if (id.includes("gpt-3.5")) contextWindow = 4096;
  else if (id.includes("claude-3")) contextWindow = 200000;
  else if (id.includes("claude-2")) contextWindow = 100000;
  else if (id.includes("gemini-1.5-pro")) contextWindow = 2000000;
  else if (id.includes("gemini")) contextWindow = 1000000;
  
  // Estimate max tokens
  let maxTokens = 4096; // default
  if (id.includes("gpt-4o")) maxTokens = 16384;
  else if (id.includes("o1") || id.includes("o3")) maxTokens = 100000;
  else if (id.includes("claude")) maxTokens = 8192;
  else if (id.includes("gemini")) maxTokens = 8192;
  
  return {
    id: model.id,
    name: model.id, // Use ID as name, could be improved
    reasoning,
    input: supportsImages ? ["text", "image"] : ["text"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow,
    maxTokens,
  };
}

async function fetchModelsFromLiteLLM(baseUrl: string, apiKey: string): Promise<ModelCacheEntry[]> {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const data: LiteLLMModelsResponse = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid response format from LiteLLM proxy");
    }

    return data.data.map(mapToProviderModel);
  } catch (error) {
    console.error("Error fetching models from LiteLLM:", error);
    throw error;
  }
}

export default function (pi: ExtensionAPI) {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    console.warn("OPENAI_BASE_URL or OPENAI_API_KEY not set. LiteLLM proxy extension will not work.");
    return;
  }

  // Load initial models (cached or defaults)
  const cachedModels = loadCachedModels();
  const initialModels = cachedModels || DEFAULT_MODELS;

  // Register provider with initial models
  pi.registerProvider("litellm", {
    baseUrl,
    apiKey,
    api: "openai-completions",
    models: initialModels,
  });

  console.log(`Loaded ${initialModels.length} models from ${cachedModels ? "cache" : "defaults"}`);

  // Fetch fresh models in the background
  pi.on("session_start", async () => {
    try {
      const freshModels = await fetchModelsFromLiteLLM(baseUrl, apiKey);
      
      if (freshModels.length > 0) {
        // Save to cache
        saveCachedModels(freshModels);
        
        // Update provider with fresh models
        pi.registerProvider("litellm", {
          baseUrl,
          apiKey,
          api: "openai-completions",
          models: freshModels,
        });
        
        // Notify user if model list changed
        if (JSON.stringify(freshModels) !== JSON.stringify(initialModels)) {
          pi.notify({
            message: `Updated LiteLLM models: ${freshModels.length} models available`,
            severity: "info",
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch fresh models from LiteLLM:", error);
      // Continue using cached/default models
    }
  });
}
