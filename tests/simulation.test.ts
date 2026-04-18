import { describe, expect, it } from "vitest";
import { TranslatorAgent } from "../src/agents/translator.js";
import { SimulationSwarm } from "../src/swarm/simulation/SimulationSwarm.js";

describe("SimulationSwarm", () => {
  it("broadcast resolves after step", async () => {
    const swarm = new SimulationSwarm({ deterministic: true });
    swarm.register(new TranslatorAgent());

    const p = swarm.broadcast<string>({
      type: "translate",
      payload: { text: "x", targetLang: "fr" },
    });
    expect(swarm.queuedLength).toBe(1);
    await swarm.step();
    const r = await p;
    expect(r).toContain("fr");
    await swarm.destroy();
  });

  it("runUntilIdle drains queue", async () => {
    const swarm = new SimulationSwarm({ deterministic: true });
    swarm.register(new TranslatorAgent());

    const p1 = swarm.broadcast({ type: "translate", payload: { text: "a", targetLang: "es" } });
    const p2 = swarm.broadcast({ type: "translate", payload: { text: "b", targetLang: "de" } });
    const results = await swarm.runUntilIdle();
    expect(results).toHaveLength(2);
    await Promise.all([p1, p2]);
    await swarm.destroy();
  });

  it("destroy rejects queued broadcast promises", async () => {
    const swarm = new SimulationSwarm({ deterministic: true });
    swarm.register(new TranslatorAgent());
    const pending = swarm.broadcast({ type: "translate", payload: { text: "x", targetLang: "de" } });
    await swarm.destroy();
    await expect(pending).rejects.toThrow(/destroyed/i);
    expect(swarm.isDestroyed()).toBe(true);
  });
});
