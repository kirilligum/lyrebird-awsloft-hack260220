import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const app = express()
const PORT = Number(process.env.MOCK_SERVER_PORT || 3001)
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.MINMAX_API_KEY || ''
const MINIMAX_API_HOST = process.env.MINIMAX_API_HOST || 'https://api.minimax.io'
const MINIMAX_MOCK_ONLY = process.env.MINIMAX_MOCK_ONLY === 'true' || process.env.MINIMAX_MOCK_ONLY === '1'
const MINIMAX_REQUEST_TIMEOUT_MS = Number(process.env.MINIMAX_REQUEST_TIMEOUT_MS || '2200')
const DEFAULT_MOCK_TOKEN = 'mock'
const DISCORD_FIXTURE_PATH = path.resolve(process.cwd(), 'src', 'data', 'simulated-discord-log.json')
const MAX_SIMULATED_MESSAGES = 360

let discordFixtureCache = null

app.use(cors())
app.use(express.json({ limit: '10mb' }))

const runs = new Map()

const STAGE_MAP = ['idle', 'egg', 'yolk', 'albumen', 'graph', 'music', 'done', 'error']

const authors = [
  'Ari',
  'Bea',
  'Chen',
  'Dee',
  'Evo',
  'Fae',
  'Gus',
  'Ivy',
]

const channels = ['build', 'ops', 'ideas', 'launch', 'frontend', 'backend', 'random']
const verbs = [
  'deployed',
  'merged',
  'benchmarked',
  'fixed',
  'rejected',
  'approved',
  'measured',
  'replayed',
  'reviewed',
]
const nounPool = [
  'feature flag',
  'ingest pipeline',
  'Discord webhook',
  'Neo4j graph run',
  'Datadog dashboard',
  'music model prompt',
  'agent path',
  'test suite',
  'trace id',
]

const MODEL_BY_TASK = {
  fact_extraction: 'mock-llm-factualizer-1',
  lyric_generation: 'mock-llm-versewright-1',
  music_prompt: 'mock-llm-stylecraft-1',
  graph_summary: 'mock-llm-graphwright-1',
  albumen_summary: 'mock-llm-transformer-1',
}

function clampText(value = '', limit = 2560) {
  return String(value || '').slice(0, limit)
}

function hashSeed(value = '') {
  let h = 2166136261 >>> 0
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) || 1
}

function makeRng(seed = '') {
  let state = hashSeed(seed)
  return function next() {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)]
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function toISO(ms) {
  return new Date(ms).toISOString()
}

function loadDiscordFixture() {
  if (discordFixtureCache !== null) {
    return discordFixtureCache
  }

  try {
    const raw = fs.readFileSync(DISCORD_FIXTURE_PATH, 'utf8')
    const parsed = JSON.parse(raw)

    if (parsed && typeof parsed === 'object') {
      discordFixtureCache = parsed.seeds || parsed
    } else {
      discordFixtureCache = {}
    }
  } catch (error) {
    console.error(`Unable to load simulated discord fixture from ${DISCORD_FIXTURE_PATH}: ${error.message}`)
    discordFixtureCache = {}
  }

  return discordFixtureCache
}

function getFixtureMessages(seed = '') {
  const fixtures = loadDiscordFixture()
  const seedData = fixtures?.[seed]

  if (Array.isArray(seedData)) {
    return seedData
  }

  if (seedData && Array.isArray(seedData.messages)) {
    return seedData.messages
  }

  return []
}

function toFixtureTimestamp(rawTimestamp, fallbackSeed, fallbackIndex) {
  const parsed = rawTimestamp ? Date.parse(rawTimestamp) : NaN
  if (Number.isFinite(parsed)) {
    return toISO(parsed)
  }

  const seeded = makeRng(`${fallbackSeed}-${fallbackIndex}`)
  return toISO(Date.now() - (fallbackIndex + 1) * 42000 - Math.floor(seeded() * 12000))
}

function buildDiscordMessagesFromSeed(seed, messageCount) {
  const count = parseIntSafe(messageCount, 24, 1, MAX_SIMULATED_MESSAGES)
  const rawMessages = getFixtureMessages(seed)

  const fixtureMessages = rawMessages.slice(0, count).map((message, index) => {
    const localRng = makeRng(`${seed}-fixture-${index}`)
    const author =
      typeof message?.author === 'string' && message.author.trim()
        ? message.author.trim()
        : pick(authors, localRng)
    const channel =
      typeof message?.channel === 'string' && message.channel.trim()
        ? message.channel.trim()
        : pick(channels, localRng)
    const content =
      typeof message?.content === 'string' && message.content.trim()
        ? message.content.trim()
        : 'Operational update captured in simulation file.'

    return {
      id: message?.id || crypto.randomUUID(),
      author,
      timestamp: toFixtureTimestamp(message?.timestamp, seed, index),
      content,
      channel,
      threadId: message?.threadId || `${slugify(author)}-${slugify(seed)}-${index}`,
      isSynthetic: message?.isSynthetic !== false,
    }
  })

  if (fixtureMessages.length < count) {
    const fill = generateSimulatedDiscord(`${seed}-fixture`, count - fixtureMessages.length)
    return fixtureMessages.concat(fill)
  }

  return fixtureMessages
}

