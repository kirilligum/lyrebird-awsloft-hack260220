Explanation (how this PRD reflects your decisions)

This PRD locks in the Lyrebird concept (“log → factual song”) with your renamed Egg widget and a CopilotKit-first Generative UI approach. The system is designed as a production-grade pipeline: a Python Strands Agents backend deployed on Amazon Bedrock AgentCore Runtime, orchestrated by an explicit AWS Step Functions state machine, with strict internal structured-output enforcement (schemas + validation/repair) even though the UI will not expose JSON.

For the initial hackathon demo input, Lyrebird will generate a fictional hackathon chat (repeatable, safe), while still preserving a path for “real” ingestion later (e.g., Discord API). The “song” stage uses MiniMax Music Generation (`POST /v1/music_generation`, `model: music-2.5`) with optional streaming (`stream=true`) and URL/hex audio responses; Lyrebird treats the result as a “song experience” (generated audio + factual lyrics displayed, with optional spoken overlay as a stretch goal).

PRD: Lyrebird — “log → factual song”

Document Version: v0.1 (Hackathon)
Status: Draft for implementation
Primary Goal: Deliver a live, working demo that is production-shaped: AWS deployment + robust workflow orchestration + observability + testing + human-in-the-loop accuracy.

1. Product Summary

Lyrebird converts a chat log into a verified set of atomic facts, lets users review and sanitize those facts through an interactive Find/Replace pipeline, builds a knowledge graph from the resulting truth set, then generates an instrumental track that pairs with a factual lyric sheet (and/or spoken overlay).

Lyrebird’s differentiator for this hackathon: observability-first agent workflows—every stage is traced, measurable, debuggable, and testable.

2. Hackathon Requirements Alignment

Lyrebird explicitly satisfies the hackathon eligibility constraints:

AWS Infrastructure:

Uses Strands Agents and deploys to Amazon Bedrock AgentCore Runtime. AgentCore is designed to deploy and operate agents securely at scale, and has a documented quickstart workflow via starter toolkit/CLI.

Orchestrates stages via AWS Step Functions (serverless workflow orchestration), which is also explicitly documented as a way to orchestrate multi-step Bedrock prompt chains.

Datadog Observability:

Uses Datadog LLM Observability for end-to-end traces of LLM workflows/agents, and dashboards/insights for latency, cost, errors, and quality signals.

Uses Datadog MCP Server (preview/allowlist constraints acknowledged) to enable an “AI debugger” experience that can query telemetry context.

3. Naming & Concept Model
   Core Concept

Project: Lyrebird

Widget: Egg

Egg Input: conversation source + goal + constraints

Yolk: initial/main LLM extraction pass that produces candidate “facts”

Albumen: iterative Find/Replace pipeline to sanitize/rewrite/filter facts (PII → fiction, topic filtering, etc.)

Key UX Principle (required)

“Show explanation before the main answer.”
In practice: every Yolk/Albumen result is presented with:

Why (provenance, rationale, confidence, and what rule/model decided it)

What (the fact text / replacement / outcome)

4. Target Users & Personas

Builder / PM (Non-technical judge viewpoint)
Wants a fun, compelling transformation (“chat → song”), visible editing controls, and immediate payoff.

Engineer / Platform judge viewpoint
Wants proof of production readiness: orchestration, state, retries, observability, cost/latency metrics, and quality safeguards.

SRE / Observability enthusiast
Wants deep traces, dashboards, correlation IDs, and “why did the agent do that?” visibility.

5. Goals & Non-Goals
   Goals (in scope for hackathon)

End-to-end pipeline: Egg → Yolk → Albumen → Graph → MiniMax audio + lyric artifact.

Human-in-the-loop review of extracted facts and transformations.

Strict internal schemas + validation/repair loops for reliability (even if UI hides JSON).

Neo4j-backed knowledge graph that is queryable and visualized in UI.

Full Datadog implementation: LLM Observability + dashboards + diagnostics hooks.

Full TestSprite testing loop from PRD to automated tests and reports.

Non-Goals (explicitly out of scope for hackathon)

Enterprise-grade data governance platform (formal DLP, policy engines, retention tooling).

Multi-tenant billing, complex org user management.

Guaranteed studio-grade vocal quality or perfect lyric alignment in generated audio (music generation output remains probabilistic).

6. Core User Journeys (MVP)
   Journey A — “Demo mode” (primary hackathon flow)

User clicks Generate fictional hackathon chat (safe, reproducible).

