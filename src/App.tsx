import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CopilotSidebar } from '@copilotkit/react-ui'
import {
  fetchSimulatedLog,
  fetchGraph,
  loadDemoPack as fetchDemoPackData,
  fetchRunDebug,
  exportRun,
  runAlbumen,
  runMusic,
  runYolk,
  startEggRun,
} from './services/api'
import type {
  AlbumenPass,
  AlbumenPassDraft,
  Fact,
  GraphNode,
  GraphData,
  Message,
  RunBundle,
  RunState,
  LLMCallSummary,
  PlaceholderFindItem,
  PlaceholderReplaceItem,
  MusicPlaceholderVariant,
  SongArtifact,
  TelemetryEvent,
} from './types'
import { formatDate, formatPercent } from './utils/format'
import { seedFromText } from './utils/sampler'

function CopilotFrame({ children }: { children: ReactNode }) {
  return <section className="copilot-card">{children}</section>
}

function resolveTrackUrl(trackUrl: string, apiBase = '') {
  if (!trackUrl) {
    return ''
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trackUrl)) {
    return trackUrl
  }

  if (trackUrl.startsWith('/')) {
    return `${apiBase}${trackUrl}`
  }

  return `${apiBase}/${trackUrl}`
}

const API_BASE = import.meta.env.VITE_API_BASE || ''

function MessageLog({
  messages,
  showRawJson,
  onToggleRawJson,
}: {
  messages: Message[]
  showRawJson: boolean
  onToggleRawJson: () => void
}) {
  return (
    <CopilotFrame>
      <div className="section-head">
        <h2>💬 Discord Log Simulation</h2>
        <div className="toggle-row">
          <span>{messages.length} messages</span>
          <button onClick={onToggleRawJson} type="button" aria-label={showRawJson ? 'Hide JSON Data' : 'Show JSON Data'}>
            {showRawJson ? '📦 Hide JSON' : '📥 Show JSON'}
          </button>
        </div>
      </div>
      <div className="message-log">
        {messages.map((message) => (
          <article className="message" key={message.id}>
            <header className="message__meta">
              <strong>{message.author}</strong>
              <span>{message.channel}</span>
              <span>{formatDate(message.timestamp)}</span>
            </header>
            <p>{message.content}</p>
          </article>
        ))}
        {!messages.length && <p className="muted">No messages yet. Start with Egg to generate a run.</p>}
      </div>
      {showRawJson && (
        <pre className="mock-json">{JSON.stringify(messages, null, 2)}</pre>
      )}
    </CopilotFrame>
  )
}

function FactPanel({
  facts,
  onToggle,
  onEdit,
  onRun,
  canRun,
  isBusy,
  defaultLimit,
}: {
  facts: Fact[]
  onToggle: (factId: string, status: Fact['status']) => void
  onEdit: (factId: string, text: string) => void
  onRun: () => void
  canRun: boolean
  isBusy: boolean
  defaultLimit: number
}) {
  const [expandedFacts, setExpandedFacts] = useState<Set<string>>(new Set())
  const rationalePreviewLength = 150

  function toggleRationale(factId: string) {
    setExpandedFacts((current) => {
      const next = new Set(current)
      if (next.has(factId)) {
        next.delete(factId)
      } else {
        next.add(factId)
      }
      return next
    })
  }

  return (
    <CopilotFrame>
      <div className="section-head">
        <h2>🧩 Yolk Raw Facts</h2>
        <button onClick={onRun} disabled={isBusy || !canRun} aria-label="Run Yolk">
          {isBusy ? '⚡ Running...' : 'Run Yolk ✨'}
        </button>
      </div>
      <p className="muted">Fact count target: {facts.length}/{defaultLimit}</p>
      <div className="fact-list">
        {facts.map((fact) => {
          const factIndex = facts.indexOf(fact) + 1
          const rationale = fact.rationale || 'Derived from source messages.'
          const isExpanded = expandedFacts.has(fact.id)
          const shouldTruncate = rationale.length > rationalePreviewLength
          const previewRationale = `${rationale.slice(0, rationalePreviewLength).trimEnd()}...`

          return (
          <article className="fact" key={fact.id}>
            <div className="fact__head">
              <button
                className="fact__remove"
                aria-label="Remove fact"
                onClick={() => onToggle(fact.id, 'removed')}
                type="button"
              >
                ✕
              </button>
              <strong>Fact #{factIndex}</strong>
              <p className="fact__why">
                <span className="fact__why-title">Why:</span>
                <span
                  className="fact__why-text"
                  data-expanded={isExpanded ? '1' : '0'}
                >
                  {isExpanded || !shouldTruncate ? rationale : previewRationale}
                </span>
                {shouldTruncate && (
                  <button
                    className="fact__ellipsis"
                    onClick={() => toggleRationale(fact.id)}
                    aria-label={isExpanded ? 'Collapse explanation' : 'Expand explanation'}
                    type="button"
                  >
                    {isExpanded ? '▲' : '...'}
                  </button>
                )}
              </p>
            </div>
            <textarea
              className="fact__text"
              value={fact.text}
              onChange={(event) => onEdit(fact.id, event.target.value)}
            />
          </article>
          )
        })}
        {!facts.length && <p className="muted">{`Run Yolk to extract up to ${defaultLimit} facts from the transcript.`}</p>}
      </div>
    </CopilotFrame>
  )
}

