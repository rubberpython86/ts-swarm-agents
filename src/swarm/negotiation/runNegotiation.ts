import type { SwarmAgent } from "../SwarmAgent.js";
import type { BroadcastOptions, NegotiationMode, SwarmContext, SwarmTask } from "../types.js";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

async function filterCapable(agents: SwarmAgent[], task: SwarmTask): Promise<SwarmAgent[]> {
  const out: SwarmAgent[] = [];
  for (const a of agents) {
    const ok = await a.canHandle(task);
    if (ok) out.push(a);
  }
  return out;
}

function sortDeterministic(agents: SwarmAgent[]): SwarmAgent[] {
  return [...agents].sort((a, b) => a.name.localeCompare(b.name));
}

export async function runNegotiation(
  agents: SwarmAgent[],
  task: SwarmTask,
  context: SwarmContext,
  options: BroadcastOptions | undefined,
  deterministicOrder: boolean
): Promise<unknown> {
  const mode: NegotiationMode = options?.mode ?? "first";
  const timeoutMs = options?.timeoutMs ?? 60_000;

  let ordered = await filterCapable(agents, task);
  if (deterministicOrder) ordered = sortDeterministic(ordered);

  if (ordered.length === 0) {
    throw new Error(`No agent could handle task type "${task.type}"`);
  }

  switch (mode) {
    case "first": {
      const agent = ordered[0]!;
      return withTimeout(
        Promise.resolve(agent.onTask(task, context)),
        timeoutMs,
        `onTask(${agent.name})`
      );
    }
    case "highest-bid": {
      const scored: { agent: SwarmAgent; score: number }[] = [];
      for (const agent of ordered) {
        const raw =
          typeof agent.bid === "function"
            ? await withTimeout(Promise.resolve(agent.bid(task)), timeoutMs, `bid(${agent.name})`)
            : 1;
        const score = typeof raw === "number" && !Number.isNaN(raw) ? raw : 1;
        scored.push({ agent, score });
      }
      scored.sort((a, b) => b.score - a.score || a.agent.name.localeCompare(b.agent.name));
      const winner = scored[0]!.agent;
      return withTimeout(
        Promise.resolve(winner.onTask(task, context)),
        timeoutMs,
        `onTask(${winner.name})`
      );
    }
    case "all": {
      const results = await Promise.all(
        ordered.map((agent) =>
          withTimeout(
            Promise.resolve(agent.onTask(task, context)),
            timeoutMs,
            `onTask(${agent.name})`
          )
        )
      );
      return ordered.map((agent, i) => ({ agent: agent.name, result: results[i] }));
    }
    case "consensus": {
      const results = await Promise.all(
        ordered.map((agent) =>
          withTimeout(
            Promise.resolve(agent.onTask(task, context)),
            timeoutMs,
            `onTask(${agent.name})`
          )
        )
      );
      const votes = new Map<string, { value: unknown; count: number }>();
      for (const r of results) {
        const key = voteKey(r);
        const cur = votes.get(key);
        if (cur) cur.count += 1;
        else votes.set(key, { value: r, count: 1 });
      }
      let best: { value: unknown; count: number } | undefined;
      for (const v of votes.values()) {
        if (!best || v.count > best.count) best = v;
        else if (v.count === best.count && voteKey(v.value) < voteKey(best.value)) {
          best = v;
        }
      }
      return best?.value;
    }
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

function voteKey(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
