import type {
  AlbumenPass,
  AlbumenPassDraft,
  Fact,
  GraphData,
  Message,
  LLMCallSummary,
  RunState,
  SongArtifact,
  TelemetryEvent,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_BASE || ''

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`${path} -> ${response.status} ${response.statusText} ${body}`)
  }

  return response.json()
}

export async function fetchSimulatedLog(seed: string, messageCount: number) {
  const params = new URLSearchParams({ seed, messageCount: String(messageCount) })
  const data = await requestJson<{
    seed: string
    messageCount: number
    messages: Message[]
    runState: RunState
  }>(`/api/simulated-discord/log?${params.toString()}`)

  return data
}

export async function startEggRun(payload: {
  mode: 'seeded' | 'paste'
  seed: string
  messageCount: number
  transcript?: string
  promptHint?: string
}) {
  const data = await requestJson<{
    runId: string
    runState: RunState
    messages: Message[]
    messagesCount: number
    llm?: LLMCallSummary
  }>('/api/run/egg', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return data
}

export async function runYolk(runId: string) {
  const data = await requestJson<{
    runId: string
    stage: string
    facts: Fact[]
    runState: RunState
    llm?: LLMCallSummary
  }>(`/api/run/${runId}/yolk`, { method: 'POST', body: JSON.stringify({}) })

  return data
}

export async function runAlbumen(runId: string, passes: AlbumenPassDraft[]) {
  const data = await requestJson<{
    runId: string
    stage: string
    facts: Fact[]
    passes: AlbumenPass[]
    runState: RunState
    llm?: LLMCallSummary
  }>(`/api/run/${runId}/albumen`, {
    method: 'POST',
    body: JSON.stringify({ passes }),
  })

  return data
}

export async function fetchGraph(runId: string) {
  const data = await requestJson<{
    runId: string
    stage: string
    graph: GraphData
    runState: RunState
    llm?: LLMCallSummary
  }>(`/api/run/${runId}/graph`, { method: 'POST', body: JSON.stringify({}) })

  return data
}

export async function runMusic(runId: string, payload: { prompt: string; mood: string; mockOnly: boolean }) {
  const data = await requestJson<{
    runId: string
    stage: string
    songArtifact: SongArtifact
    runState: RunState
    llm?: LLMCallSummary
    lyricSource?: string
  }>(`/api/run/${runId}/music`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return data
}

export async function fetchRunDebug(runId: string) {
  return requestJson<{
    runId: string
    stage: string
    telemetry: TelemetryEvent[]
    version: number
    traceId: string
    updatedAt: string
  }>(`/api/run/${runId}/debug`)
}

export async function exportRun(runId: string) {
  return requestJson<{
    runId: string
    traceId: string
    stage: string
    createdAt: string
    updatedAt: string
    messages: Message[]
    facts: Fact[]
    passes: AlbumenPass[]
    graph: GraphData
    songArtifact: SongArtifact | null
    version: number
    llmNotes?: LLMCallSummary[]
  }>(`/api/run/${runId}/export`)
}