function FactResultPanel({
  title,
  facts,
  emptyMessage,
}: {
  title: string
  facts: Fact[]
  emptyMessage: string
}) {
  return (
    <CopilotFrame>
      <div className="section-head">
        <h2>{title}</h2>
        <span>{facts.length} fact(s)</span>
      </div>
      <div className="fact-list">
        {facts.map((fact) => (
          <article className="fact" key={fact.id}>
            <div className="fact__head">
              <strong>{fact.version}</strong>
              <span>status {fact.status}</span>
              <span>confidence {formatPercent(fact.confidence)}</span>
            </div>
            <p className="fact__text">{fact.text}</p>
            <p className="muted fact__why">
              <span className="fact__why-title">Why:</span>
              <span>{fact.rationale}</span>
            </p>
          </article>
        ))}
        {!facts.length && <p className="muted">{emptyMessage}</p>}
      </div>
    </CopilotFrame>
  )
}

function normalizeFindPlaceholderFact(item: PlaceholderFindItem, index: number): Fact {
  const factText = String(item?.text || '').trim()
  const factId = String(item?.factId || `reference-find-${index + 1}`)
  const sourceMessageIds = Array.isArray(item?.sourceMessageIds) ? item.sourceMessageIds.slice(0, 6) : []
  return {
    id: factId,
    text: factText || 'Reference fact result for find output.',
    confidence: 0.99,
    provenance: {
      runId: String(item?.runId || 'reference-run'),
      sourceMessageIds,
      passVersion: 1,
    },
    status: 'pending',
    version: 1,
    rationale: String(item?.rationale || 'Reference find result from seeded artifacts.'),
  }
}

function normalizeReplacePlaceholderFact(item: PlaceholderReplaceItem, index: number): Fact {
  const beforeText = String(item?.before || item?.text || item?.find || '').trim()
  const resultText = String(item?.result || item?.after || '').trim()
  const factId = String(item?.factId || `reference-replace-${index + 1}`)
  const sourceMessageIds = Array.isArray(item?.sourceMessageIds) ? item.sourceMessageIds.slice(0, 6) : []
  return {
    id: factId,
    text: resultText || `Reference replace result for ${factId}.`,
    confidence: 0.99,
    provenance: {
      runId: String(item?.runId || 'reference-run'),
      sourceMessageIds,
      passVersion: 2,
    },
    status: 'pending',
    version: 2,
    rationale: String(
      item?.rationale || `Reference edit result. Before: ${beforeText}`,
    ),
  }
}

