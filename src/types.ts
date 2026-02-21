export type Stage = 'idle' | 'egg' | 'yolk' | 'albumen' | 'graph' | 'music' | 'error'

export type Message = {
  id: string
  author: string
  timestamp: string
  content: string
  channel: string
  threadId: string
  isSynthetic: boolean
}

export type LLMCallSummary = {
  task: string
  model: string
  stage: string
  confidence: number
  rationale: string
  payloadPreview: string
  suggestions: string[]
  metadata: {
    source: string
    latencyMs: number
    runId?: string
    traceId?: string
  }
  createdAt: string
}

export type FactStatus = 'pending' | 'approved' | 'removed' | 'rewritten'

export type Fact = {
  id: string
  text: string
  confidence: number
  provenance: {
    runId: string
    sourceMessageIds: string[]
    excerpts?: string[]
    passVersion?: number
  }
  status: FactStatus
  version: number
  rationale: string
  appliedDiffs?: Array<{
    before: string
    after: string
  }>
}

export type RunState = {
  id: string
  stage: Stage
  version: number
  traceId: string
  updatedAt: string
  errors: string[]
}

export type PassRule = {
  id: string
  find: string
  replace: string
  action: 'replace' | 'pii_remove' | 'rewrite_tone'
}

export type AlbumenPassDraft = {
  id: string
  find: string
  replace: string
  action: PassRule['action']
  version?: number
  createdAt?: number
  touchedCount?: number
}

export type AlbumenPass = {
  id: string
  version: number
  createdAt: number
  rules: PassRule[]
  touchedCount: number
}

export type GraphNode = {
  id: string
  label: string
  type: 'run' | 'message' | 'fact' | 'pass' | 'song' | 'profile' | 'context'
  [key: string]: unknown
}

export type GraphEdge = {
  from: string
  to: string
  relation: string
}

export type GraphData = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type SongArtifact = {
  id: string
  runId: string
  trackUrl: string
  format: string
  durationMs: number
  waveformSummary: string[]
  audioProvider: 'minimax' | 'mock'
  createdAt: number
  providerMeta?: {
    reason?: string
    host?: string
    source?: string
    rawModel?: string
  }
  lyrics?: string
  style?: string
  mood?: string
}

export type TelemetryEvent = {
  id: string
  eventName: string
  runId: string
  stage: Stage
  traceId: string
  latencyMs: number
  correlationId: string
  errorCode?: string | null
  eventData: Record<string, unknown>
  timestamp: number
}

export type RunBundle = {
  runId: string
  stage: Stage
  traceId: string
  createdAt: string
  updatedAt: string
  messages: Message[]
  facts: Fact[]
  passes: AlbumenPass[]
  graph: GraphData
  songArtifact: SongArtifact | null
  version: number
  llmNotes?: LLMCallSummary[]
}

export type MusicPlaceholderVariant = {
  id: string
  label: string
  requestFile: string
  responseFile: string
  responseHeadersFile?: string
  callArtifactFile?: string
  exportFile?: string
}

export type PlaceholderFindItem = {
  factId?: string
  text?: string
  sourceMessageIds?: string[]
  find?: string
  [key: string]: unknown
}

export type PlaceholderReplaceItem = {
  factId?: string
  result?: string
  find?: string
  replace?: string
  sourceMessageIds?: string[]
  [key: string]: unknown
}

export type PackDemoPayload = {
  packId: string
  runId: string
  runState: RunState
  messages: Message[]
  facts: Fact[]
  passes: AlbumenPass[]
  graph: GraphData
  songArtifact: SongArtifact | null
  llmNotes?: LLMCallSummary[]
  placeholderFiles?: string[]
  placeholders: {
    placeholderFiles?: string[]
    variantList?: MusicPlaceholderVariant[]
    selectedMusicVariant?: string
    rawFactsPath: string
    findFactsPath: string
    replaceFactsPath: string
    finalGraphMusicPath: string
    minimaxRequestPath: string
    minimaxResponsePath: string
    minimaxResponseHeadersPath?: string
    minimaxCallArtifactPath: string
    minimaxExportPath: string | null
    findSeed: string
    replaceSeed: string
    musicPrompt: string
    musicMood: string
    musicPlaceholderTrackUrl?: string
    responseHeadersAvailable: boolean
    placeholderFindOutputs?: PlaceholderFindItem[]
    placeholderReplaceOutputs?: PlaceholderReplaceItem[]
  }
}
