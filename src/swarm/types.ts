import type { Swarm } from "./Swarm.js";

/** Task envelope broadcast across the swarm. */
export interface SwarmTask {
  type: string;
  payload?: unknown;
}

export type NegotiationMode = "first" | "highest-bid" | "all" | "consensus";

export interface BroadcastOptions {
  /** How capable agents compete or cooperate. Default: `first`. */
  mode?: NegotiationMode;
  /** Max time to wait for async handlers (ms). */
  timeoutMs?: number;
}

export interface SwarmContext {
  swarm: Swarm;
  task: SwarmTask;
}

/** Optional shared key-value memory (in-memory or Redis-backed). */
export interface SwarmMemory {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface SwarmOptions {
  transport?: "memory" | "redis";
  redisUrl?: string;
}
