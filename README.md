# Lyrebird

Lyrebird is a hackathon project for **AWS x Datadog GenAI** that turns chat logs into a verified “truth set,” exposes human-in-the-loop controls, builds a knowledge graph, and generates a music artifact from the final facts.

The core flow is:

**Egg → Yolk → Albumen → Song**

It is designed to be production-shaped while shipping a polished, playable demo.

## Hackathon context

This project is built for the AWS and Datadog event that emphasizes production-ready GenAI agents with observability.

The challenge asks teams to satisfy:

AWS infrastructure requirement, with any of:

- Amazon Bedrock
- Strands Agents
- Amazon Bedrock AgentCore
- Kiro

Datadog observability requirement with at least one:

- Datadog Dashboards
- LLM Observability
- Datadog MCP

Lyrebird aligns to the partner tracks in scope:

- MiniMax
- Neo4j
- TestSprite
- CopilotKit

## What judges should expect

Lyrebird’s user journey:

1. Generate a synthetic hackathon conversation in Egg mode.
2. Extract candidate facts in Yolk with rationale and provenance.
3. Review and sanitize facts in Albumen with pass rules.
4. Build and visualize a knowledge graph of run artifacts.
5. Generate a playable track from factual lyrics in Song.
6. Inspect debug/trace info for each stage.

The app always explains before showing fact content, so decision context is visible first.

## Why this project fits the PRD

The implementation follows the PRD v0.1 structure:

- `Egg`: source selection, prompt intent, seed control, and transcript mode.
- `Yolk`: candidate factual decomposition with confidence and provenance.
- `Albumen`: iterative find/replace + rewrite passes with pass history.
- `Graph`: interactive representation of message/fact/transform/song relationships.
- `Song`: MiniMax-aware music generation path with fallback for offline/Mock mode.
- Observability-first run design with stage telemetry and run snapshots.

## Production target architecture

The PRD targets an AWS-native orchestration:

- Frontend: CopilotKit-first Generative UI for streamed stage UX and tool-style action rendering.
- Orchestration: AWS Step Functions as the explicit state machine.
- Agent runtime: Python Strands Agents deployed on Amazon Bedrock AgentCore Runtime.
- Graph store: Neo4j Aura graph persisted from run outputs.
- Storage: DynamoDB run state and versioning, S3 artifacts.
- Music: MiniMax `POST /v1/music_generation` with `music-2.5`.
- Observability: Datadog LLM Observability + Datadog Dashboards + MCP debug bridge (stretch).
- QA: TestSprite for E2E and API test flows.

## Current codebase state

This repository contains a runnable front-end and local mock backend that simulates the above pipeline for judges to run immediately.

- Frontend: React 19 + Vite
- Backend API: mock Express server for demo-stage endpoints
- Data model: strong typed TypeScript run state, facts, passes, graph, telemetry, and song artifacts
- Music path: mock playback by default, real MiniMax call when API key is provided and enabled

## Local setup

1. Install dependencies

```bash
npm install
```

2. Copy environment template

```bash
cp .env.example .env
```

3. Optional: configure MiniMax env vars in `.env`

`MINIMAX_API_KEY`  
`MINIMAX_API_HOST`  
`MINIMAX_MOCK_ONLY` (set `true` for synthetic-only mode)

4. Start mock backend + frontend

```bash
npm run dev
```

5. Open `http://localhost:5173`

The dev script starts:

- `node src/server/mock-server.js` on `:3001`
- Vite dev server on `:5173`

The UI calls the mock API under:

- `/api/simulated-discord/log`
- `/api/run/egg`
- `/api/run/{runId}/yolk`
- `/api/run/{runId}/albumen`
- `/api/run/{runId}/graph`
- `/api/run/{runId}/music`
- `/api/run/{runId}/debug`
- `/api/run/{runId}/export`

## Repo scripts

`npm run dev`

- Start mock backend and client together.

`npm run dev:server`

- Run only mock backend.

`npm run dev:client`

- Run only Vite frontend.

`npm run build`

- Build production frontend.

`npm run preview`

- Preview production build.

## Data model at a glance

Run bundle shape includes:

- `runState` with stage, version, trace ID, errors, timestamps
- `messages` from Egg input
- `facts` from Yolk and Albumen
- `passes` with mutation history and touched counts
- `graph` nodes and edges
- `songArtifact` with lyrics and audio URI metadata
- `telemetry` stream entries per stage

## Judging-oriented quality hooks

- Stage-driven state machine and reproducible demo flow.
- Human review loop with explicit approvals and rewrites.
- Graph provenance and transform lineage.
- Stage logs and failure snapshots in debug console.
- Exportable run bundle for repeatable review.
- Clear migration path to production services from mock implementation.

## Hackathon submission notes

Core requirements addressed in this build:

- End-to-end demo that runs live in browser.
- AWS + Datadog alignment described and planned by architecture.
- Observability instrumentation points for each run stage.
- Partner tracks touched in design: MiniMax, Neo4j, CopilotKit, TestSprite.
- Optional debug controls and failure-path handling.

## Team and repository

- Team: Lyrebird
- Project goal: demonstrate a practical, explainable, and instrumented GenAI agent workflow from log to song.

## Additional context

For complete PRD details, constraints, and acceptance criteria, see `prd.md`.
