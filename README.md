# ts-swarm-agents

**Lightweight swarm coordination for TypeScript AI agents** — register agents, broadcast tasks, and choose how they compete or cooperate (first responder, bidding, all, or consensus). Runs locally with **no required services**; optional **Redis** backs shared memory.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

---

## What is this?

`ts-swarm-agents` is a small library for coordinating multiple **SwarmAgent** instances on a **Swarm**: tasks are routed by `type`, handlers run `onTask`, and you can tune behavior with **negotiation modes** instead of a heavy orchestration framework.

**Good fits:**

- Prototyping multi-agent flows (translate → summarize → search).
- Teaching agent routing, bidding, and consensus without cloud dependencies.
- Pairing with your own LLM or API calls inside `onTask`.

---

## Features

| Feature | Description |
|--------|-------------|
| **No central orchestrator** | You register agents; `broadcast` / `sendTo` invoke handlers. |
| **Negotiation modes** | `first`, `highest-bid`, `all`, `consensus`. |
| **Events** | `agent:joined`, `task:completed` on the swarm (`EventEmitter`). |
| **Shared memory** | In-memory by default; optional Redis when `transport: 'redis'`. |
| **Simulation** | `SimulationSwarm` queues tasks until `step()` / `runUntilIdle()` for deterministic tests. |
| **Small surface** | Core logic is plain TypeScript; example agents are easy to replace. |

---

## Installation

```bash
cd ts-swarm-agents
npm install
```

Requires **Node.js 20+**.

### Scripts

| Command | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Compile, then run the compiled dev sample (`dist/dev.js`). |
| `npm run dev` | Watch and run `src/dev.ts` (via `tsx`). |
| `npm run demo` | Interactive CLI (`examples/demo.ts`). |
| `npm run worker` | Long-lived worker; set `AGENT_NAME`, optional `REDIS_URL`. |
| `npm test` | Full Vitest suite. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:simulation` | `SimulationSwarm` tests only. |
| `npm run test:distributed` | Redis integration (set `REDIS_URL` or tests skip). |

### Use as a dependency

Published packages ship with `dist/`. From a **git clone**, generate it with **`npm run build`** (or **`npm start`**, which runs the full compiler before the sample). Then use `npm link` / `file:` installs as usual.

```typescript
import { Swarm, SwarmAgent, SimulationSwarm } from "ts-swarm-agents";
```

Source files in this repo use `.js` extensions in import paths for Node ESM (`"type": "module"`).

**Note:** `dist/` is build output (see `.gitignore`); do not commit it.

---

## Quick start

### 1. Define an agent

```typescript
// src/agents/translator.ts
import { SwarmAgent } from "../swarm/SwarmAgent.js";
import type { SwarmContext, SwarmTask } from "../swarm/types.js";

export class TranslatorAgent extends SwarmAgent {
  name = "Translator";
  capabilities = ["translate"];

  async onTask(task: SwarmTask, _ctx?: SwarmContext) {
    const p = task.payload as { text: string; targetLang: string };
    return `[Translated to ${p.targetLang}]: ${p.text}`;
  }
}
```

### 2. Create a swarm and broadcast

```typescript
import { Swarm } from "./swarm/Swarm.js";
import { TranslatorAgent } from "./agents/translator.js";
import { SummarizerAgent } from "./agents/summarizer.js";

const swarm = new Swarm();
swarm.register(new TranslatorAgent());
swarm.register(new SummarizerAgent());

const result = await swarm.broadcast({
  type: "translate",
  payload: { text: "Hello world", targetLang: "es" },
});

console.log(result);
await swarm.destroy();
```

### 3. Run the dev sample

```bash
npm run dev
```

The same sample without `tsx` (compiles then runs):

```bash
npm start
```

### 4. Interactive demo

```bash
npm run demo
```

Example lines:

- `translate "Good morning" to French`
- `summarize paste a long paragraph here`
- `search rust async traits`

Type `exit` to quit.

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Swarm (EventEmitter)        │
│  register · broadcast · sendTo · memory  │
└───────────────────┬─────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   SwarmAgent A             SwarmAgent B
   capabilities[]          capabilities[]
   onTask / bid?           onTask / bid?
```

- **`broadcast(task, { mode })`** — finds agents whose `canHandle(task)` is true, then applies the negotiation mode.
- **`sendTo(name, task)`** — delivers to one agent by name (must pass `canHandle`).
- **`swarm.memory`** — `get` / `set` / `delete`; in-memory or Redis-backed.