function createRunRecord(runId, payload) {
  return {
    id: runId,
    stage: 'egg',
    version: 1,
    traceId: payload.traceId,
    options: {
      mode: payload.mode,
      seed: payload.seed,
      messageCount: payload.messageCount,
      includeTranscript: Boolean(payload.transcript),
      promptHint: payload.promptHint || '',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageSeed: payload.seed,
    messages: [],
    llmNotes: [],
    yolkFacts: [],
    albumenPasses: [],
    graph: { nodes: [], edges: [] },
    songArtifact: null,
    telemetry: [],
  }
}

function addLLMNote(run, stage, llmOutput, metadata = {}) {
  if (!run?.llmNotes || !llmOutput) return

  run.llmNotes.unshift({
    task: llmOutput.task,
    model: llmOutput.model,
    stage,
    confidence: llmOutput.confidence,
    rationale: llmOutput.rationale,
    payloadPreview: llmOutput.payloadPreview,
    suggestions: llmOutput.suggestions,
    metadata: {
      source: metadata.source || 'mock-llm',
      latencyMs: llmOutput.latencyMs || 0,
      runId: run.id,
      traceId: run.traceId,
    },
    createdAt: toISO(Date.now()),
  })
}

function pushTelemetry(run, eventName, stage, details = {}) {
  run.telemetry.unshift({
    id: crypto.randomUUID(),
    eventName,
    runId: run.id,
    stage,
    traceId: run.traceId,
    latencyMs: 0,
    correlationId: details.correlationId || run.traceId,
    errorCode: details.errorCode || null,
    eventData: details,
    timestamp: Date.now(),
  })
}

function ensureRun(runId, res) {
  const run = runs.get(runId)
  if (!run) {
    return res.status(404).json({ error: 'run_not_found', runId })
  }
  return run
}

function timestamp() {
  return toISO(Date.now())
}

function parseIntSafe(value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return fallback
  const clamped = Math.max(min, Math.min(max, parsed))
  return Math.floor(clamped)
}

function generateSimulatedDiscord(seed = 'demo', messageCount = 24) {
  const rng = makeRng(seed)
  const messages = []
  const count = parseIntSafe(messageCount, 24, 1, MAX_SIMULATED_MESSAGES)

  for (let i = 0; i < count; i++) {
    const author = pick(authors, rng)
    const channel = pick(channels, rng)
    const verb = pick(verbs, rng)
    const noun = pick(nounPool, rng)
    const emoji = rng() > 0.65 ? ` :${['rocket', 'sparkles', 'microscope', 'warning'][Math.floor(rng() * 4)]}:` : ''
    const extraTime = Math.floor(rng() * 600)

    const content = `${author.toLowerCase()} ${verb} the ${noun} after ${Math.floor(rng() * 20)} minutes${emoji}.`
    const threadId = `${slugify(author)}-${slugify(channel)}-${slugify(noun)}-${i}`
    messages.push({
      id: crypto.randomUUID(),
      author,
      timestamp: toISO(Date.now() - (count - i) * 45000 - extraTime * 1000),
      content,
      channel,
      threadId,
      isSynthetic: true,
    })

    if (rng() > 0.7) {
      messages.push({
        id: crypto.randomUUID(),
        author: pick(authors, rng),
        timestamp: toISO(Date.now() - (count - i) * 43000 - extraTime * 900),
        content: `${author} attached update details and a blocker from ${pick(['API', 'AgentCore', 'Datadog', 'Neo4j'], rng)} team.`,
        channel,
        threadId,
        isSynthetic: true,
      })
      i += 1
    }

    if (rng() > 0.92) {
      const address = `${author.toLowerCase()}_${slugify(noun).slice(0, 6)}@example.org`
      messages.push({
        id: crypto.randomUUID(),
        author: pick(authors, rng),
        timestamp: toISO(Date.now() - (count - i) * 42000 - extraTime * 700),
        content: `Contact ${address} for cross-team escalation.`,
        channel,
        threadId,
        isSynthetic: true,
      })
      i += 1
    }
  }

  return messages.slice(0, count)
}

async function mockLLM(task, payload) {
  const normalizedTask = String(task || 'analysis')
  const normalizedPayload = payload && typeof payload === 'object' ? payload : {}
  const seed = hashSeed(`${normalizedTask}:${JSON.stringify(normalizedPayload)}`)
  const confidence = Number(((seed % 30) / 100 + 0.65).toFixed(2))
  const jitter = Number(((seed % 17) / 100).toFixed(2))
  const durationMs = 140 + (seed % 160)
  const model = MODEL_BY_TASK[normalizedTask] || 'mock-llm-generic-1'
  const payloadPreview = `${normalizedTask}::${String(
    normalizedPayload.prompt || normalizedPayload.topic || normalizedPayload.mood || ''
  ).slice(0, 140)}`

  await new Promise((resolve) => setTimeout(resolve, durationMs))

  const taskAdvice = {
    fact_extraction: [
      'Prioritize statements with explicit action verbs (deployed, merged, fixed).',
      'Deduplicate similar messages by author/channel pattern to avoid noisy facts.',
      'Tag potential PII and push these to albumen pass.',
    ],
    lyric_generation: [
      'Keep structure tags and line breaks for section flow.',
      'Use first-person or team voice that maps to operational telemetry.',
      'Blend achievement, risk and next-step language into the bridge.',
    ],
    music_prompt: [
      'Translate facts to genre cues and scene details.',
      'Keep request concise with emotional curve: build -> resolve -> hook.',
      'Ensure generated lyric length is under 3500 chars.',
    ],
  }

  return {
    task: normalizedTask,
    model,
    seed,
    latencyMs: durationMs,
    confidence: Number(Math.min(0.97, confidence + jitter).toFixed(2)),
    rationale: `Deterministic mock LLM pass used for reproducible MVP data (${normalizedTask}).`,
    createdAt: toISO(Date.now()),
    payloadPreview,
    suggestions: taskAdvice[normalizedTask] || [
      'Favor grounded facts from seed messages.',
      'Preserve provenance for every transformed artifact.',
      'Keep generated outputs interpretable for investor review.',
    ],
  }
}

function buildSongLyricsFromFacts(facts, prompt, mood) {
  const cleaned = facts.slice(0, 24)
  const safePrompt = clampText(String(prompt || 'a realistic hackathon operation report'), 120)
  const safeMood = clampText(String(mood || 'playful'), 80)
  const topicLines = cleaned.length
    ? cleaned.map((fact, index) => `${index + 1}. ${fact.text}`)
    : ['No extracted fact artifacts were available for this run.']

  const intro = [
    '[Intro]',
    `[Verse 1]`,
    `${safePrompt} moved the team out of idle mode.`,
    `Telemetry stayed stable, and review kept cadence.`,
    `Confidence stayed visible, then tightened with each pass.`,
    ...topicLines.slice(0, 5).map((line) => `- ${line}`),
  ]

  const bridge = [
    '[Bridge]',
    `At ${safeMood} tempo, the board stayed aligned,`,
    'Evidence passed checks and confidence stayed high.',
    `From ${topicLines.length} extracted threads, ${Math.min(topicLines.length, 4)} are now locked for song.`,
  ]

  const chorus = [
    '[Chorus]',
    'Keep the signal high and keep the context clear.',
    'Every message maps to a trace you can review.',
    'Graph edges explain what changed and why.',
    'The stage flow stays explainable all the way to the drop.',
  ]

  const outro = [
    '[Outro]',
    `From seed to song, ${topicLines.length} milestones mapped and verified.`,
    `Final mood: ${safeMood}.`,
    'This is production-shaped confidence in a beat.',
    'If the data is good, the output sounds good.',
  ]

  const instrumental = [
    '[Instrumental]',
    'Layered synth and snare, with a clean mix hold.',
    'Crowd noise fades, bassline moves.',
  ]

  return [...intro, '', ...bridge, '', ...chorus, '', ...instrumental, '', ...outro].join('\n').slice(0, 3500)
}

function scoreToConfidence(score) {
  const normalized = Number(((score % 100) / 100).toFixed(2))
  return Number(Math.max(0.61, Math.min(0.98, 0.61 + normalized * 0.37)).toFixed(2))
}

function buildFactFromMessage(message, existingFacts = new Set(), version = 1) {
  const clean = message.content.toLowerCase()
  const sourceKey = `${message.author}:${message.channel}:${clean.slice(0, 90)}`
  const topic = clean.includes('deploy')
    ? `${message.author} deployed changes around ${message.channel}.`
    : clean.includes('merge')
      ? `${message.author} completed a merge in ${message.channel}.`
      : clean.includes('fix')
        ? `${message.author} resolved a production-impacting issue in ${message.channel}.`
        : clean.includes('reviewed')
          ? `${message.author} provided review feedback in ${message.channel}.`
          : `${message.author} updated team context in ${message.channel}.`

  if (existingFacts.has(sourceKey)) {
    return null
  }

  existingFacts.add(sourceKey)

  return {
    id: crypto.randomUUID(),
    text: topic,
    confidence: scoreToConfidence(message.timestamp.length + message.author.length),
    provenance: {
      runId: '',
      sourceMessageIds: [message.id],
      excerpts: [message.content.slice(0, 120)],
    },
    status: 'pending',
    version,
    rationale: `Evidence: ${message.content.slice(0, 72)}.`,
  }
}

function parseTranscript(transcript = '') {
  return transcript
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(':')
      const author = parts.length > 1 ? parts[0].trim() : 'Guest'
      const content = parts.length > 1 ? line.slice(author.length + 1).trim() : line
      return {
        id: crypto.randomUUID(),
        author,
        timestamp: toISO(Date.now() - Math.floor(Math.random() * 600000)),
        content,
        channel: 'paste',
        threadId: crypto.randomUUID(),
        isSynthetic: false,
      }
    })
}

