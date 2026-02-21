import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CopilotSidebar } from '@copilotkit/react-ui'
import {
  fetchSimulatedLog,
  fetchGraph,
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
  GraphData,
  Message,
  RunBundle,
  RunState,
  LLMCallSummary,
  SongArtifact,
  TelemetryEvent,
} from './types'
import { formatDate, formatPercent } from './utils/format'
import { seedFromText } from './utils/sampler'

function CopilotFrame({ children }: { children: ReactNode }) {
  return <section className="copilot-card">{children}</section>
}

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
              <strong>Fact #{fact.version}</strong>
              <span>confidence {formatPercent(fact.confidence)}</span>
              <span>status {fact.status}</span>
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

function GraphPanel({
  graph,
  onBuild,
  canRun,
  isBusy,
}: {
  graph: GraphData | null
  onBuild: () => void
  canRun: boolean
  isBusy: boolean
}) {
  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []

  const positioned = useMemo(() => {
    return nodes.map((node, index) => {
      const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2
      const radius = index % 2 === 0 ? 210 : 160
      return {
        ...node,
        x: 320 + Math.cos(angle) * radius,
        y: 180 + Math.sin(angle) * radius,
      }
    })
  }, [nodes])

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
          {edges.map((edge, index) => {
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
            return (
              <g key={node.id}>
                <circle cx={node.x} cy={node.y} r="20" className={`graph__node ${node.type}`} />
                <text x={node.x} y={node.y + 34} className="graph__label">
                  {node.label.slice(0, 20)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      {!nodes.length && <p className="muted">Run Graph to build a visual trace from transformed facts.</p>}
    </CopilotFrame>
  )
}

function MusicPanel({
  songArtifact,
  onGenerate,
  inProgress,
  disabled,
}: {
  songArtifact: SongArtifact | null
  onGenerate: (prompt: string, mood: string, mockOnly: boolean) => Promise<void>
  inProgress: boolean
  disabled: boolean
}) {
  const [prompt, setPrompt] = useState('Upbeat, playful instrumentation with layered hi-hats and soft bass.')
  const [mood, setMood] = useState('playful')
  const [mockOnly, setMockOnly] = useState(false)

  return (
    <CopilotFrame>
      <div className="section-head">
        <h2>🎛️ Music Studio</h2>
        <span>{songArtifact ? '🎧 Ready' : '🎵 Awaiting groove'}</span>
      </div>
      <div className="music-controls">
        <label>
          <span>🧠 Prompt</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <label>
          <span>🎭 Mood</span>
          <input value={mood} onChange={(event) => setMood(event.target.value)} />
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={mockOnly} onChange={(event) => setMockOnly(event.target.checked)} />
          <span>🎤 Mock mode only</span>
        </label>
          <button
            onClick={() => onGenerate(prompt, mood, mockOnly)}
            disabled={disabled || inProgress}
            aria-label="Generate Song"
          >
          {inProgress ? '🛠️ Generating...' : 'Generate Song 🎶'}
        </button>
      </div>
      {songArtifact && (
        <div className="song-card">
          <h3>Song Artifact</h3>
          <p>Provider: {songArtifact.audioProvider}</p>
          <p>Format: {songArtifact.format}</p>
          <p>Lyrics Source: {songArtifact.providerMeta?.lyricSource || 'fallback template'}</p>
          <p>Generated Model: {songArtifact.providerMeta?.rawModel || 'n/a'}</p>
          <p>Duration: {Math.round(songArtifact.durationMs / 1000)}s</p>
          <audio controls src={songArtifact.trackUrl} preload="auto">
            Your browser does not support this audio element.
          </audio>
          <details>
            <summary>Factual lyric sheet</summary>
            <pre>{songArtifact.lyrics || 'Lyrics unavailable'}</pre>
          </details>
        </div>
      )}
      <p className="muted">MiniMax model path is configured in mock backend; if unavailable it falls back to synthetic tone and remains playable.</p>
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
              {note.metadata?.source || 'mock-inference'} • {note.metadata?.latencyMs || 0}ms
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

export function App() {
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
  const [factFilter, setFactFilter] = useState('')
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
        promptHint: 'generate factual song track from mock Discord run',
      })

      setRunId(egg.runId)
      setRunState(egg.runState)
      setMessages(egg.messages)
      setFacts([])
      setPasses([])
      setSongArtifact(null)
      setGraph(null)
      setLlmNotes([])
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
      setMessage('Graph built from mock provenance and transform metadata.')
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
      setFactFilter(query)
      const matched = facts.filter((fact) => fact.text.toLowerCase().includes(query)).length
      setMessage(`Find matched ${matched} fact(s) containing "${query}".`)
      return
    }

    setMessage('Set a find term first.')
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

    setFactFilter(query)
    await applyAlbumen()
    setMessage(`Replace completed for ${matchingFacts} fact(s): ${query} -> ${ruleReplace.trim()}.`)
  }

  useEffect(() => {
    handleSeedPreview()
  }, [profileSeed, messageCount])

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="kicker">Lyrebird • Hackathon Flow</p>
        <h1>Egg → Yolk → Albumen → Song</h1>
        <p className="muted">Mock-first demo with Copilot-inspired orchestration and MiniMax-aware music generation.</p>
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
              <button
                onClick={applyAlbumen}
                disabled={isBusy || !runId}
                aria-label="Run Albumen Pass"
              >
                Run Albumen Pass 🧪
              </button>
            </div>
            <label className="control-row">
              <div className="control-label-row">
                <span>🔎 Find</span>
                <button type="button" onClick={() => setRuleFind('sponsors')} className="placeholder-button" aria-label="Seed find with sponsors">
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
              </div>
            </label>
            <label className="control-row">
              <div className="control-label-row">
                <span>Replace</span>
                <button type="button" onClick={() => setRuleReplace("add 'amazing' to each sponsor name")} className="placeholder-button" aria-label="Seed replace with amazing sponsor suffix">
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
                  ✍️ Replace
                </button>
              </div>
            </label>
          </CopilotFrame>

          {message && <p className="status-banner">{message}</p>}
          <GraphPanel graph={graph} onBuild={buildGraph} canRun={Boolean(runId)} isBusy={isBusy} />
          <MusicPanel songArtifact={songArtifact} onGenerate={generateSong} inProgress={isBusy} disabled={!runId} />
          <TelemetryPanel events={telemetry} />
      </section>

        <section className="inspector">
          <LLMInsightsPanel notes={llmNotes} />
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
