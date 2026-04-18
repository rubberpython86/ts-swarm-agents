import { EventEmitter } from "node:events";
import { InMemorySwarmMemory } from "./memory/InMemorySwarmMemory.js";
import { RedisSwarmMemory } from "./memory/RedisSwarmMemory.js";
import { runNegotiation } from "./negotiation/runNegotiation.js";
import type { SwarmAgent } from "./SwarmAgent.js";
import type { BroadcastOptions, SwarmMemory, SwarmOptions, SwarmTask } from "./types.js";

export class Swarm extends EventEmitter {
  readonly memory: SwarmMemory;
  private readonly agents: SwarmAgent[] = [];
  private redisMemory: RedisSwarmMemory | null = null;
  private destroyed = false;

  constructor(options?: SwarmOptions) {
    super();
    const transport = options?.transport ?? "memory";
    if (transport === "redis") {
      const url = options?.redisUrl ?? process.env.REDIS_URL;
      if (!url) {
        throw new Error('Swarm transport "redis" requires redisUrl or REDIS_URL');
      }
      this.redisMemory = new RedisSwarmMemory(url);
      this.memory = this.redisMemory;
    } else {
      this.memory = new InMemorySwarmMemory();
    }
  }

  register(agent: SwarmAgent): void {
    if (this.destroyed) throw new Error("Swarm is destroyed");
    agent.swarm = this;
    this.agents.push(agent);
    agent.onRegister?.(this);
    this.emit("agent:joined", agent);
  }

  getAgents(): SwarmAgent[] {
    return [...this.agents];
  }

  /** Whether {@link destroy} has completed. */
  isDestroyed(): boolean {
    return this.destroyed;
  }

  async broadcast<T = unknown>(task: SwarmTask, options?: BroadcastOptions): Promise<T> {
    if (this.destroyed) throw new Error("Swarm is destroyed");
    const context = { swarm: this, task };
    const result = (await runNegotiation(this.agents, task, context, options, false)) as T;
    this.emit("task:completed", task, result);
    return result;
  }

  async sendTo(agentName: string, task: SwarmTask): Promise<unknown> {
    if (this.destroyed) throw new Error("Swarm is destroyed");
    const agent = this.agents.find((a) => a.name === agentName);
    if (!agent) {
      throw new Error(`No agent named "${agentName}"`);
    }
    const ok = await agent.canHandle(task);
    if (!ok) {
      throw new Error(`Agent "${agentName}" cannot handle task type "${task.type}"`);
    }
    const context = { swarm: this, task };
    const result = await agent.onTask(task, context);
    this.emit("task:completed", task, result);
    return result;
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const a of this.agents) {
      a.onDestroy?.();
      a.swarm = undefined;
    }
    this.agents.length = 0;
    if (this.redisMemory) {
      await this.redisMemory.disconnect();
      this.redisMemory = null;
    }
    this.removeAllListeners();
  }
}