User clicks Run Egg.

Yolk returns fact candidates with “why-first” explanations.

User reviews/edits/approves facts.

Albumen runs Find/Replace (PII → fictional names, topic filters, tone rewrite).

User explores the knowledge graph.

User clicks Generate Song → sees lyrics + hears generated audio.

Journey B — “Bring your own text”

User pastes a conversation transcript into Egg Input.

Same as Journey A.

Journey C — “Debug the agent”

User toggles “Show run diagnostics”.

UI links to Datadog traces/dashboards and highlights the slowest/riskiest steps.

7. Product UX & UI Requirements (CopilotKit-first)
   UI stack mandate

Use CopilotKit Generative UI as the primary interaction pattern: streaming progress, tool-call rendering, and shared state sync between agent and UI.

Use the Strands ↔ CopilotKit integration approach via AG-UI-style patterns (tool rendering + shared state), per Strands community integration docs.

Primary screens/components
7.1 Egg Input Screen

Components

Conversation Source selector:

“Generate fictional hackathon chat” (default)

“Paste transcript”

“(Future) Connect Discord”

Controls:

“Goal” (e.g., “Turn this into a factual song about what happened”)

“Tone” (e.g., “upbeat”, “lofi”, “dramatic”)

“Safety constraints” toggles (e.g., “Scrub names”, “Scrub emails”)

CTA: Run Egg

Acceptance

Must produce a Run ID and immediately begin streaming stage progress.

7.2 Yolk Results Screen (Facts Review)

Components

FactsBoard: list/grid of FactCards

Each FactCard shows:

Explanation first: provenance snippet (from which message), rationale, confidence/quality indicator

Fact text (editable)

Actions: Approve, Edit, Delete, “Request re-extraction”

Summary panel: “What the system believes happened” (derived from approved facts)

Acceptance

User can edit any fact in-place and the system preserves provenance.

UI never shows raw JSON; it renders domain objects as components.

7.3 Albumen Screen (Find/Replace Pipeline)

Albumen is iterative and stackable (“add another pass”).

Find panel

Find modes:

PII categories (names, emails, phone numbers)

Free-text semantic find (“anything about budget”)

Topic filters (“remove internal-only details”)

Results view:

Matched facts displayed with why-first explanation (why matched)

Bulk select + per-item override

Replace panel

Replacement rule builder:

Mapping table UI (e.g., “Alice → ‘DJ Sparrow’”)

“Rewrite with constraints” (tone/fictionalization)

Preview diffs:

before/after per fact

Apply pass → produces a new “Fact Set Version”

Acceptance

Supports ≥ 2 passes in demo (pass stacking).

Preserves an audit trail per pass: what matched, what changed, what stayed.

7.4 Knowledge Graph Screen (CopilotKit-rendered)

Requirement: Graph visualization is a first-class CopilotKit UI component (not Mermaid-only).

Graph Explorer UI

Interactive graph canvas:

Nodes: Conversation, Message, Entity, Fact, TransformPass, SongArtifact

Edges: “derived_from”, “mentions”, “rewrites”, “approved_in”, etc.

Filters:

show only approved facts

show transforms only

time slider (optional)

On click: node details panel with provenance and related facts

Acceptance

Graph data is persisted in Neo4j and visualized from Neo4j query results.

No raw JSON shown.

7.5 Song Studio Screen

Components

Lyrics panel:

“Factual lyric sheet” generated from final facts

Line-level provenance links (optional)

Music controls:

Style prompts (weighted prompts)

BPM/temperature controls (where supported)

Player:

streaming audio playback

save/export artifact

Acceptance

Uses MiniMax Music Generation API (`/v1/music_generation`) and produces playable output (streamed or final response payload).

8. Functional Requirements
   FR1 — Fictional hackathon chat generator (default input)

Must generate a deterministic/repeatable “hackathon conversation” dataset:

team formation, tasks, blockers, decisions, deadlines, mild drama

includes synthetic PII-like tokens (fake names/emails) to demonstrate Albumen

Must support “regenerate” with a seed.

FR2 — Yolk: fact extraction

Input: conversation + goal + constraints

Output: candidate facts with:

category (decision/action/issue/outcome)

provenance (message(s) referenced)

confidence + rationale (“why we believe this is true”)

FR3 — Human review loop

Users must be able to:

approve/edit/delete facts

request re-run (re-extraction) with guidance

FR4 — Albumen Find (LLM judge per item) + hybrid PII checks

