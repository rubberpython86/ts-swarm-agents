import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { SummarizerAgent } from "../src/agents/summarizer.js";
import { TranslatorAgent } from "../src/agents/translator.js";
import { WebSearcherAgent } from "../src/agents/webSearcher.js";
import { Swarm } from "../src/swarm/Swarm.js";

function parseTranslate(line: string): { text: string; targetLang: string } | null {
  const m = line.match(/^translate\s+["'](.+?)["']\s+to\s+(\w+)/i);
  if (m) return { text: m[1]!, targetLang: m[2]!.toLowerCase() };
  const m2 = line.match(/^translate\s+(.+?)\s+to\s+(\w+)/i);
  if (m2) return { text: m2[1]!.trim(), targetLang: m2[2]!.toLowerCase() };
  return null;
}

function parseSummarize(line: string): { text: string } | null {
  const m = line.match(/^summarize\s+(.+)$/i);
  if (m) return { text: m[1]!.trim() };
  return null;
}

function parseSearch(line: string): { query: string } | null {
  const m = line.match(/^search\s+(.+)$/i);
  if (m) return { query: m[1]!.trim() };
  return null;
}

async function main(): Promise<void> {
  const swarm = new Swarm();
  swarm.register(new TranslatorAgent());
  swarm.register(new SummarizerAgent());
  swarm.register(new WebSearcherAgent());

  const names = swarm.getAgents().map((a) => a.name);
  console.log(`Swarm ready. Agents: ${names.join(", ")}`);
  console.log('Examples: translate "Good morning" to French | summarize long text here | search rust async');
  console.log("Type exit to quit.\n");

  const rl = readline.createInterface({ input, output });

  try {
    for (;;) {
      const line = (await rl.question("Send a task: ")).trim();
      if (!line) continue;
      if (/^exit$/i.test(line)) break;

      const tr = parseTranslate(line);
      if (tr) {
        console.log("[Translator] handling task: translate");
        const result = await swarm.broadcast<string>({
          type: "translate",
          payload: tr,
        });
        console.log(`Result: ${JSON.stringify(result)}`);
        continue;
      }

      const sm = parseSummarize(line);
      if (sm) {
        console.log("[Summarizer] handling task: summarize");
        const result = await swarm.broadcast<string>({
          type: "summarize",
          payload: sm,
        });
        console.log(`Result: ${JSON.stringify(result)}`);
        continue;
      }

      const se = parseSearch(line);
      if (se) {
        console.log("[WebSearcher] handling task: search");
        const result = await swarm.broadcast<string>({
          type: "search",
          payload: se,
        });
        console.log(`Result: ${JSON.stringify(result)}`);
        continue;
      }

      console.log("Could not parse task. Try: translate \"...\" to es | summarize ... | search ...");
    }
  } finally {
    rl.close();
    await swarm.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
