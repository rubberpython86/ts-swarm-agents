import { SummarizerAgent } from "./agents/summarizer.js";
import { TranslatorAgent } from "./agents/translator.js";
import { WebSearcherAgent } from "./agents/webSearcher.js";
import { Swarm } from "./swarm/Swarm.js";

async function main(): Promise<void> {
  const swarm = new Swarm();
  swarm.register(new TranslatorAgent());
  swarm.register(new SummarizerAgent());
  swarm.register(new WebSearcherAgent());

  const names = swarm.getAgents().map((a) => a.name);
  console.log(`Swarm ready. Agents: ${names.join(", ")}`);

  const translated = await swarm.broadcast<string>({
    type: "translate",
    payload: { text: "Hello world", targetLang: "es" },
  });
  console.log("translate:", translated);

  await swarm.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
