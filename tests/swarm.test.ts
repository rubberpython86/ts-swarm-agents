import { describe, expect, it } from "vitest";
import { SummarizerAgent } from "../src/agents/summarizer.js";
import { TranslatorAgent } from "../src/agents/translator.js";
import { WebSearcherAgent } from "../src/agents/webSearcher.js";
import { Swarm } from "../src/swarm/Swarm.js";
import { SwarmAgent } from "../src/swarm/SwarmAgent.js";
import type { SwarmContext, SwarmTask } from "../src/swarm/types.js";

class BidAgent extends SwarmAgent {
  name: string;
  capabilities = ["process"];
  private readonly score: number;

  constructor(name: string, score: number) {
    super();
    this.name = name;
    this.score = score;
  }

  bid(): number {
    return this.score;
  }

  async onTask(task: SwarmTask): Promise<string> {
    return `${this.name}:${JSON.stringify(task.payload)}`;
  }
}

describe("Swarm", () => {
  it("broadcasts translate to Translator", async () => {
    const swarm = new Swarm();
    swarm.register(new TranslatorAgent());
    const r = await swarm.broadcast<string>({
      type: "translate",
      payload: { text: "hi", targetLang: "de" },
    });
    expect(r).toContain("de");
    expect(r).toContain("hi");
    await swarm.destroy();
  });

  it("sendTo targets a specific agent", async () => {
    const swarm = new Swarm();
    swarm.register(new TranslatorAgent());
    swarm.register(new SummarizerAgent());
    const r = await swarm.sendTo("Summarizer", {
      type: "summarize",
      payload: { text: "one two three four five" },
    });
    expect(String(r)).toMatch(/one two three/);
    await swarm.destroy();
  });

  it("highest-bid selects winner", async () => {
    const swarm = new Swarm();
    swarm.register(new BidAgent("low", 1));
    swarm.register(new BidAgent("high", 99));
    const r = await swarm.broadcast<string>(
      { type: "process", payload: { x: 1 } },
      { mode: "highest-bid" }
    );
    expect(r.startsWith("high:")).toBe(true);
    await swarm.destroy();
  });

  it("all mode returns all results", async () => {
    const swarm = new Swarm();
    swarm.register(new BidAgent("a", 1));
    swarm.register(new BidAgent("b", 2));
    const r = await swarm.broadcast<{ agent: string; result: unknown }[]>(
      { type: "process", payload: {} },
      { mode: "all" }
    );
    expect(r).toHaveLength(2);
    const names = r.map((x) => x.agent).sort();
    expect(names).toEqual(["a", "b"]);
    await swarm.destroy();
  });

  it("consensus picks majority vote", async () => {
    const swarm = new Swarm();
    class VoteAgent extends SwarmAgent {
      name: string;
      capabilities = ["vote"];
      constructor(name: string, private readonly v: string) {
        super();
        this.name = name;
      }
      async onTask(): Promise<string> {
        return this.v;
      }
    }
    swarm.register(new VoteAgent("a", "yes"));
    swarm.register(new VoteAgent("b", "yes"));
    swarm.register(new VoteAgent("c", "no"));
    const r = await swarm.broadcast<string>({ type: "vote", payload: {} }, { mode: "consensus" });
    expect(r).toBe("yes");
    await swarm.destroy();
  });

  it("emits agent:joined and task:completed", async () => {
    const swarm = new Swarm();
    const joined: string[] = [];
    const done: unknown[] = [];
    swarm.on("agent:joined", (a) => joined.push(a.name));
    swarm.on("task:completed", (_t, result) => done.push(result));
    swarm.register(new WebSearcherAgent());
    await swarm.broadcast({ type: "search", payload: { query: "q" } });
    expect(joined).toEqual(["WebSearcher"]);
    expect(done).toHaveLength(1);
    await swarm.destroy();
  });

  it("shared memory on agent", async () => {
    class MemAgent extends SwarmAgent {
      name = "Mem";
      capabilities = ["kv"];
      async onTask(_task: SwarmTask, ctx?: SwarmContext): Promise<number> {
        const s = ctx?.swarm;
        if (!s) throw new Error("no swarm");
        await s.memory.set("k", 7);
        return Number(await s.memory.get("k"));
      }
    }
    const swarm = new Swarm();
    swarm.register(new MemAgent());
    const n = await swarm.broadcast<number>({ type: "kv", payload: {} });
    expect(n).toBe(7);
    await swarm.destroy();
  });
});