---

## API

### `new Swarm(options?)`

- `transport?: 'memory' | 'redis'` — default `memory`. With `redis`, set `redisUrl` or `REDIS_URL`.
- **`register(agent)`** — sets `agent.swarm = this`, calls `onRegister`, emits `agent:joined`.
- **`broadcast(task, options?)`** — `SwarmTask` is `{ type: string; payload?: unknown }`. Options: `mode`, `timeoutMs`.
- **`sendTo(agentName, task)`** — direct dispatch.
- **`getAgents()`** — copy of registered agents.
- **`destroy()`** — `onDestroy` on agents, clears `agent.swarm`, clears listeners, closes Redis if used.
- **`isDestroyed()`** — `true` after `destroy()` completes.

### `SwarmAgent`

- **`name`**, **`capabilities`**
- **`onTask(task: SwarmTask, context?: SwarmContext)`** — required.
- **`canHandle(task)`** — default: `capabilities.includes(task.type)`.
- **`bid?(task)`** — optional; used in `highest-bid` mode.
- **`onRegister?(swarm)`**, **`onDestroy?()`**

### Negotiation modes

| Mode | Behavior |
|------|----------|
| `first` | First capable agent: **registration order** on `Swarm`; **sorted by `name`** when `SimulationSwarm` uses `deterministic: true`. |
| `highest-bid` | Highest `bid()` wins (default bid `1`). |
| `all` | All capable agents run; result is `{ agent, result }[]`. |
| `consensus` | All capable agents run; result with the **majority** vote (by `JSON.stringify` of each result). |

```typescript
await swarm.broadcast(task, { mode: "highest-bid" });
```

### Shared memory (Redis)

```typescript
const swarm = new Swarm({
  transport: "redis",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
});

// Inside an agent
await this.swarm!.memory.set("counter", 1);
const n = await this.swarm!.memory.get("counter");
```

Task routing still runs **in-process** on that `Swarm` instance; Redis is for **shared key-value memory** across processes or restarts.

### Simulation mode

```typescript
import { SimulationSwarm } from "./swarm/simulation/SimulationSwarm.js";

const swarm = new SimulationSwarm({ deterministic: true });
swarm.register(new TranslatorAgent());

const p = swarm.broadcast({ type: "translate", payload: { text: "a", targetLang: "fr" } });
await swarm.step(); // resolves p
await swarm.destroy();
```

`broadcast` **queues** the task; **`step()`** runs one queued task. **`runUntilIdle()`** drains the queue. If you **`destroy()`** while tasks are still queued, those pending promises are **rejected** (with `Swarm destroyed`).

### Events

```typescript
swarm.on("task:completed", (task, result) => {
  /* ... */
});
swarm.on("agent:joined", (agent) => {
  /* ... */
});
```

---

## Worker process

For a single long-lived agent (e.g. beside Redis in Docker):

```bash
AGENT_NAME=translator npm run worker
# optional: REDIS_URL=redis://localhost:6379
```

Build + Node (no `tsx`):

```bash
npm run build
AGENT_NAME=summarizer node dist/worker.js
```

---

## Docker

```bash
docker compose up -d --build
```

Services: Redis + two workers (`translator`, `summarizer`) using Redis-backed memory. Adjust `docker-compose.yml` for your layout.

---

## Testing

See **Scripts** for `npm test`, `npm run test:simulation`, and `npm run test:distributed`.

Redis integration (skipped if `REDIS_URL` is unset):

```bash
REDIS_URL=redis://127.0.0.1:6379 npm run test:distributed
```

---

## Project layout

```
ts-swarm-agents/
├── README.md
├── LICENSE
├── .gitignore
├── src/
│   ├── swarm/
│   │   ├── Swarm.ts
│   │   ├── SwarmAgent.ts
│   │   ├── types.ts
│   │   ├── negotiation/runNegotiation.ts
│   │   ├── memory/
│   │   └── simulation/SimulationSwarm.ts
│   ├── agents/
│   ├── index.ts          # library exports
│   ├── dev.ts            # sample used by npm run dev / npm start
│   └── worker.ts         # single-agent worker
├── examples/demo.ts
├── tests/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## Contributing

Issues and PRs welcome. Please add tests for new negotiation behavior or transports.

---

## License

See [LICENSE](./LICENSE) (MIT).