async function extractFactsFromMessages(messages, version = 1) {
  const llmPass = await mockLLM('fact_extraction', {
    messageCount: messages.length,
    sample: messages.slice(0, 4).map((message) => message.content).join(' '),
  })

  const facts = []
  const seen = new Set()

  for (const message of messages) {
    const fact = buildFactFromMessage(message, seen, version)

    if (!fact) {
      continue
    }

    fact.rationale = `${llmPass.rationale} ${fact.rationale}`
    fact.confidence = Number(Math.min(0.99, fact.confidence + 0.03).toFixed(2))
    facts.push(fact)
  }

  if (!facts.length) {
    facts.push({
      id: crypto.randomUUID(),
      text: 'No clear factual event could be extracted, so a summary artifact is pending.',
      confidence: llmPass.confidence,
      provenance: {
        runId: '',
        sourceMessageIds: messages.slice(0, Math.min(2, messages.length)).map((m) => m.id),
        excerpts: ['Transcript is short or ambiguous.'],
      },
      status: 'pending',
      version,
      rationale: `${llmPass.rationale} Fallback safety fact created from sparse input.`,
    })
  }

  return { facts, llmPass }
}

function applyAlbumenPasses(run, passRules = []) {
  const rules = passRules.filter((rule) => rule && rule.find)
  const nextFacts = run.yolkFacts.map((fact) => {
    let text = fact.text
    let didChange = false
    const diffs = []

    for (const rule of rules) {
      if (rule.action === 'pii_remove' && /[\w.-]+@[\w.-]+\.[a-z]{2,}/i.test(text)) {
        const before = text
        text = text.replace(/[\w.-]+@[\w.-]+\.[a-z]{2,}/gi, '[redacted-email]')
        if (before !== text) {
          diffs.push({ before, after: text })
          didChange = true
        }
      }

      if (rule.action === 'rewrite_tone') {
        const before = text
        const prefix = rule.find || 'context-neutral'
        text = `${prefix} [rewritten] ${text}`
        if (before !== text) {
          diffs.push({ before, after: text })
          didChange = true
        }
      }

      if (rule.action === 'replace' && rule.find) {
        const before = text
        const escaped = rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const replacement = rule.replace || '[filtered]'
        const regex = new RegExp(escaped, 'gi')
        text = text.replace(regex, replacement)
        if (before !== text) {
          diffs.push({ before, after: text })
          didChange = true
        }
      }
    }

    return {
      ...fact,
      text,
      version: fact.version + 1,
      status: fact.status,
      provenance: {
        ...fact.provenance,
        sourceMessageIds: fact.provenance.sourceMessageIds,
        passVersion: run.albumenPasses.length + 1,
      },
      rationale: didChange
        ? `${diffs.length} pass mutation(s) applied.`
        : 'No mutation for this fact with current pass rules.',
      appliedDiffs: diffs,
    }
  })

  const passDiff = {
    id: crypto.randomUUID(),
    version: run.albumenPasses.length + 1,
    createdAt: Date.now(),
    rules,
    touchedCount: nextFacts.filter((f, idx) => f.text !== run.yolkFacts[idx].text).length,
  }

  run.yolkFacts = nextFacts
  run.albumenPasses.push(passDiff)
}