Find determines matches via:

deterministic signals (regex/heuristics) for obvious PII

LLM binary judge per item with rationale for semantic matching

FR5 — Albumen Replace + audit trail

Apply replacement rules:

direct mapping replacement

rewrite with constraints (e.g., fictionalize while preserving factual content)

Output is a new fact set version with:

per-fact diffs

pass metadata

FR6 — Neo4j knowledge graph persistence

Persist:

raw conversation nodes (or message references)

final facts

entity nodes

transform passes

song artifact node

Must enable queries like:

“show decisions and who made them”

“show facts changed by Albumen pass #2”

Neo4j Aura is a managed cloud offering suitable for hackathon deployment.

FR7 — Music generation via MiniMax

Use MiniMax `POST /v1/music_generation` (`model: music-2.5`), which supports:

prompt-based style steering with optional lyrics input

configurable duration and audio settings

streaming (`stream=true`) and non-streaming (`stream=false`) response modes

Output artifacts:

audio stream or final audio URL/hex payload (playback)

saved audio file (S3)

lyric sheet (text artifact)

FR8 — Observability-first design (Datadog)

Must create:

a trace per “run”

spans per stage, per LLM call, per tool invocation

dashboards that show:

latency distribution by stage

error rates

token usage + inferred cost per stage

“quality signals” (e.g., percent of facts edited by humans)

Datadog LLM Observability represents each request as a trace and can capture LLM workflows/agent steps as spans.

FR9 — “AI debugger” via Datadog MCP (stretch but aligned with your 6A)

Provide an internal “Debug Agent” mode:

agent can query Datadog contexts/tools through Datadog MCP Server (preview limitations acknowledged).

outputs: “top failing spans”, “slowest step”, “tool invocation errors”

FR10 — Testing & QA via TestSprite (11A)

Use TestSprite to generate and run:

UI E2E business flows

API/integration tests

error-handling and auth-flow tests where applicable

TestSprite MCP Server documentation explicitly lists frontend E2E business-flow testing and backend API/integration testing capabilities.

9. Non-Functional Requirements (NFRs)
   Reliability / correctness

Every stage must be replayable from persisted state (idempotent design).

Validation/repair must prevent malformed structured outputs from entering the pipeline.

Latency targets (hackathon-friendly)

Yolk extraction: < 15s (typical case)

Albumen Find per pass: < 20s for ~25 facts

Graph upsert: < 5s

MiniMax audio readiness: < 20s for short generations (best-effort; depends on duration and stream mode)

Security & data handling

Default demo uses synthetic data to avoid real PII.

If user pastes real logs:

storage is minimized and time-bounded

Albumen is the privacy tool; we do not claim enterprise DLP

10. System Architecture (Production-shaped)
    High-level components

Frontend (Web)

Next.js + CopilotKit Generative UI components

Renders agent state/progress/tool outputs as custom widgets

Communicates with backend via AG-UI/CopilotKit runtime patterns described in Strands AG-UI integration docs.

Agent Backend

Python Strands Agents code deployed on Amazon Bedrock AgentCore Runtime

AgentCore Runtime characteristics: secure serverless runtime, session isolation, session persistence, rapid scaling of sessions.

Deployed via AgentCore starter toolkit workflow (create → dev → launch) for speed.

Workflow Orchestrator

AWS Step Functions runs the explicit stage machine and manages retries/state transitions.

Step Functions is documented as a way to orchestrate Bedrock prompt chaining workflows.

State & Artifact Storage

DynamoDB: run state, approved facts, pass history

S3: raw input (optional), intermediate artifacts, lyric sheets, audio artifacts

Graph Store

Neo4j AuraDB: persisted knowledge graph.

Music Generation

MiniMax Music Generation API (`/v1/music_generation`, `model: music-2.5`).

Observability

Datadog:

LLM Observability traces and workflow spans

optional MCP debugging bridge (preview)

Why Step Functions + Strands (tutorial-backed)

Strands supports structured workflows (e.g., GraphBuilder for controlled multi-agent orchestration) and built-in async + observability integrations.

Step Functions provides a clear, auditable, retryable outer pipeline for multi-step GenAI workflows, and AWS explicitly documents Bedrock + Step Functions orchestration patterns.

Decision: Step Functions orchestrates the macro pipeline; Strands handles micro agent reasoning/tool usage within each state.

11. Workflow State Machine (Step Functions)
    State machine (canonical)

InitRun

