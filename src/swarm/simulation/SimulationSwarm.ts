import { Swarm } from "../Swarm.js";
import { runNegotiation } from "../negotiation/runNegotiation.js";
import type { BroadcastOptions, SwarmOptions, SwarmTask } from "../types.js";

export interface SimulationSwarmOptions extends SwarmOptions {
  /** When true, capable agents are ordered by name for stable outcomes. */
  deterministic?: boolean;
}

type Queued = {
  task: SwarmTask;
  options?: BroadcastOptions;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

/**
 * Deterministic swarm for tests: enqueue tasks with `broadcast`, then `step()` or `runUntilIdle()`.
 */
export class SimulationSwarm extends Swarm {
  private readonly deterministic: boolean;
  private readonly queue: Queued[] = [];

  constructor(options?: SimulationSwarmOptions) {
    super(options);
    this.deterministic = options?.deterministic ?? true;
  }

  /**
   * Enqueue a task. The returned promise resolves when `step()` or `runUntilIdle()` processes it.
   */
  override async broadcast<T = unknown>(task: SwarmTask, options?: BroadcastOptions): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        options,
        resolve: (v) => resolve(v as T),
        reject,
      });
    });
  }

  /** Process the next queued task. Returns `undefined` if the queue is empty. */
  async step(): Promise<unknown | undefined> {
    const item = this.queue.shift();
    if (!item) return undefined;
    try {
      const context = { swarm: this, task: item.task };
      const result = await runNegotiation(
        this.getAgents(),
        item.task,
        context,
        item.options,
        this.deterministic
      );
      this.emit("task:completed", item.task, result);
      item.resolve(result);
      return result;
    } catch (e) {
      item.reject(e);
      throw e;
    }
  }

  /** Drain the queue one `step` at a time. */
  async runUntilIdle(): Promise<unknown[]> {
    const out: unknown[] = [];
    while (this.queue.length > 0) {
      const r = await this.step();
      out.push(r);
    }
    return out;
  }

  /** Number of tasks waiting for `step()`. */
  get queuedLength(): number {
    return this.queue.length;
  }

  override async destroy(): Promise<void> {
    const err = new Error("Swarm destroyed");
    const pending = this.queue.splice(0);
    for (const item of pending) {
      item.reject(err);
    }
    await super.destroy();
  }
}
