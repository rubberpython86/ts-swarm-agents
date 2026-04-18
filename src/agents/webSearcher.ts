import { SwarmAgent } from "../swarm/SwarmAgent.js";
import type { SwarmContext, SwarmTask } from "../swarm/types.js";

export type SearchPayload = { query: string };

/** Mock web search — swap `onTask` for a real HTTP + LLM pipeline in production. */
export class WebSearcherAgent extends SwarmAgent {
  name = "WebSearcher";
  capabilities = ["search"];

  async onTask(task: SwarmTask, _context?: SwarmContext): Promise<string> {
    const p = task.payload as SearchPayload;
    const q = (p?.query ?? "").trim() || "(empty query)";
    return `Top result for "${q}": example.com/article (simulated)`;
  }
}
