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
        <h2>Discord Log Simulation</h2>
        <div className="toggle-row">
          <span>{messages.length} messages</span>
          <button onClick={onToggleRawJson} type="button">
            {showRawJson ? 'Hide JSON' : 'Show JSON'}
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
  return (
    <CopilotFrame>
      <div className="section-head">
        <h2>Yolk Raw Facts</h2>
        <button onClick={onRun} disabled={isBusy || !canRun}>
          {isBusy ? 'Running...' : 'Run Yolk'}
        </button>
      </div>
      <p className="muted">{facts.length} fact(s) requested up to {defaultLimit}</p>
      <div className="fact-list">
        {facts.map((fact) => (
          <article className="fact" key={fact.id}>
            <div className="fact__head">
              <strong>Fact #{fact.version}</strong>
              <span>confidence {formatPercent(fact.confidence)}</span>
              <span>status {fact.status}</span>
            </div>
            <textarea
              className="fact__text"
              value={fact.text}
              onChange={(event) => onEdit(fact.id, event.target.value)}
            />
            <p className="muted fact__why">Why: {fact.rationale || 'Derived from source messages.'}</p>
            <div className="chip-row">
              <button onClick={() => onToggle(fact.id, fact.status === 'approved' ? 'pending' : 'approved')}>
                {fact.status === 'approved' ? 'Unapprove' : 'Approve'}
              </button>
              <button onClick={() => onToggle(fact.id, 'removed')}>Remove</button>
              <button onClick={() => onToggle(fact.id, fact.status === 'rewritten' ? 'pending' : 'rewritten')}>Rewrite Tag</button>
            </div>
          </article>
        ))}
        {!facts.length && <p className="muted">{`Run Yolk to extract up to ${defaultLimit} facts from the transcript.`}</p>}
      </div>
    </CopilotFrame>
  )
}

function GraphPanel({ graph }: { graph: GraphData | null }) {
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
        <h2>Knowledge Graph</h2>
        <span>{nodes.length} nodes</span>
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
      {!nodes.length && <p className="muted">Run Graph after processing stages.</p>}
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
        <h2>Music Studio</h2>
        <span>{songArtifact ? 'Ready' : 'Awaiting generation'}</span>
      </div>
      <div className="music-controls">
        <label>
          Prompt
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <label>
          Mood
          <input value={mood} onChange={(event) => setMood(event.target.value)} />
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={mockOnly} onChange={(event) => setMockOnly(event.target.checked)} />
          Mock mode only
        </label>
        <button onClick={() => onGenerate(prompt, mood, mockOnly)} disabled={disabled || inProgress}>
          {inProgress ? 'Generating...' : 'Generate Song'}
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
        <h2>Debug Console</h2>
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
        <h2>LLM Insights</h2>
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
  const [seed, setSeed] = useState('judge-demo-01')
  const [messageCount, setMessageCount] = useState(260)
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
  const [ruleFind, setRuleFind] = useState('emails')
  const [ruleReplace, setRuleReplace] = useState('[REDACTED]')
  const [ruleAction, setRuleAction] = useState<'replace' | 'pii_remove' | 'rewrite_tone'>('replace')
  const [yolkFactLimit, setYolkFactLimit] = useState(5)
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState('')

  const canSeed = Boolean(seed)

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
    if (!canSeed) {
      return
    }
    try {
      const payload = await fetchSimulatedLog(seed, messageCount)
      setPreviewMessages(payload.messages)
    } catch (error) {
      setMessage(`Seed preview failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function extractFacts() {
    setIsBusy(true)
    setMessage('')

    try {
      const egg = await startEggRun({
        mode,
        seed,
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
      const rules: AlbumenPassDraft[] = [
        {
          id: crypto.randomUUID(),
          find: ruleFind,
          replace: ruleReplace,
          action: ruleAction,
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
      setMessage('Albumen pass applied. Graph and facts now include transform history.')
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
    link.download = `lyrebird-run-${runId.slice(0, 10)}-${seedFromText(seed)}.json`
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

  useEffect(() => {
    handleSeedPreview()
  }, [seed, messageCount])

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
            <h2>Input Plane</h2>
            <label className="control-row">
              <span>Input Source</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as 'seeded' | 'paste')}>
                <option value="seeded">Generate Fictional Discord Chat</option>
                <option value="paste">Paste Transcript</option>
              </select>
            </label>
            <label className="control-row">
              <span>Seed</span>
              <input value={seed} onChange={(event) => setSeed(event.target.value)} />
            </label>
            <label className="control-row">
              <span>Message Count</span>
              <input
                type="range"
                min={8}
                max={360}
                value={messageCount}
                onChange={(event) => setMessageCount(Number(event.target.value))}
              />
              <strong>{messageCount}</strong>
            </label>
            <label className="control-row">
              <span>Yolk Fact Count</span>
              <input
                type="number"
                min={1}
                max={50}
                value={yolkFactLimit}
                onChange={(event) => {
                  const nextValue = Number.parseInt(event.target.value, 10)
                  setYolkFactLimit(Math.max(1, Math.min(50, Number.isNaN(nextValue) ? 5 : nextValue)))
                }}
              />
            </label>
            {mode === 'paste' && (
              <label className="control-row">
                <span>Transcript</span>
                <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} />
              </label>
            )}
          </CopilotFrame>

          <FactPanel
            facts={facts}
            onToggle={handleFactStatus}
            onEdit={handleFactEdit}
            onRun={extractFacts}
            canRun={canSeed}
            isBusy={isBusy}
            defaultLimit={yolkFactLimit}
          />

          <CopilotFrame>
            <div className="section-head">
              <h2>Albumen Rule Builder</h2>
              <span>stackable pass</span>
            </div>
            <label className="control-row">
              <span>Action</span>
              <select value={ruleAction} onChange={(event) => setRuleAction(event.target.value as 'replace' | 'pii_remove' | 'rewrite_tone')}>
                <option value="replace">find-replace</option>
                <option value="pii_remove">PII remove</option>
                <option value="rewrite_tone">Rewrite tone</option>
              </select>
            </label>
            <label className="control-row">
              <span>Find</span>
              <input value={ruleFind} onChange={(event) => setRuleFind(event.target.value)} />
            </label>
            <label className="control-row">
              <span>Replace</span>
              <input value={ruleReplace} onChange={(event) => setRuleReplace(event.target.value)} />
            </label>
            <div className="button-row">
              <button onClick={applyAlbumen} disabled={isBusy || !runId}>
                Run Albumen Pass
              </button>
              <button onClick={buildGraph} disabled={isBusy || !runId}>
                Build Graph
              </button>
              <button onClick={exportBundle} disabled={!runId}>
                Export Run Bundle
              </button>
            </div>
          </CopilotFrame>

          {message && <p className="status-banner">{message}</p>}
          <GraphPanel graph={graph} />
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
              <h2>Pass Ledger</h2>
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
            <h2>Run Snapshot</h2>
            <pre>{runId ? JSON.stringify({ runId, stage: runState?.stage || 'idle', traceId: runState?.traceId || 'pending', errors: runState?.errors || [] }, null, 2) : 'No active run'}</pre>
          </CopilotFrame>
        </section>
      </main>
    </div>
  )
}
