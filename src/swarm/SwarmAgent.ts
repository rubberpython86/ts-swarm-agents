import type { Swarm } from "./Swarm.js";
import type { SwarmContext, SwarmTask } from "./types.js";

export abstract class SwarmAgent {
  /** Populated when the agent is registered with a {@link Swarm}. */
  swarm?: Swarm;

  abstract name: string;
  capabilities: string[] = [];

  /** Handle a task whose type matches this agent's capabilities. */
  abstract onTask(task: SwarmTask, context?: SwarmContext): Promise<unknown>;

  /** Whether this agent participates for the given task (default: capability match). */
  canHandle(task: SwarmTask): boolean | Promise<boolean> {
    return this.capabilities.includes(task.type);
  }

  /** Optional bid for `highest-bid` mode (higher wins). Default: 1. */
  bid?(_task: SwarmTask): number | Promise<number>;

  onRegister?(_swarm: Swarm): void;

  onDestroy?(): void;
}
