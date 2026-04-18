import { SwarmAgent } from "../swarm/SwarmAgent.js";
import type { SwarmContext, SwarmTask } from "../swarm/types.js";

export type TranslatePayload = { text: string; targetLang: string };

export class TranslatorAgent extends SwarmAgent {
  name = "Translator";
  capabilities = ["translate"];

  async onTask(task: SwarmTask, _context?: SwarmContext): Promise<string> {
    const p = task.payload as TranslatePayload;
    const text = p?.text ?? "";
    const lang = p?.targetLang ?? "en";
    return `[Translated to ${lang}]: ${text}`;
  }
}