function buildRunGraph(run) {
  const nodes = []
  const edges = []

  nodes.push({ id: `run:${run.id}`, label: `Run ${run.id.slice(0, 8)}`, type: 'run', stage: run.stage, createdAt: timestamp() })

  run.messages.forEach((message) => {
    nodes.push({ id: `msg:${message.id}`, label: `${message.author}: ${message.content.slice(0, 18)}`, type: 'message', channel: message.channel })
    edges.push({ from: `run:${run.id}`, to: `msg:${message.id}`, relation: 'has_message' })
  })

  run.yolkFacts.forEach((fact, index) => {
    nodes.push({ id: `fact:${fact.id}`, label: `Fact ${index + 1}`, type: 'fact', status: fact.status, confidence: fact.confidence })
    edges.push({ from: `run:${run.id}`, to: `fact:${fact.id}`, relation: 'derived_fact' })
    if (fact.provenance?.sourceMessageIds?.length) {
      fact.provenance.sourceMessageIds.slice(0, 2).forEach((msgId) => {
        edges.push({ from: `fact:${fact.id}`, to: `msg:${msgId}`, relation: 'explained_by' })
      })
    }
  })

  run.albumenPasses.forEach((pass) => {
    const passNode = `pass:${pass.id}`
    nodes.push({ id: passNode, label: `Pass ${pass.version}`, type: 'pass', touchedCount: pass.touchedCount })
    edges.push({ from: `run:${run.id}`, to: passNode, relation: 'albumen_pass' })
  })

  if (run.songArtifact) {
    const artifactId = `song:${run.songArtifact.id}`
    nodes.push({ id: artifactId, label: 'Music Artifact', type: 'song', provider: run.songArtifact.audioProvider, durationMs: run.songArtifact.durationMs })
    edges.push({ from: `run:${run.id}`, to: artifactId, relation: 'produced' })
  }

  return { nodes, edges }
}

