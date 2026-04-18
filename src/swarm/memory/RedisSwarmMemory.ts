import { createClient, type RedisClientType } from "redis";
import type { SwarmMemory } from "../types.js";

const PREFIX = "swarm:mem:";

export class RedisSwarmMemory implements SwarmMemory {
  private client: RedisClientType;
  private connectPromise: Promise<void> | null = null;

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connectPromise) {
      this.connectPromise = this.client.connect().then(() => undefined);
    }
    await this.connectPromise;
  }

  async get(key: string): Promise<unknown | undefined> {
    await this.ensureConnected();
    const raw = await this.client.get(PREFIX + key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.ensureConnected();
    const payload = JSON.stringify(value);
    await this.client.set(PREFIX + key, payload);
  }

  async delete(key: string): Promise<void> {
    await this.ensureConnected();
    await this.client.del(PREFIX + key);
  }

  async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}