function GraphPanel({
  graph,
  onBuild,
  canRun,
  isBusy,
  facts,
}: {
  graph: GraphData | null
  onBuild: () => void
  canRun: boolean
  isBusy: boolean
  facts: Fact[]
}) {
  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []
  const factTextById = useMemo(
    () => new Map(facts.map((fact) => [fact.id, fact.text])),
    [facts],
  )

  const visibleGraph = useMemo(() => {
    if (!nodes.length) {
      return { nodes: [], edges: [] as Array<typeof edges[number]> }
    }

    const fallbackContextNodeId = '__context__'
    const contextProfileIds = new Set(
      nodes.filter((node) => node.type === 'context' || node.type === 'profile').map((node) => node.id),
    )
    const contextNode = nodes.find((node) => node.type === 'context') || null
    const contextNodeId = contextNode ? String(contextNode.id) : fallbackContextNodeId

    const isRawFact = (node: (typeof nodes)[number]) => {
      if (node.type !== 'fact') return false

      const version = node.version
      if (version == null) return true
      if (typeof version === 'number') return version === 1
      if (typeof version === 'string') {
        const parsed = Number(version)
        if (Number.isFinite(parsed)) return parsed === 1
      }

      return true
    }

    const rawFactIds = new Set(nodes.filter(isRawFact).map((node) => node.id))
    const visibleNodeIds = new Set<string>(contextProfileIds)
    const rawFactNodeIds = new Set<string>()

    if (contextProfileIds.size > 0) {
      for (const edge of edges) {
        if (contextProfileIds.has(edge.from) && rawFactIds.has(edge.to)) {
          visibleNodeIds.add(edge.to)
          rawFactNodeIds.add(edge.to)
        }
        if (contextProfileIds.has(edge.to) && rawFactIds.has(edge.from)) {
          visibleNodeIds.add(edge.from)
          rawFactNodeIds.add(edge.from)
        }
      }
      rawFactIds.forEach((id) => {
        if (visibleNodeIds.has(id)) {
          rawFactNodeIds.add(id)
        }
      })
    } else {
      rawFactIds.forEach((id) => visibleNodeIds.add(id))
      rawFactIds.forEach((id) => rawFactNodeIds.add(id))
    }

    if (rawFactNodeIds.size > 0) {
      visibleNodeIds.add(contextNodeId)
    }

    const visibleNodes = nodes.filter((node) => visibleNodeIds.has(node.id))
    if (!nodes.some((node) => node.id === contextNodeId) && contextNodeId === fallbackContextNodeId) {
      visibleNodes.push({
        id: contextNodeId,
        label: 'Context',
        type: 'context',
      })
    }

    const visibleEdgeSet = new Set<string>()
    for (const edge of edges) {
      if (visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)) {
        visibleEdgeSet.add(`${edge.from}::${edge.to}`)
      }
    }
    for (const factId of rawFactNodeIds) {
      if (factId !== contextNodeId) {
        visibleEdgeSet.add(`${contextNodeId}::${factId}`)
      }
    }

    const visibleEdges = [...visibleEdgeSet].map((key) => {
      const [from, to] = key.split('::')
      return { from, to, relation: `fact_context_link` }
    })

    return {
      nodes: visibleNodes,
      edges: visibleEdges,
    }
  }, [nodes, edges])

  const getWrappedLabel = (label: string, maxLength = 18) => {
    const words = String(label || '').split(' ')
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (next.length > maxLength && current) {
        lines.push(current)
        current = word
      } else {
        current = next
      }
    }
    if (current) lines.push(current)

    return lines.slice(0, 3).map((line) => line.slice(0, maxLength))
  }

  const getFactTextFromNode = (node: GraphNode) => {
    const normalizedNodeId = String(node.id || '').replace(/^fact:/, '')
    const rawFactId = normalizedNodeId.split('#')[0]
    return (
      factTextById.get(rawFactId)
      || factTextById.get(node.id)
      || factTextById.get(normalizedNodeId)
      || node.label
    )
  }

  const getNodeRadius = (nodeType: string) => (nodeType === 'fact' ? 38 : 22)
  const getNodeTextLines = (node: GraphNode) =>
    node.type === 'fact'
      ? getWrappedLabel(getFactTextFromNode(node), 16)
      : [String(node.label || '').slice(0, 18)]
  const getNodeTextY = (node: GraphNode, index: number, total: number) => {
    if (node.type !== 'fact' || total <= 1) return node.y + 42

    return node.y + (index - (total - 1) / 2) * 12
  }

  const positioned = useMemo(() => {
    const width = 640
    const height = 360
    const centerX = width / 2
    const centerY = height / 2
    const safeMarginX = 72
    const safeMarginY = 76
    const spreadWidth = width / 2 - safeMarginX
    const spreadHeight = height / 2 - safeMarginY

    const laidOut = visibleGraph.nodes.map((node) => ({
      ...node,
      r: getNodeRadius(node.type),
      x: centerX,
      y: centerY,
    }))

    laidOut.forEach((node, index) => {
      const angle = index * ((Math.PI * 2) / Math.max(1, laidOut.length)) + index * 0.43
      const maxSpiralRadius = Math.max(spreadWidth, spreadHeight) * 0.95
      const radius = Math.min(Math.sqrt(index + 1) * 34 + 34, maxSpiralRadius)
      node.x = centerX + Math.cos(angle) * Math.min(radius, spreadWidth)
      node.y = centerY + Math.sin(angle) * Math.min(radius, spreadHeight)
    })

    const iterations = 140
    const padding = 12

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      for (let i = 0; i < laidOut.length; i += 1) {
        for (let j = i + 1; j < laidOut.length; j += 1) {
          const nodeA = laidOut[i]
          const nodeB = laidOut[j]
          const dx = nodeB.x - nodeA.x
          const dy = nodeB.y - nodeA.y
          const distance = Math.hypot(dx, dy) || 0.001 * (i + j + 1)
          const minDistance = nodeA.r + nodeB.r + padding

          if (distance >= minDistance) {
            continue
          }

          const overlap = (minDistance - distance) / distance
          const shiftX = (dx / distance) * overlap * 0.5
          const shiftY = (dy / distance) * overlap * 0.5

          nodeA.x -= shiftX
          nodeA.y -= shiftY
          nodeB.x += shiftX
          nodeB.y += shiftY
        }
      }

      const settleWeight = 0.015
      for (const node of laidOut) {
        node.x = Math.min(width - safeMarginX, Math.max(safeMarginX, node.x))
        node.y = Math.min(height - safeMarginY, Math.max(safeMarginY, node.y))

        const pullX = centerX - node.x
        const pullY = centerY - node.y
        node.x += pullX * settleWeight
        node.y += pullY * settleWeight
      }
    }

    return laidOut.map(({ r, ...node }) => node)
  }, [visibleGraph.nodes])

  const indexById = new Map(positioned.map((node) => [node.id, node]))

  return (
    <CopilotFrame>
      <div className="section-head">
        <h2>🕸️ Knowledge Graph</h2>
        <button onClick={onBuild} disabled={isBusy || !canRun} aria-label="Build Graph">
          {isBusy ? '⚙️ Running...' : 'Run Graph 🕸️'}
        </button>
      </div>
      <div className="graph-wrap">
        <svg className="graph" viewBox="0 0 640 360" role="img" aria-label="Knowledge graph preview">
          {visibleGraph.edges.map((edge, index) => {
            const from = indexById.get(edge.from)
            const to = indexById.get(edge.to)
            if (!from || !to) return null
            return (
              <line
                key={`edge-${index}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="graph__edge"
              />
            )
          })}
          {positioned.map((node) => {
            const lines = getNodeTextLines(node)
            const radius = getNodeRadius(node.type)
            return (
              <g key={node.id}>
                <circle cx={node.x} cy={node.y} r={radius} className={`graph__node ${node.type}`} />
                {lines.map((line, lineIndex) => (
                  <text
                    key={`${node.id}-${lineIndex}`}
                    x={node.x}
                    y={getNodeTextY(node, lineIndex, lines.length)}
                    className={node.type === 'fact' ? 'graph__label graph__label--fact' : 'graph__label'}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {line}
                  </text>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
      {!visibleGraph.nodes.length && <p className="muted">Run Graph to build a trace from profile + context + facts.</p>}
    </CopilotFrame>
  )
}

function MusicPanel({
  songArtifact,
  onGenerate,
  onGeneratePlaceholder,
  inProgress,
  disabled,
  promptSeed,
  moodSeed,
  onPromptChange,
  onMoodChange,
  placeholderPlayToken,
}: {
  songArtifact: SongArtifact | null
  onGenerate: (prompt: string, mood: string, mockOnly: boolean) => Promise<void>
  onGeneratePlaceholder: () => string
  inProgress: boolean
  disabled: boolean
  promptSeed: string
  moodSeed: string
  onPromptChange: (value: string) => void
  onMoodChange: (value: string) => void
  placeholderPlayToken: number
}) {
  const [prompt, setPrompt] = useState(promptSeed)
  const [mood, setMood] = useState(moodSeed)
  const [mockOnly, setMockOnly] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playHint, setPlayHint] = useState('')
  const displayTrackUrl = resolveTrackUrl(songArtifact?.trackUrl || '', API_BASE)

  async function tryPlayTrack(trackUrl?: string) {
    if (!audioRef.current) return

    const resolvedTrackUrl = resolveTrackUrl(trackUrl || '', API_BASE)

    if (!resolvedTrackUrl) {
      setPlayHint('No track URL available for playback.')
      return
    }

    if (!audioRef.current.src || resolvedTrackUrl !== audioRef.current.src) {
      audioRef.current.src = resolvedTrackUrl
      audioRef.current.load()
    }

    audioRef.current.currentTime = 0

    try {
      await audioRef.current.play()
      setPlayHint('')
    } catch {
      setPlayHint('Browser blocked auto-play. Click the audio control to start.')
    }
  }

  const handleLoadPlaceholder = async () => {
    const trackUrl = onGeneratePlaceholder()
    await tryPlayTrack(trackUrl)
  }

  const handleGenerateSong = () => {
    void onGenerate(prompt, mood, mockOnly)
  }

  useEffect(() => {
    setPrompt(promptSeed)
  }, [promptSeed])

  useEffect(() => {
    setMood(moodSeed)
  }, [moodSeed])

  useEffect(() => {
    if (!songArtifact || placeholderPlayToken <= 0) return
    void tryPlayTrack(songArtifact.trackUrl)
  }, [placeholderPlayToken, songArtifact?.trackUrl])

  return (
    <CopilotFrame>
      <div className="section-head">
        <h2>🎛️ Music Studio</h2>
        <span>{songArtifact ? '🎧 Ready' : '🎵 Awaiting groove'}</span>
      </div>
      <div className="music-controls">
        <label>
          <span>🧠 Prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => {
              const next = event.target.value
              setPrompt(next)
              onPromptChange(next)
            }}
          />
        </label>
        <label>
          <span>🎭 Mood</span>
          <input
            value={mood}
            onChange={(event) => {
              const next = event.target.value
              setMood(next)
              onMoodChange(next)
            }}
          />
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={mockOnly} onChange={(event) => setMockOnly(event.target.checked)} />
          <span>🎤 Offline mode only</span>
        </label>
          <div className="button-row button-row--compact">
          <button
            onClick={handleGenerateSong}
            disabled={disabled || inProgress}
            aria-label="Generate Song"
          >
          {inProgress ? '🛠️ Generating...' : 'Generate Song 🎶'}
        </button>
          <button
            type="button"
            onClick={handleLoadPlaceholder}
            disabled={disabled || inProgress}
            aria-label="Load Song Placeholder"
            title="Load reference sample track"
          >
            ⚡
          </button>
          </div>
      </div>
      <div className="song-card">
        <h3>Song Artifact</h3>
        {songArtifact ? (
          <>
            <p>Provider: {songArtifact.audioProvider}</p>
            <p>Format: {songArtifact.format}</p>
            <p>Lyrics Source: {songArtifact.providerMeta?.lyricSource || 'fallback template'}</p>
            <p>Generated Model: {songArtifact.providerMeta?.rawModel || 'n/a'}</p>
            <p>Duration: {Math.round(songArtifact.durationMs / 1000)}s</p>
            <details>
              <summary>Factual lyric sheet</summary>
              <pre>{songArtifact.lyrics || 'Lyrics unavailable'}</pre>
            </details>
          </>
        ) : (
          <p>No track loaded yet.</p>
        )}
        <audio
          controls
          ref={audioRef}
          src={songArtifact ? displayTrackUrl : undefined}
          preload="auto"
          onError={() => setPlayHint('Audio decoding failed for sample track.')} 
          onPlay={() => setPlayHint('')}
        >
          Your browser does not support this audio element.
        </audio>
      </div>
      {playHint && <p className="muted">⚠️ {playHint}</p>}
      <p className="muted">
        MiniMax generation is configured on the backend; if unavailable, a fallback track remains available for playback.
      </p>
    </CopilotFrame>
  )
}

function TelemetryPanel({ events }: { events: TelemetryEvent[] }) {
  return (
    <CopilotFrame>
      <div className="section-head">
        <h2>📡 Debug Console</h2>
        <span>{events.length} events</span>
      </div>
      <ul className="telemetry">
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.eventName}</strong>
            <span>{event.stage}</span>
            <span>{event.errorCode || 'ok'}</span>
            <time>{new Date(event.timestamp).toLocaleTimeString()}</time>
          </li>
        ))}
        {!events.length && <p className="muted">No events yet.</p>}
      </ul>
    </CopilotFrame>
  )
}

function LLMInsightsPanel({ notes }: { notes: LLMCallSummary[] }) {
  return (
    <CopilotFrame>
      <div className="section-head">
        <h2>🧠 LLM Neural Notes</h2>
        <span>{notes.length} entries</span>
      </div>
      <ul className="llm-notes">
      {notes.map((note, index) => (
          <li key={`${note.task}-${note.createdAt}-${index}`}>
            <strong>{note.task}</strong> · {note.model}
            <span>confidence {formatPercent(note.confidence)}</span>
            <span>stage {note.stage}</span>
            <span>{note.payloadPreview}</span>
            <p className="muted fact__why">{note.rationale}</p>
            <p className="muted">
              {String(note.metadata?.source || 'inference').replace('mock-inference', 'inference')} • {note.metadata?.latencyMs || 0}ms
            </p>
            <ul className="llm-suggestions">
              {note.suggestions?.slice(0, 3).map((suggestion) => (
                <li key={suggestion}>{suggestion}</li>
              ))}
            </ul>
          </li>
        ))}
        {!notes.length && <li className="muted">No model trace yet. Run stages to build full provenance.</li>}
      </ul>
    </CopilotFrame>
  )
}

function PlaceholderPanel({
  files,
  variants,
  activeVariant,
  onSelectVariant,
  isBusy,
}: {
  files: string[]
  variants: MusicPlaceholderVariant[]
  activeVariant: string
  isBusy: boolean
  onSelectVariant: (variantId: string) => Promise<void> | void
}) {
  return (
    <CopilotFrame>
      <div className="section-head">
        <h2>🧪 Reference Assets</h2>
        <span>{files.length} files</span>
      </div>
      <p className="muted">These generated files are sourced from project artifacts and used to prefill the sandbox run.</p>
      {files.length ? (
        <ul className="placeholder-files">
          {files.map((fileName) => (
            <li key={fileName}>{fileName}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No artifact manifest loaded yet.</p>
      )}
      {!!variants.length && (
        <div className="placeholder-variants">
          <h3>🎛️ Music Presets</h3>
          <div className="button-row button-row--compact">
            {variants.map((variant) => {
              const isActive = variant.id === activeVariant
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => onSelectVariant(variant.id)}
                  disabled={isBusy}
                  className={isActive ? 'active-preset' : ''}
                  aria-label={`Load ${variant.label}`}
                >
                  {isActive ? '✓ ' : ''}
                  {variant.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </CopilotFrame>
  )
}

export function App() {
  const demoPackId = 'discord-chat-hackathon-aws-lof'
  const [mode, setMode] = useState<'seeded' | 'paste'>('seeded')
  const [profile, setProfile] = useState(
    'Avery Chen, CEO of Driftline — focused on product quality, cross-team clarity, and investor confidence. Quick checks, clean ops, bold launches.',
  )
  const messageCount = 260
  const [transcript, setTranscript] = useState('Kai: pushed new instrumentation and fixed edge case.\nLex: we should add replay guardrails.')
  const [runId, setRunId] = useState('')
  const [runState, setRunState] = useState<RunState | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [previewMessages, setPreviewMessages] = useState<Message[]>([])
  const [showRawJson, setShowRawJson] = useState(false)
  const [facts, setFacts] = useState<Fact[]>([])
  const [passes, setPasses] = useState<AlbumenPass[]>([])
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [songArtifact, setSongArtifact] = useState<SongArtifact | null>(null)
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([])
  const [llmNotes, setLlmNotes] = useState<LLMCallSummary[]>([])
  const [ruleFind, setRuleFind] = useState('')
  const [ruleReplace, setRuleReplace] = useState('')
  const [musicPrompt, setMusicPrompt] = useState(
    'Upbeat, playful instrumentation with layered hi-hats and soft bass.',
  )
  const [musicMood, setMusicMood] = useState('playful')
  const [placeholderTrackUrl, setPlaceholderTrackUrl] = useState('/api/plans/artifacts/music_prod_tts-20260221103606-udrEprgbjcAeqNKa.mp3')
  const [placeholderTrackPlayToken, setPlaceholderTrackPlayToken] = useState(0)
  const [placeholderFiles, setPlaceholderFiles] = useState<string[]>([])
  const [placeholderVariants, setPlaceholderVariants] = useState<MusicPlaceholderVariant[]>([])
  const [activePlaceholderVariant, setActivePlaceholderVariant] = useState<string>('')
  const [factFilter, setFactFilter] = useState('')
  const [placeholderFindFacts, setPlaceholderFindFacts] = useState<Fact[]>([])
  const [placeholderReplaceFacts, setPlaceholderReplaceFacts] = useState<Fact[]>([])
  const [foundFacts, setFoundFacts] = useState<Fact[]>([])
  const [replacedFacts, setReplacedFacts] = useState<Fact[]>([])
  const yolkFactLimit = 5
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState('')

  const canRunYolk = Boolean(profile.trim())
  const profileSeed = useMemo(() => `profile-${seedFromText(profile, 12)}`, [profile])
  const visibleFacts = useMemo(() => {
    const normalized = factFilter.trim().toLowerCase()

    if (!normalized) return facts

    return facts.filter((fact) => fact.text.toLowerCase().includes(normalized))
  }, [facts, factFilter])

  function addLLMNote(note?: LLMCallSummary | null) {
    if (!note) return
    setLlmNotes((current) => [note, ...current].slice(0, 6))
  }

  async function refreshDebug(runIdValue = runId) {
    if (!runIdValue) return

    try {
      const debug = await fetchRunDebug(runIdValue)
      setTelemetry(debug.telemetry)
    } catch {
      // keep local stream only
    }
  }

  async function handleSeedPreview() {
    if (!canRunYolk) {
      return
    }
    try {
      const payload = await fetchSimulatedLog(profileSeed, messageCount)
      setPreviewMessages(payload.messages)
    } catch (error) {
      setMessage(`Seed preview failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function loadDemoPack(musicVariant?: string) {
    try {
      setIsBusy(true)
      setMessage('Loading reference run...')
      const bundle = await fetchDemoPackData(demoPackId, { musicVariant })
      setRunId(bundle.runId)
      setRunState(bundle.runState)
      setMessages(bundle.messages)
      setPreviewMessages(bundle.messages)
      setFacts(bundle.facts)
      setPasses(bundle.passes)
      setPlaceholderFiles(bundle.placeholders?.placeholderFiles || bundle.placeholders?.files || [])
      setPlaceholderVariants(bundle.placeholders?.variantList || [])
      setActivePlaceholderVariant(bundle.placeholders?.selectedMusicVariant || '')
      setPlaceholderFindFacts((bundle.placeholders?.placeholderFindOutputs || []).map(normalizeFindPlaceholderFact))
      setPlaceholderReplaceFacts(
        (bundle.placeholders?.placeholderReplaceOutputs || []).map(normalizeReplacePlaceholderFact),
      )
      setSongArtifact(bundle.songArtifact)
      setGraph(bundle.graph)
      setLlmNotes(bundle.llmNotes || [])
      setRuleFind(bundle.placeholders.findSeed)
      setRuleReplace(bundle.placeholders.replaceSeed)
      setFactFilter('')
      setFoundFacts([])
      setReplacedFacts([])
      setPlaceholderTrackUrl(
        bundle.placeholders?.musicPlaceholderTrackUrl
          || '/api/plans/artifacts/music_prod_tts-20260221103606-udrEprgbjcAeqNKa.mp3',
      )
      setMusicPrompt(bundle.placeholders.musicPrompt || musicPrompt)
      setMusicMood(bundle.placeholders.musicMood || musicMood)
      await refreshDebug(bundle.runId)
      setMessage('Loaded reference run.')
    } catch (error) {
      setMessage(`Run load failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsBusy(false)
    }
  }

  async function selectMusicVariant(variantId: string) {
    await loadDemoPack(variantId)
  }

  async function extractFacts() {
    setIsBusy(true)
    setMessage('')
    setFactFilter('')

    try {
      const egg = await startEggRun({
        mode,
        seed: profileSeed,
        profile,
        messageCount,
        transcript: mode === 'paste' ? transcript : '',
        promptHint: 'generate factual song track from reference Discord run',
      })

      setRunId(egg.runId)
      setRunState(egg.runState)
      setMessages(egg.messages)
      setFacts([])
      setPasses([])
      setSongArtifact(null)
      setGraph(null)
      setLlmNotes([])
      setPlaceholderFindFacts([])
      setPlaceholderReplaceFacts([])
      setFoundFacts([])
      setReplacedFacts([])
      addLLMNote(egg.llm)

      const result = await runYolk(egg.runId, {
        factLimit: yolkFactLimit,
      })

      setRunState(result.runState)
      setFacts(result.facts)
      addLLMNote(result.llm)
      setMessage('Yolk produced explainable facts. Review and transform.')
      await refreshDebug(egg.runId)
    } catch (error) {
      setMessage(`Yolk failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsBusy(false)
    }
  }

  async function applyAlbumen() {
    if (!runId) return
    setIsBusy(true)

    try {
      if (!ruleFind.trim()) {
        setMessage('Set a find term before applying Albumen.')
        return
      }
      if (!ruleReplace.trim()) {
        setMessage('Set a replace instruction before applying Albumen.')
        return
      }

      const rules: AlbumenPassDraft[] = [
        {
          id: crypto.randomUUID(),
          find: ruleFind,
          replace: ruleReplace,
          action: 'replace',
          version: 1,
          createdAt: Date.now(),
          touchedCount: 0,
        },
      ]
      const result = await runAlbumen(runId, rules)
      setRunState(result.runState)
      setFacts(result.facts)
      setPasses(result.passes)
      addLLMNote(result.llm)
      if (factFilter) {
        setMessage(`Albumen pass applied to ${result.passes?.at(-1)?.touchedCount || 0} fact(s). Filter retained: "${factFilter}".`)
      } else {
        setMessage('Albumen pass applied. Graph and facts now include transform history.')
      }
      await refreshDebug(runId)
    } catch (error) {
      setMessage(`Albumen failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsBusy(false)
    }
  }

  async function buildGraph() {
    if (!runId) return
    setIsBusy(true)

    try {
      const result = await fetchGraph(runId)
      setRunState(result.runState)
      setGraph(result.graph)
      addLLMNote(result.llm)
      setMessage('Graph built from profile/context input and atomic facts.')
      await refreshDebug(runId)
    } catch (error) {
      setMessage(`Graph failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsBusy(false)
    }
  }

  async function generateSong(prompt: string, mood: string, mockOnly: boolean) {
    if (!runId) return
    setIsBusy(true)

    try {
      const result = await runMusic(runId, {
        prompt,
        mood,
        mockOnly,
      })
      setRunState(result.runState)
      setSongArtifact(result.songArtifact)
      addLLMNote(result.llm)
      setMessage('Song generated. You can now play the artifact below.')
      await refreshDebug(runId)
    } catch (error) {
      setMessage(`Music failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsBusy(false)
    }
  }

  function runMusicPlaceholder() {
    if (!runId) {
      setMessage('Load or start a run before loading the sample track.')
      return ''
    }
    if (!placeholderTrackUrl) {
      setMessage('No sample track is configured.')
      return ''
    }

    const placeholderArtifact = {
      id: crypto.randomUUID(),
      runId,
      trackUrl: placeholderTrackUrl,
      format: 'audio/mpeg',
      durationMs: 0,
      waveformSummary: ['reference'],
      audioProvider: 'reference',
      createdAt: Date.now(),
      providerMeta: {
        source: 'plans-artifacts-reference',
        reason: 'reference_track',
        rawModel: 'reference-generation',
      },
      lyrics: 'Loaded reference track from provided sample artifact.',
      style: musicPrompt || 'studio',
      mood: musicMood || 'playful',
    }

    setSongArtifact(placeholderArtifact)
    setPlaceholderTrackPlayToken((current) => current + 1)
    setMessage('Loaded reference track and queued playback.')
    return placeholderArtifact.trackUrl
  }

  async function exportBundle() {
    if (!runId) return

    const bundle = await exportRun(runId)
    const payload: RunBundle = {
      runId: bundle.runId,
      stage: bundle.stage as RunBundle['stage'],
      traceId: bundle.traceId,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
      messages: bundle.messages,
      facts: bundle.facts,
      passes: bundle.passes,
      graph: bundle.graph,
      songArtifact: bundle.songArtifact,
      version: bundle.version,
      llmNotes: bundle.llmNotes,
    }
    const file = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(file)
    link.download = `lyrebird-run-${runId.slice(0, 10)}-${seedFromText(profile)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    setMessage('Run bundle exported.')
  }

  function handleFactEdit(id: string, text: string) {
    setFacts((current) => current.map((fact) => (fact.id === id ? { ...fact, text } : fact)))
  }

  function handleFactStatus(id: string, status: Fact['status']) {
    setFacts((current) => current.map((fact) => (fact.id === id ? { ...fact, status } : fact)))
  }

  function runFind() {
    const query = ruleFind.trim().toLowerCase()

    if (query) {
      const matchedFacts = facts.filter((fact) => fact.text.toLowerCase().includes(query))
      const mapped = matchedFacts.map((fact) => ({
        ...fact,
        id: `found-${fact.id}`,
      }))
      setFoundFacts(mapped)
      setMessage(`Find matched ${matchedFacts.length} fact(s) containing "${query}".`)
      return
    }

    setFoundFacts([])
    setMessage('Set a find term first.')
  }

  function runFindPlaceholder() {
    if (!placeholderFindFacts.length) {
      setFoundFacts([])
      setMessage('No reference find output is available.')
      return
    }

    setFoundFacts(placeholderFindFacts)
    setMessage(`Loaded ${placeholderFindFacts.length} reference fact(s) for Find.`)
  }

  async function runReplace() {
    const query = ruleFind.trim().toLowerCase()

    if (!runId) {
      setMessage('Run Yolk first before replacing facts.')
      return
    }
    if (!query) {
      setMessage('Set a find term before Replace.')
      return
    }
    const matchingFacts = facts.filter((fact) => fact.text.toLowerCase().includes(query)).length
    if (!matchingFacts) {
      setMessage(`No facts found for "${query}" to edit.`)
      return
    }
    if (!ruleReplace.trim()) {
      setMessage('Set a replace instruction before Replace.')
      return
    }

    setIsBusy(true)

    try {
      const rules: AlbumenPassDraft[] = [
        {
          id: crypto.randomUUID(),
          find: query,
          replace: ruleReplace.trim(),
          action: 'replace',
          version: 1,
          createdAt: Date.now(),
          touchedCount: 0,
        },
      ]
      const result = await runAlbumen(runId, rules)
      setRunState(result.runState)
      setPasses(result.passes)
      addLLMNote(result.llm)
      const touched = result.passes?.at(-1)?.touchedCount || 0
      const fallback = result.facts
        .filter((fact) => fact.version > 1)
        .map((fact) => ({
          ...fact,
          id: `replaced-${fact.id}`,
        }))

      const fromPlaceholder =
        placeholderReplaceFacts.length && matchingFacts
          ? placeholderReplaceFacts.slice(0, matchingFacts)
          : placeholderReplaceFacts

      setReplacedFacts(fromPlaceholder.length ? fromPlaceholder : fallback)
      setMessage(
        `Replace completed for ${touched || fromPlaceholder.length || fallback.length} fact(s): ${query} -> ${ruleReplace.trim()}.`,
      )
      setFactFilter('')
      await refreshDebug(runId)
    } catch (error) {
      setMessage(`Albumen failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsBusy(false)
    }
  }

  function runReplacePlaceholder() {
    if (!placeholderReplaceFacts.length) {
      setReplacedFacts([])
      setMessage('No reference replace output is available.')
      return
    }

    setReplacedFacts(placeholderReplaceFacts)
    setMessage(`Loaded ${placeholderReplaceFacts.length} reference fact(s) for Replace.`)
  }

  useEffect(() => {
    handleSeedPreview()
  }, [profileSeed, messageCount])

  useEffect(() => {
    void loadDemoPack()
  }, [])

  return (
    <div className="app-shell">
      <header className="title-shell">
        <h1 className="hero-title">Lyrebird</h1>
        <p className="hero-subtitle">Boring threads 🧵 become fun songs 🎵 when you review and shape a knowledge graph from conversations ✨, then turn it into music you can vibe to 🎧</p>
      </header>
      <CopilotSidebar
        defaultOpen={false}
        shortcut="k"
        instructions="Lyrebird console assistant: ask about stage state, facts quality, or music output summary."
      />

      <main className="layout">
        <section className="controls">
          <CopilotFrame>
            <h2>🎚️ Input Plane</h2>
            <div className="button-row">
              <button onClick={loadDemoPack} disabled={isBusy} type="button">
                Discord Chat Log
              </button>
            </div>
            <label className="control-row">
              <span>🎛️ Input Source</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as 'seeded' | 'paste')}>
                <option value="seeded">Generate Fictional Discord Chat</option>
                <option value="paste">Paste Transcript</option>
              </select>
            </label>
            <label className="control-row">
              <span>👤 Profile</span>
              <textarea
                value={profile}
                onChange={(event) => setProfile(event.target.value)}
                placeholder="A CEO, engineer, or analyst persona can be used as context for fact extraction."
              />
            </label>
            {mode === 'paste' && (
              <label className="control-row">
                <span>📝 Transcript</span>
                <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} />
              </label>
            )}
          </CopilotFrame>

          <FactPanel
            facts={visibleFacts}
            onToggle={handleFactStatus}
            onEdit={handleFactEdit}
            onRun={extractFacts}
            canRun={canRunYolk}
            isBusy={isBusy}
            defaultLimit={yolkFactLimit}
          />

          <CopilotFrame>
            <div className="section-head">
              <h2>🧪 Find/Replace</h2>
            </div>
            <label className="control-row">
              <div className="control-label-row">
                <span>🔎 Find</span>
                <button
                  type="button"
                  onClick={() => setRuleFind('sponsor')}
                  className="placeholder-button"
                  aria-label="🔍"
                  title="Seed find with sponsors"
                >
                  🔍
                </button>
              </div>
              <div className="inline-control">
                <input
                  value={ruleFind}
                  onChange={(event) => setRuleFind(event.target.value)}
                  placeholder="find term"
                />
                <button type="button" onClick={runFind} disabled={isBusy || !runId}>
                  🔎 Find
                </button>
                <button
                  type="button"
                  onClick={runFindPlaceholder}
                  disabled={isBusy || !runId}
                  title="Load reference find output"
                >
                  ⚡
                </button>
              </div>
            </label>
            <label className="control-row">
              <div className="control-label-row">
                <span>Replace</span>
                <button
                  type="button"
                  onClick={() => setRuleReplace("add 'amazing' to each sponsor name")}
                  className="placeholder-button"
                  aria-label="✍️"
                  title="Seed replace with amazing sponsor suffix"
                >
                  ✍️
                </button>
              </div>
              <div className="inline-control">
                <input
                  value={ruleReplace}
                  onChange={(event) => setRuleReplace(event.target.value)}
                  placeholder="replace instruction"
                />
                <button type="button" onClick={runReplace} disabled={isBusy || !runId}>
                  Replace
                </button>
                <button
                  type="button"
                  onClick={runReplacePlaceholder}
                  disabled={isBusy || !runId}
                  title="Load reference replace output"
                >
                  ⚡
                </button>
              </div>
            </label>
            <FactResultPanel
              title="🔎 Find Results"
              facts={foundFacts}
              emptyMessage="Run Find to capture sponsor matches."
            />
            <FactResultPanel
              title="✍️ Replaced Results"
              facts={replacedFacts}
              emptyMessage="Run Replace to capture edited facts."
            />
          </CopilotFrame>

          {message && <p className="status-banner">{message}</p>}
          <GraphPanel graph={graph} facts={facts} onBuild={buildGraph} canRun={Boolean(runId)} isBusy={isBusy} />
          <MusicPanel
            songArtifact={songArtifact}
            onGenerate={generateSong}
            onGeneratePlaceholder={runMusicPlaceholder}
            onPromptChange={setMusicPrompt}
            onMoodChange={setMusicMood}
            promptSeed={musicPrompt}
            moodSeed={musicMood}
            inProgress={isBusy}
            disabled={!runId}
            placeholderPlayToken={placeholderTrackPlayToken}
          />
          <TelemetryPanel events={telemetry} />
      </section>

        <section className="inspector">
          <LLMInsightsPanel notes={llmNotes} />
          <PlaceholderPanel
            files={placeholderFiles}
            variants={placeholderVariants}
            activeVariant={activePlaceholderVariant}
            onSelectVariant={selectMusicVariant}
            isBusy={isBusy}
          />
          <MessageLog
            messages={runId ? messages : previewMessages}
            showRawJson={showRawJson}
            onToggleRawJson={() => setShowRawJson((current) => !current)}
          />
            <CopilotFrame>
              <div className="section-head">
                <h2>🧾 Pass Ledger</h2>
                <span>{passes.length} pass(es)</span>
              </div>
            <ul className="pass-list">
              {passes.map((pass) => (
                <li key={pass.id}>
                  <strong>Pass {pass.version}</strong>
                  <span>Touched {pass.touchedCount} fact(s)</span>
                </li>
              ))}
              {!passes.length && <li className="muted">No albumen pass run yet.</li>}
            </ul>
          </CopilotFrame>
          <CopilotFrame>
            <h2>🧬 Run Snapshot</h2>
            <pre>{runId ? JSON.stringify({ runId, stage: runState?.stage || 'idle', traceId: runState?.traceId || 'pending', errors: runState?.errors || [] }, null, 2) : 'No active run'}</pre>
          </CopilotFrame>
        </section>
      </main>
    </div>
  )
}