function isLikelyHex(value) {
  return typeof value === 'string' && value.length >= 64 && /^[0-9a-f]+$/i.test(value) && value.length % 2 === 0
}

function normalizeMiniMaxLyrics(payload) {
  return clampText(
    String(
      payload?.lyrics ||
        payload?.data?.lyrics ||
        payload?.data?.result?.lyrics ||
        payload?.song_title ||
        payload?.data?.song_title ||
        '',
    ).replace(/^\s+|\s+$/g, ''),
    3500,
  )
}

function normalizeMiniMaxTrack(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidates = [
    payload.data?.audio?.url,
    payload.data?.result,
    payload.result?.audio,
    payload.result?.audio_file,
    payload.data?.audio_file_url,
    payload.data?.url,
    payload.audio,
    payload.output,
    payload.result,
    payload.data?.audio?.audio_url,
    payload.data?.audio?.audio_file,
    payload.data,
  ]

  const collect = (obj) => {
    if (!obj) return null
    if (typeof obj === 'string') {
      if (/^https?:\/\//.test(obj) || /^data:audio\//.test(obj)) return obj
      if (isLikelyHex(obj)) return `data:audio/mpeg;base64,${Buffer.from(obj, 'hex').toString('base64')}`
      return null
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = collect(item)
        if (found) return found
      }
    }
    if (typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        const found = collect(value)
        if (found) return found
      }
    }
    return null
  }

  for (const cand of candidates) {
    const found = collect(cand)
    if (found) return found
  }

  return null
}

async function callMiniMax(endpoint, payload, headers, timeoutMs = MINIMAX_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort(new Error('minimax_timeout'))
  }, Math.max(350, timeoutMs))

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
  clearTimeout(timeout)

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`minimax_http_${response.status}_${text.slice(0, 120)}`)
  }

  return response.json()
}

async function generateMiniMaxLyrics(body) {
  if (!MINIMAX_API_KEY || MINIMAX_MOCK_ONLY || !body?.prompt) {
    return null
  }

  const endpoint = `${MINIMAX_API_HOST.replace(/\/$/, '')}/v1/lyrics_generation`
  const payload = {
    mode: 'write_full_song',
    prompt: String(body.prompt).slice(0, 2000),
  }
  const requestHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${MINIMAX_API_KEY}`,
    Accept: 'application/json',
  }

  const json = await callMiniMax(endpoint, payload, requestHeaders, Math.max(1200, Math.min(2000, MINIMAX_REQUEST_TIMEOUT_MS)))
  const generated = normalizeMiniMaxLyrics(json)
  return generated || null
}

async function generateMiniMaxTrack(run, body) {
  if (!MINIMAX_API_KEY || MINIMAX_MOCK_ONLY || body?.mockOnly) {
    return null
  }

  const endpoint = `${MINIMAX_API_HOST.replace(/\/$/, '')}/v1/music_generation`

  const requestedLyrics = body?.lyrics || body?.prompt
  const prompt = body?.prompt || 'Generate a short upbeat instrumental track.'
  const payload = {
    model: body?.model || 'music-2.5',
    prompt,
    lyrics: requestedLyrics ? `${requestedLyrics}` : '[verse]\nA steady beat with a determined rise.\n[chorus]\nThe team is shipping in synchronized time.',
    stream: false,
    output_format: body?.outputFormat || 'url',
    audio_setting: {
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3',
    },
  }

  const requestHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${MINIMAX_API_KEY}`,
    Accept: 'application/json',
  }

  const json = await callMiniMax(endpoint, payload, requestHeaders, Math.max(1800, Math.min(2800, MINIMAX_REQUEST_TIMEOUT_MS)))
  const trackUrl = normalizeMiniMaxTrack(json)

  if (!trackUrl) {
    throw new Error('minimax_missing_track_url')
  }

  return {
    id: crypto.randomUUID(),
    runId: run.id,
    trackUrl,
    format: 'audio/mpeg',
    durationMs: Number(json?.extra_info?.music_duration || body?.durationMs || 8000),
    waveformSummary: ['minimax-track', 'generated'],
    audioProvider: 'minimax',
    createdAt: Date.now(),
    providerMeta: {
      host: MINIMAX_API_HOST,
      source: endpoint,
      rawModel: payload.model,
    },
  }
}

