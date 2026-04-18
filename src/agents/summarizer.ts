import { SwarmAgent } from "../swarm/SwarmAgent.js";
import type { SwarmContext, SwarmTask } from "../swarm/types.js";

export type SummarizePayload = { text: string; maxWords?: number };

export class SummarizerAgent extends SwarmAgent {
  name = "Summarizer";
  capabilities = ["summarize"];

  async onTask(task: SwarmTask, _context?: SwarmContext): Promise<string> {
    const p = task.payload as SummarizePayload;
    const text = (p?.text ?? "").trim();
    const max = p?.maxWords ?? 12;
    const words = text.split(/\s+/).filter(Boolean);
    const shortened = words.slice(0, max).join(" ");
    return shortened.length < text.length ? `${shortened}…` : shortened || "(empty)";
  }
}
