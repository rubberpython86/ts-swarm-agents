import { describe, expect, it } from "vitest";
import { TranslatorAgent } from "../src/agents/translator.js";
import { Swarm } from "../src/swarm/Swarm.js";

const redisUrl = process.env.REDIS_URL;

describe.skipIf(!redisUrl)("Redis integration", () => {
  it("uses Redis-backed memory", async () => {
    const swarm = new Swarm({ transport: "redis", redisUrl: redisUrl! });
    swarm.register(new TranslatorAgent());
    await swarm.memory.set("integration", { ok: true });
    const v = await swarm.memory.get("integration");
    expect(v).toEqual({ ok: true });
    await swarm.broadcast({ type: "translate", payload: { text: "hi", targetLang: "it" } });
    await swarm.destroy();
  });
});