function fallbackTone(req, run) {
  const seed = `${run.id}-${run.traceId}`
  const freq = 220 + (seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 180)
  return `/api/fallback/audio?seed=${encodeURIComponent(seed)}&freq=${freq}`
}

function buildFallbackWavBuffer({ durationSec = 8, sampleRate = 22050, frequency = 280, amplitude = 0.15 } = {}) {
  const numSamples = durationSec * sampleRate
  const buffer = Buffer.alloc(44 + numSamples * 2)
  const writeUInt16 = (offset, value) => buffer.writeUInt16LE(value, offset)
  const writeUInt32 = (offset, value) => buffer.writeUInt32LE(value, offset)

  const chunkSize = 36 + numSamples * 2
  buffer.write('RIFF', 0)
  writeUInt32(4, chunkSize)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  writeUInt32(16, 16)
  writeUInt16(20, 1)
  writeUInt16(22, 1)
  writeUInt32(24, sampleRate)
  writeUInt32(28, sampleRate * 2)
  writeUInt16(32, 2)
  writeUInt16(34, 16)
  buffer.write('data', 36)
  writeUInt32(40, numSamples * 2)

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const value = Math.sin(2 * Math.PI * frequency * t) * (Math.sin(i / 20) * 0.4 + 0.6)
    const sample = Math.max(-1, Math.min(1, value)) * 32767 * amplitude
    buffer.writeInt16LE(Math.round(sample), 44 + i * 2)
  }

  return buffer
}

app.get('/api/simulated-discord/log', (req, res) => {
  const seed = req.query.seed || `seed-${Math.floor(Math.random() * 1_000_000)}`
  const messageCount = parseIntSafe(req.query.messageCount, 24, 1, MAX_SIMULATED_MESSAGES)
  const messages = buildDiscordMessagesFromSeed(String(seed), messageCount)
  res.json({
    seed,
    messageCount: messages.length,
    messages,
    runState: {
      id: crypto.randomUUID(),
      stage: 'egg',
      version: 1,
      traceId: DEFAULT_MOCK_TOKEN,
      updatedAt: timestamp(),
    },
  })
})

app.post('/api/run/egg', async (req, res) => {
  const mode = req.body?.mode || 'seeded'
  const seed = req.body?.seed || `seed-${Math.floor(Math.random() * 1_000_000)}`
  const messageCount = parseIntSafe(req.body?.messageCount, 24, 1, MAX_SIMULATED_MESSAGES)
  const transcript = req.body?.transcript || ''
  const promptHint = req.body?.promptHint || ''

  const runId = crypto.randomUUID()
  const traceId = req.body?.traceId || crypto.randomUUID()

  const record = createRunRecord(runId, {
    mode,
    seed,
    messageCount,
    traceId,
    transcript,
    promptHint,
  })

  if (mode === 'paste') {
    record.messages = parseTranscript(transcript)
  } else {
    record.messages = buildDiscordMessagesFromSeed(seed, messageCount)
  }

  const bootstrapNote = await mockLLM('egg_bootstrap', {
    mode,
    seed,
    messageCount,
    includeTranscript: Boolean(transcript),
    promptHint,
  })
  addLLMNote(record, 'egg', bootstrapNote, { source: 'mock-llm-bootstrap' })

  record.stage = 'egg'
  pushTelemetry(record, 'run_egg_started', 'egg', { messageCount: record.messages.length })
  pushTelemetry(record, 'run_egg_ready', 'egg', { traceId })

  runs.set(runId, record)

  res.json({
    runId,
    runState: {
      id: runId,
      stage: record.stage,
      version: record.version,
      traceId: record.traceId,
      updatedAt: timestamp(),
      errors: [],
    },
    llm: record.llmNotes?.[0],
    messages: record.messages,
    messagesCount: record.messages.length,
  })
})

