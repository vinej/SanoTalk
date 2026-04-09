import { createAnthropic } from "@ai-sdk/anthropic";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { provider } from "./model.js";

/**
 * Returns web search tools appropriate for the active AI provider.
 * - Anthropic: built-in webSearch_20250305
 * - Other providers: Tavily Search API (requires TAVILY_API_KEY)
 * - No key: empty object (agents work without web search)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createWebSearchTools(): Record<string, any> {
  if (provider === "anthropic") {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    return { webSearch: anthropic.tools.webSearch_20250305({ maxUses: 5 }) };
  }

  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    console.warn("[AI] TAVILY_API_KEY not set — web search disabled for non-Anthropic provider");
    return {};
  }

  const webSearch = createTool({
    id: "webSearch",
    description: "Search the web for current information. Returns up to 5 results with title, URL, and content snippet.",
    inputSchema: z.object({
      query: z.string().describe("The search query"),
    }),
    execute: async ({ query }) => {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          max_results: 5,
          search_depth: "basic",
        }),
      });
      if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data.results ?? []).map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content,
      }));
    },
  });

  return { webSearch };
}