Create Run ID, initialize empty run state.

BuildInput

If “demo mode”: generate fictional hackathon chat.

Else: ingest pasted transcript (future: Discord API ingestion).

YolkExtractFacts

Invoke Strands agent hosted on AgentCore to extract candidate facts (strict schema enforced internally).

HumanReviewGate

UI presents FactCards; user approves/edits/deletes.

Resume when user clicks “Continue”.

AlbumenPassLoop (repeatable)

AlbumenFind: per-fact match judge + rationale

HumanReviewMatches: UI lets user override selections

AlbumenReplace: apply mapping rules + rewrite constraints

Exit loop when “No more passes”.

UpsertKnowledgeGraph

Upsert nodes/edges into Neo4j AuraDB.

GenerateLyrics

Turn final facts into a structured lyric sheet + “chorus hook”.

GenerateMusic (MiniMax music_generation)

Call `/v1/music_generation`; stream chunks or wait for final URL/hex output; store artifact to S3; emit progress to UI.

FinalizeRun

Persist final artifact pointers; mark run complete.

Idempotency & redo semantics

Every state writes output as a new “run version” object (immutable snapshot).

Re-run behavior:

user edits facts → re-run from AlbumenFind or UpsertKnowledgeGraph

style changes → re-run only GenerateMusic

12. Internal Data Model (schema enforced, not shown as JSON)
    Core entities

Run

run_id, created_at, status, stage, version

Message

message_id, speaker_id, timestamp, text, metadata

Fact (Yolk output)

fact_id

statement (atomic)

type: decision | action | blocker | outcome | info

provenance: message_ids + quoted spans

rationale (human readable)

confidence (0–1)

entities[] (optional)

status: candidate | approved | rejected

AlbumenPass

pass_id, query, mode (PII|semantic|topic)

matches: [fact_id → {matched:boolean, rationale}]

replacement_rules

diffs: [fact_id → {before, after}]

SongArtifact

lyrics_text

style_prompts (weighted)

audio_uri

generation_metadata (bpm, temperature, model id)

13. Knowledge Graph Model (Neo4j)
    Node types

Conversation, Message, Speaker

FactCandidate, FactApproved

Entity (Person/Org/Project/Date/etc.)

AlbumenPass, ReplacementRule

SongArtifact

Relationship types

(FactCandidate)-[:DERIVED_FROM]->(Message)

(FactApproved)-[:APPROVED_FROM]->(FactCandidate)

(FactApproved)-[:MENTIONS]->(Entity)

(AlbumenPass)-[:REWRITES]->(FactApproved)

(SongArtifact)-[:BASED_ON]->(FactApproved)

14. Observability Specification (Datadog 6A)
    Trace model (LLM Observability)

Root trace: lyrebird.run

Spans by stage:

egg.build_input

yolk.extract_facts

albumen.find (one span per pass + optional child span per fact)

albumen.replace

graph.upsert

lyrics.generate

music.minimax_generation

music.audio_output_receive (aggregated counters)

Datadog LLM Observability supports traces representing predetermined workflows and dynamic agent workflows; traces contain spans for steps and can include input/output, latency, privacy issues, errors, and more.

Required telemetry fields

run_id, pass_id, fact_id

model provider + model name

latency_ms, tokens_in/out (where available), error code

“human edits count” per stage

“facts approved rate”

“PII matches count” per pass

Dashboards (minimum)

Pipeline Health

runs completed, stage durations, error rates

Yolk Quality

human edits per run, approval rate, re-run rate

Albumen Privacy

matched PII-like tokens, replacements applied, override rate

Music Reliability

time to first audio chunk (stream mode) or time to final URL (non-stream), generation error rate

MCP-based debugging (Datadog MCP Server)

Provide a Debug panel that triggers an internal agent to:

fetch the run trace

summarize slowest spans

list recent errors and likely fixes

Datadog MCP Server is a preview bridge between Datadog observability data and MCP-supporting agents/clients and is allowlist-gated; it is not supported for production use during preview.
Datadog also documents MCP client monitoring with LLM Observability, including tracing lifecycle steps and tool invocation errors.

ECS/Fargate Datadog baseline (from current AWS account setup)

If any Lyrebird service is deployed on ECS Fargate, use the proven sidecar pattern:

IAM roles:

DatadogTaskRole with ECS read permissions (`ecs:ListClusters`, `ecs:ListContainerInstances`, `ecs:DescribeContainerInstances`)