app.post('/api/run/:runId/yolk', async (req, res) => {
  const run = ensureRun(req.params.runId, res)
  if (!run || run.error) return

  try {
    run.stage = 'yolk'
    run.updatedAt = Date.now()
    pushTelemetry(run, 'run_yolk_started', 'yolk', {})

    const { facts, llmPass } = await extractFactsFromMessages(run.messages, run.version)
    const seededFacts = facts.map((fact) => ({ ...fact, provenance: { ...fact.provenance, runId: run.id } }))
    run.yolkFacts = seededFacts
    addLLMNote(run, 'yolk', llmPass, { source: 'mock-llm' })
    run.version += 1
    run.updatedAt = Date.now()
    run.stage = 'yolk'

    pushTelemetry(run, 'run_yolk_ready', 'yolk', { factCount: run.yolkFacts.length })

    res.json({
      runId: run.id,
      stage: run.stage,
      facts: run.yolkFacts,
      llm: run.llmNotes?.[0],
      runState: {
        id: run.id,
        stage: run.stage,
        version: run.version,
        traceId: run.traceId,
        updatedAt: timestamp(),
        errors: [],
      },
    })
  } catch (error) {
    run.stage = 'error'
    pushTelemetry(run, 'run_yolk_error', 'yolk', { errorCode: String(error?.message || 'yolk_error') })
    res.status(500).json({ error: 'yolk_processing_error', detail: String(error?.message || error) })
  }
})

app.post('/api/run/:runId/albumen', async (req, res) => {
  const run = ensureRun(req.params.runId, res)
  if (!run || run.error) return

  const passRules = Array.isArray(req.body?.passes) ? req.body.passes : []
  try {
    run.stage = 'albumen'
    pushTelemetry(run, 'run_albumen_started', 'albumen', { passRules: passRules.length })

    applyAlbumenPasses(run, passRules)
    const albumenNote = await mockLLM('albumen_summary', {
      passRules: passRules.length,
      passRulesSummary: passRules.map((rule) => `${rule.action}:${rule.find}`),
      touched: run.yolkFacts.filter((fact) => fact.appliedDiffs?.length).length,
    })
    addLLMNote(run, 'albumen', albumenNote, { source: 'mock-llm-summary' })

    run.updatedAt = Date.now()
    run.stage = 'albumen'
    run.version += 1

    pushTelemetry(run, 'run_albumen_ready', 'albumen', {
      passCount: run.albumenPasses.length,
      touched: run.yolkFacts.filter((fact) => fact.appliedDiffs?.length).length,
    })

    res.json({
      runId: run.id,
      stage: run.stage,
      facts: run.yolkFacts,
      passes: run.albumenPasses,
      llm: run.llmNotes?.[0],
      runState: {
        id: run.id,
        stage: run.stage,
        version: run.version,
        traceId: run.traceId,
        updatedAt: timestamp(),
        errors: [],
      },
    })
  } catch (error) {
    run.stage = 'error'
    pushTelemetry(run, 'run_albumen_error', 'albumen', { errorCode: String(error?.message || 'albumen_error') })
    res.status(500).json({ error: 'albumen_processing_error', detail: String(error?.message || error) })
  }
})

app.post('/api/run/:runId/graph', async (req, res) => {
  const run = ensureRun(req.params.runId, res)
  if (!run || run.error) return

  run.stage = 'graph'
  pushTelemetry(run, 'run_graph_started', 'graph', {})

  const graph = buildRunGraph(run)
  const graphNote = await mockLLM('graph_summary', {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    factCount: run.yolkFacts.length,
  })
  addLLMNote(run, 'graph', graphNote, { source: 'mock-llm-summary' })
  run.graph = graph
  run.version += 1
  run.updatedAt = Date.now()
  run.stage = 'graph'

  pushTelemetry(run, 'run_graph_ready', 'graph', { nodeCount: graph.nodes.length, edgeCount: graph.edges.length })

  res.json({
      runId: run.id,
      stage: run.stage,
      graph,
      llm: run.llmNotes?.[0],
      runState: {
      id: run.id,
      stage: run.stage,
      version: run.version,
      traceId: run.traceId,
      updatedAt: timestamp(),
      errors: [],
    },
  })
})

