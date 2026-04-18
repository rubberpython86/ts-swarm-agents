import { SummarizerAgent } from "./agents/summarizer.js";
import { TranslatorAgent } from "./agents/translator.js";
import { WebSearcherAgent } from "./agents/webSearcher.js";
import { Swarm } from "./swarm/Swarm.js";

function pickAgent(name: string | undefined) {
  switch (name?.toLowerCase()) {
    case "translator":
      return new TranslatorAgent();
    case "summarizer":
      return new SummarizerAgent();
    case "websearcher":
    case "searcher":
      return new WebSearcherAgent();
    default:
      return null;
  }
}

async function main(): Promise<void> {
  const agentName = process.env.AGENT_NAME;
  const agent = pickAgent(agentName);
  if (!agent) {
    console.error(
      'Set AGENT_NAME to one of: translator | summarizer | websearcher (optional REDIS_URL for shared memory)'
    );
    process.exitCode = 1;
    return;
  }

  const useRedis = Boolean(process.env.REDIS_URL);
  const swarm = useRedis
    ? new Swarm({ transport: "redis", redisUrl: process.env.REDIS_URL })
    : new Swarm();

  swarm.register(agent);
  console.log(`Worker ready: ${agent.name}${useRedis ? " (redis memory)" : ""}`);

  process.on("SIGINT", async () => {
    await swarm.destroy();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await swarm.destroy();
    process.exit(0);
  });

  await new Promise<void>(() => {
    /* keep process alive for docker / sidecar deployments */
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