DatadogTaskExecutionRole with `secretsmanager:GetSecretValue` for the Datadog API key secret ARN

Task definition pattern:

`datadog-agent` container (`public.ecr.aws/datadog/agent:latest`) with APM enabled and `ECS_FARGATE=true`

`datadog-log-router` container (`public.ecr.aws/aws-observability/aws-for-fluent-bit:stable`) with FireLens

application container with `DD_TRACE_AGENT_URL=unix:///var/run/datadog/apm.socket`

shared `dd-sockets` volume mounted into agent and app container

log output via `awsfirelens` to Datadog intake for the active site (current setup uses `us5.datadoghq.com`)

Security requirement:

Do not place Datadog API keys directly in task-definition environment variables.
Store API keys in AWS Secrets Manager and inject via ECS `secrets` mapping at runtime.

15. Testing & QA (TestSprite 11A)
    Test strategy

E2E UI flows (business-flow tests):

demo mode: generate chat → extract → approve → albumen pass → graph → song

negative path: force extraction failure, verify UI recovery + retry

Backend/API tests

Step Functions orchestration endpoints

Neo4j upsert correctness

artifact storage correctness

TestSprite MCP Server documentation highlights frontend E2E business-flow testing and backend API/integration testing coverage.

Outputs (must be demoable)

Test report artifacts (screenshots/videos/logs where supported by TestSprite)

A “quality gate” status shown in UI (“Tests: PASS/FAIL”)

16. Deployment Plan (AWS 10A)
    Environments

Hackathon env (single region; minimal IAM blast radius)

Services (serverless-first)

Amazon Bedrock AgentCore Runtime: deploy Strands agent container (via starter toolkit).

AWS Step Functions: orchestration

AWS Lambda: glue tasks (Neo4j upsert, artifact packaging, notifications)

DynamoDB: run state

S3: artifact store (lyrics/audio)

CloudFront + S3 (or Amplify): frontend hosting

Secrets Manager: MiniMax API key + Neo4j creds + Datadog keys

MCP endpoints configured for local development/debugging:

Datadog MCP endpoint for current site: `https://mcp.us5.datadoghq.com/api/unstable/mcp-server/mcp`

17. Success Metrics (hackathon + product)
    Demo success (binary)

Live run completes end-to-end inside the demo window.

Datadog dashboard shows a trace for the run with spans per stage.

Neo4j graph is visible and interactive.

Audio is streamed/played; lyrics are displayed.

Quality metrics (directional)

≥ 80% of Yolk facts approved without edit on the synthetic dataset (target)

Albumen removes/replaces all synthetic PII tokens (target 100% for demo)

18. Demo Script (science-fair + technical)

“Generate fictional hackathon chat” → Run Egg

Yolk FactsBoard: show explanation-first provenance + rationale

Albumen: find “names/emails” → replace with fictional roster → show diffs

Graph Explorer: click nodes and show relationships (decision ↔ person ↔ task)

Song Studio: generate lyrics → call MiniMax music generation → play streamed or final audio

Datadog: open the run trace, show stage spans, show slowest step, show any retries

(Optional) Debug Agent: ask “why did the run slow down?” → MCP-assisted answer

19. Risks & Mitigations

MiniMax API limits / generation variance

Risk: rate limits, variable generation latency, or expiring audio URLs in provider responses.

Mitigation: persist returned audio into S3 immediately and fall back to “lyrics-only + placeholder backing track” (pre-bundled audio) on generation failure/timeout.

Datadog MCP access limitations

Risk: allowlist + preview restrictions.

Mitigation: MCP is a “stretch”; core observability is LLM Observability traces + dashboards.

Time constraints for full 11A testing loop

Mitigation: prioritize 2 E2E flows + 1 failure flow; expand if time permits.

20. Acceptance Criteria (Definition of Done)

A build is “done” for hackathon judging if:

AWS: Agent runs on AgentCore Runtime and the workflow is orchestrated in Step Functions.

UI: CopilotKit renders:

Egg input

Yolk fact review

Albumen find/replace

interactive graph

song studio/player
and does not expose raw JSON.

Graph: Neo4j Aura contains the run graph and the UI queries it live.

Music: MiniMax music generation produces playable output (or fallback path triggers cleanly).

Observability: Datadog shows:

a run trace with spans per stage

dashboards for latency/errors/tokens

at least one “debuggable incident” example (forced failure scenario).

Testing: TestSprite produces at least one E2E test report for the primary flow.
