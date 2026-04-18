import type { SwarmMemory } from "../types.js";

export class InMemorySwarmMemory implements SwarmMemory {
  private readonly store = new Map<string, unknown>();

  async get(key: string): Promise<unknown | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