app.post('/api/run/:runId/music', async (req, res) => {
  const run = ensureRun(req.params.runId, res)
  if (!run || run.error) return

  const options = req.body || {}
  run.stage = 'music'
  pushTelemetry(run, 'run_music_started', 'music', { requestedAt: timestamp() })

  try {
    const llmPass = await mockLLM('music_prompt', {
      prompt: options.prompt,
      mood: options.mood,
      factsCount: run.yolkFacts.length,
      traceId: run.traceId,
    })

    const prompt =
      options.prompt ||
      `Instrumental music for a run where facts include: ${run.yolkFacts
        .map((f) => f.text)
        .slice(0, 10)
        .join('; ')}`

    let lyricSource = 'facts_to_lyrics_template'
    const generatedLyrics = await generateMiniMaxLyrics({
      prompt: llmPass.payloadPreview,
      seed: run.id,
      style: options.prompt || run.messageSeed,
      mood: options.mood,
    }).catch(() => null)
    if (generatedLyrics) {
      lyricSource = 'minimax_lyrics_generation'
    }

    const lyrics = generatedLyrics || buildSongLyricsFromFacts(run.yolkFacts, prompt, options.mood || 'playful')

    let artifact = null

    try {
      artifact = await generateMiniMaxTrack(
        run,
        {
          prompt,
          mood: options.mood || 'playful',
          lyrics,
          model: options.model,
          mockOnly: options.mockOnly,
        },
      )
      if (!artifact) {
        artifact = {
          id: crypto.randomUUID(),
          runId: run.id,
          trackUrl: fallbackTone(req, run),
          format: 'audio/wav',
          durationMs: 8000,
          waveformSummary: ['mock-tone', 'no-network-playback'],
          audioProvider: 'mock',
          createdAt: Date.now(),
          providerMeta: {
            reason: 'minimax_not_configured_or_disabled',
            host: MINIMAX_API_HOST,
          },
        }
      }
    } catch (error) {
      artifact = {
        id: crypto.randomUUID(),
        runId: run.id,
        trackUrl: fallbackTone(req, run),
        format: 'audio/wav',
        durationMs: 8000,
        waveformSummary: ['mock-tone', 'fallback_after_error'],
        audioProvider: 'mock',
        createdAt: Date.now(),
        providerMeta: {
          reason: String(error?.message || 'unknown_error'),
          host: MINIMAX_API_HOST,
        },
      }
      pushTelemetry(run, 'run_music_fallback', 'music', { reason: artifact.providerMeta.reason })
    }

    const artifactLyrics = lyrics || run.yolkFacts.map((fact) => `• ${fact.text}`).join('\n')

    run.songArtifact = {
      ...artifact,
      lyrics: artifactLyrics,
      style: options.prompt || 'upbeat instrumentals',
      mood: options.mood || 'playful',
      providerMeta: {
        ...(artifact.providerMeta || {}),
        lyricSource,
      },
    }

    run.version += 1
    run.updatedAt = Date.now()
    run.stage = 'music'
    addLLMNote(run, 'music', llmPass, { source: 'mock-llm' })

    pushTelemetry(run, 'run_music_ready', 'music', {
      artifactId: run.songArtifact.id,
      provider: run.songArtifact.audioProvider,
      durationMs: run.songArtifact.durationMs,
    })

    res.json({
      runId: run.id,
      stage: run.stage,
      songArtifact: run.songArtifact,
      llm: run.llmNotes?.[0],
      lyricSource,
      runState: {
        id: run.id,
        stage: run.stage,
        version: run.version,
        traceId: run.traceId,
        updatedAt: timestamp(),
        errors: [],
      },
    })
  } catch (error) {
    run.stage = 'error'
    pushTelemetry(run, 'run_music_error', 'music', { errorCode: String(error?.message || 'music_error') })
    res.status(500).json({ error: 'music_generation_error', detail: String(error?.message || error) })
  }
})

app.get('/api/run/:runId/debug', (req, res) => {
  const run = runs.get(req.params.runId)
  if (!run) {
    return res.status(404).json({ error: 'run_not_found' })
  }

  res.json({
    runId: run.id,
    stage: run.stage,
    telemetry: run.telemetry.slice(0, 40),
    version: run.version,
    traceId: run.traceId,
    updatedAt: timestamp(),
  })
})

app.get('/api/run/:runId/export', (req, res) => {
  const run = runs.get(req.params.runId)
  if (!run) {
    return res.status(404).json({ error: 'run_not_found' })
  }

  res.json({
    runId: run.id,
    traceId: run.traceId,
    stage: run.stage,
    createdAt: toISO(run.createdAt),
    updatedAt: toISO(run.updatedAt),
    messages: run.messages,
    facts: run.yolkFacts,
    passes: run.albumenPasses,
    graph: run.graph,
    songArtifact: run.songArtifact,
    version: run.version,
    llmNotes: run.llmNotes || [],
  })
})

app.get('/api/fallback/audio', (req, res) => {
  const freq = parseIntSafe(req.query.freq, 280, 120, 700)
  const duration = parseIntSafe(req.query.duration, 8, 1, 20)
  const wav = buildFallbackWavBuffer({ frequency: freq, durationSec: duration })
  res.setHeader('Content-Type', 'audio/wav')
  res.setHeader('Cache-Control', 'no-store')
  res.send(wav)
})

app.get('/api/status', (_req, res) => {
  res.json({ ok: true, runs: runs.size })
})

const server = app.listen(PORT, () => {
  console.log(`Lyrebird mock API running: http://localhost:${PORT}`)
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Mock API port ${PORT} is in use. Start with MOCK_SERVER_PORT=<free port> or stop the existing process first.`)
    process.exit(1)
  }

  throw error
})
