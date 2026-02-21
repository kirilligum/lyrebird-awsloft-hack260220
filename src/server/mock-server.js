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
const MINIMAX_REQUEST_TIMEOUT_MS = Number(process.env.MINIMAX_REQUEST_TIMEOUT_MS || '12000')
const DEFAULT_MOCK_TOKEN = 'mock'
const DISCORD_FIXTURE_PATH = path.resolve(process.cwd(), 'src', 'data', 'simulated-discord-log.json')
const DEMO_PLANS_DIR = path.resolve(process.cwd(), 'plans')
const DEMO_PLAN_ARTIFACTS_DIR = path.resolve(DEMO_PLANS_DIR, 'artifacts')
const MAX_SIMULATED_MESSAGES = 360
const DEFAULT_YOLK_FACT_LIMIT = 5
const MAX_YOLK_FACT_LIMIT = 20
const MUSIC_PLACEHOLDER_TRACK_FILE = 'music_prod_tts-20260221103606-udrEprgbjcAeqNKa.mp3'

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

const MUSIC_VARIANT_IDS = {
  POP_WITH_LYRICS: 'pop-with-lyrics',
  DARK_TECHNO_7_FACTS: 'dark-techno-7facts',
  DARK_TECHNO: 'dark-techno',
  INSTRUMENTAL: 'pop-instrumental',
  NO_TTS: 'pop-no-tts',
}

const DEMO_PACKS = {
  'discord-chat-hackathon-aws-lof': {
    id: 'discord-chat-hackathon-aws-lof',
    messages: 'discord-chat-hackathon-aws-lof.json',
    rawFacts: 'discord-chat-hackathon-aws-lof-facts.json',
    findFacts: 'discord-chat-hackathon-aws-lof-find-facts.json',
    replaceFacts: 'discord-chat-hackathon-aws-lof-replace-facts.json',
    finalGraphMusic: 'discord-chat-hackathon-aws-lof-final-graph-music.json',
    minimaxRequest: 'minimax-pop-song-with-lyrics-request.json',
    minimaxResponse: 'minimax-pop-song-with-lyrics-response.json',
    minimaxCallArtifact: 'minimax-pop-song-with-lyrics-call-artifact.json',
    minimaxExport: 'minimax-pop-song-with-lyrics-export.json',
    localArtifact: 'artifacts/minimax-pop-song-with-lyrics.mp3',
    placeholderMusicArtifact: `artifacts/${MUSIC_PLACEHOLDER_TRACK_FILE}`,
    placeholderFiles: [
      'discord-chat-hackathon-aws-lof.json',
      'discord-chat-hackathon-aws-lof-facts.json',
      'discord-chat-hackathon-aws-lof-find-facts.json',
      'discord-chat-hackathon-aws-lof-replace-facts.json',
      'discord-chat-hackathon-aws-lof-final-graph-music.json',
      'minimax-dark-techno-response.json',
      'minimax-dark-techno-lyrics-call-summary.json',
      'minimax-pop-song-with-lyrics-request.json',
      'minimax-pop-song-with-lyrics-response.json',
      'minimax-pop-song-with-lyrics-response-headers.txt',
      'minimax-pop-song-with-lyrics-call-artifact.json',
      'minimax-pop-song-with-lyrics-export.json',
      'minimax-dark-techno-lyrics-request-final-7facts.json',
      'minimax-dark-techno-lyrics-request.json',
      'minimax-dark-techno-lyrics-response.json',
      'minimax-dark-techno-response-headers.txt',
      'minimax-dark-techno-call-artifact.json',
      'minimax-pop-song-request-no-tts.json',
      'minimax-pop-song-request-instrumental.json',
      'minimax-pop-song-instrumental-response.json',
      'minimax-pop-song-instrumental-response-headers.txt',
      'minimax-pop-instrumental-call-artifact.json',
      'minimax-pop-song-response.json',
      'minimax-pop-song-response-headers.txt',
      'front-end-music-iteration-plan.md',
      'artifacts/minimax-pop-song-with-lyrics.mp3',
      `artifacts/${MUSIC_PLACEHOLDER_TRACK_FILE}`,
    ],
    musicVariants: {
      [MUSIC_VARIANT_IDS.POP_WITH_LYRICS]: {
        id: MUSIC_VARIANT_IDS.POP_WITH_LYRICS,
        label: 'Pop with lyrics',
        requestFile: 'minimax-pop-song-with-lyrics-request.json',
        responseFile: 'minimax-pop-song-with-lyrics-response.json',
        responseHeadersFile: 'minimax-pop-song-with-lyrics-response-headers.txt',
        callArtifactFile: 'minimax-pop-song-with-lyrics-call-artifact.json',
        exportFile: 'minimax-pop-song-with-lyrics-export.json',
      },
      [MUSIC_VARIANT_IDS.DARK_TECHNO_7_FACTS]: {
        id: MUSIC_VARIANT_IDS.DARK_TECHNO_7_FACTS,
        label: 'Dark techno (7-fact lyrics)',
        requestFile: 'minimax-dark-techno-lyrics-request-final-7facts.json',
        responseFile: 'minimax-dark-techno-response.json',
        responseHeadersFile: 'minimax-dark-techno-response-headers.txt',
        callArtifactFile: 'minimax-dark-techno-call-artifact.json',
      },
      [MUSIC_VARIANT_IDS.DARK_TECHNO]: {
        id: MUSIC_VARIANT_IDS.DARK_TECHNO,
        label: 'Dark techno',
        requestFile: 'minimax-dark-techno-lyrics-request.json',
        responseFile: 'minimax-dark-techno-response.json',
        responseHeadersFile: 'minimax-dark-techno-response-headers.txt',
        callArtifactFile: 'minimax-dark-techno-call-artifact.json',
      },
      [MUSIC_VARIANT_IDS.INSTRUMENTAL]: {
        id: MUSIC_VARIANT_IDS.INSTRUMENTAL,
        label: 'Pop instrumental',
        requestFile: 'minimax-pop-song-request-instrumental.json',
        responseFile: 'minimax-pop-song-instrumental-response.json',
        responseHeadersFile: 'minimax-pop-song-instrumental-response-headers.txt',
        callArtifactFile: 'minimax-pop-instrumental-call-artifact.json',
      },
      [MUSIC_VARIANT_IDS.NO_TTS]: {
        id: MUSIC_VARIANT_IDS.NO_TTS,
        label: 'Pop no TTS',
        requestFile: 'minimax-pop-song-request-no-tts.json',
        responseFile: 'minimax-pop-song-response.json',
        responseHeadersFile: 'minimax-pop-song-response-headers.txt',
      },
    },
  },
}

function readJsonPlanFile(filePath) {
  try {
    const raw = fs.readFileSync(path.join(DEMO_PLANS_DIR, filePath), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed
  } catch (error) {
    console.error(`Unable to read demo pack file ${filePath}:`, error.message)
    return null
  }
}

function isSupportedPack(packId) {
  return Boolean(DEMO_PACKS[packId] && Number.isInteger(Object.keys(DEMO_PACKS[packId]).length))
}

function readTextPlanFile(filePath) {
  try {
    return fs.readFileSync(path.join(DEMO_PLANS_DIR, filePath), 'utf8')
  } catch (error) {
    console.error(`Unable to read placeholder text file ${filePath}:`, error.message)
    return null
  }
}

function resolvePlanArtifact(fileName) {
  if (!/^[A-Za-z0-9._-]+\.mp3$/i.test(fileName)) {
    return null
  }
  return path.join(DEMO_PLAN_ARTIFACTS_DIR, fileName)
}

function normalizePackMessages(messages = []) {
  return messages
    .filter((message) => message && typeof message === 'object')
    .map((message, index) => ({
      id: String(message.id || `pack-msg-${index + 1}`),
      author: String(message.author || 'speaker').trim(),
      timestamp: message.timestamp ? toISO(Date.parse(message.timestamp)) : toISO(Date.now()),
      content: String(message.content || '').trim(),
      channel: String(message.channel || 'discord').trim(),
      threadId: String(message.threadId || `discord-chat-hackathon-aws-lof-thread-${index + 1}`).trim(),
      isSynthetic: message.isSynthetic !== false,
    }))
}

function normalizePackFacts(facts = []) {
  return facts
    .filter((fact) => fact && typeof fact === 'object' && String(fact.text || '').trim())
    .map((fact) => {
      const base = {
        id: String(fact.id || crypto.randomUUID()),
        text: String(fact.text).trim(),
        confidence: Number(fact.confidence ?? 0.93),
        provenance: {
          runId: String(fact.provenance?.runId || ''),
          sourceMessageIds: Array.isArray(fact.provenance?.sourceMessageIds)
            ? fact.provenance.sourceMessageIds.slice(0, 8)
            : [],
          excerpts: Array.isArray(fact.provenance?.excerpts) ? fact.provenance.excerpts : [],
          passVersion: Number(fact.provenance?.passVersion || 1),
        },
        status: fact.status || 'pending',
        version: Number(fact.version || 1),
        rationale: String(fact.rationale || 'Loaded from curated placeholder pack.'),
      }

      if (fact.appliedDiffs) {
        base.appliedDiffs = Array.isArray(fact.appliedDiffs)
          ? fact.appliedDiffs
              .filter((diff) => diff && typeof diff === 'object')
              .map((diff) => ({
                before: String(diff.before || ''),
                after: String(diff.after || ''),
              }))
          : []
      }

      return base
    })
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

function normalizePlaceholderFindResults(items = []) {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => {
      const normalizedText = String(item.text || '').trim()
      const factId = String(item.factId || item.id || `placeholder-find-${index + 1}`)
      const sourceMessageIds = Array.isArray(item.sourceMessageIds) ? item.sourceMessageIds.slice(0, 6) : []
      return {
        id: factId,
        text: normalizedText || 'Matched factual snippet.',
        confidence: 0.99,
        provenance: {
          runId: String(item.runId || 'demo-pack-placeholder'),
          sourceMessageIds,
          passVersion: 1,
        },
        status: 'pending',
        version: 1,
        rationale:
          String(item.rationale || item.source || 'Placeholder fact from curated sponsor find output.'),
      }
    })
}

function normalizePlaceholderReplaceResults(items = []) {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => {
      const sourceText = String(item.before || item.text || item.find || '').trim()
      const resultText = String(item.result || item.after || '').trim()
      const factId = String(item.factId || item.id || `placeholder-replace-${index + 1}`)
      const sourceMessageIds = Array.isArray(item.sourceMessageIds) ? item.sourceMessageIds.slice(0, 6) : []
      return {
        id: factId,
        text: resultText || `Updated fact from placeholder replace output ${index + 1}.`,
        confidence: 0.99,
        provenance: {
          runId: String(item.runId || 'demo-pack-placeholder'),
          sourceMessageIds,
          passVersion: 2,
        },
        status: 'pending',
        version: 2,
        rationale:
          String(
            item.rationale
              || `Placeholder replace output from curated run. Before: ${sourceText}. Replace: ${String(item.replace || 'n/a')}`,
          ),
      }
    })
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

function ensureSponsorFactSeed(messages, seed, targetCount) {
  const current = Array.isArray(messages) ? [...messages] : []
  const hasSponsor = current.some((message) => /sponsors?/i.test(message?.content || ''))
  if (hasSponsor) {
    return current
  }

  const rng = makeRng(`${seed}-sponsor-inject`)
  const author = pick(authors, rng)
  const channel = pick(channels, rng)
  const minutes = Math.floor(rng() * 20)
  const sponsorMessage = {
    id: crypto.randomUUID(),
    author,
    timestamp: toISO(Date.now() - (current.length + 1) * 42000 - Math.floor(rng() * 12000)),
    content: `${author.toLowerCase()} coordinated sponsor onboarding after ${minutes} minutes.`,
    channel,
    threadId: `${slugify(author)}-${slugify(seed)}-sponsor-${current.length + 1}`,
    isSynthetic: true,
  }

  const withSponsor = current.concat(sponsorMessage)
  if (withSponsor.length > targetCount) {
    withSponsor[targetCount - 1] = sponsorMessage
    return withSponsor.slice(0, targetCount)
  }

  return withSponsor
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
    return ensureSponsorFactSeed(fixtureMessages.concat(fill), seed, count)
  }

  return ensureSponsorFactSeed(fixtureMessages, seed, count)
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
      profile: payload.profile,
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

function inferDemoMusicMood(prompt) {
  const normalized = String(prompt || '').toLowerCase()
  if (normalized.includes('dark techno') || normalized.includes('techno')) {
    return 'dark techno'
  }
  if (normalized.includes('instrumental')) {
    return 'instrumental'
  }
  return 'playful'
}

function buildDemoSongArtifact(run, packConfig, exportPayload, responsePayload, packId, musicVariant) {
  const localTrackUrl = `/api/packs/${packId}/artifacts/minimax-pop-song-with-lyrics.mp3`
  const remoteAudio = responsePayload?.data?.audio || exportPayload?.tracks?.remote?.audio || null
  const durationMs = Number(
    responsePayload?.extra_info?.music_duration
    || exportPayload?.tracks?.remote?.extraInfo?.musicDurationMs
    || 66115,
  )
  const prompt = String(exportPayload?.prompt || responsePayload?.prompt || '')
  const style = String(exportPayload?.style || 'pop with vocals')
  const lyrics = String(exportPayload?.lyrics || '')
  return {
    id: crypto.randomUUID(),
    runId: run.id,
    trackUrl: localTrackUrl,
    format: 'audio/mpeg',
    durationMs,
    waveformSummary: ['minimax-demo', 'placeholder-artifact'],
    audioProvider: 'minimax',
    createdAt: Date.now(),
    providerMeta: {
      host: MINIMAX_API_HOST,
      source: musicVariant?.exportFile || packConfig.minimaxExport,
      remoteAudio,
      rawModel: exportPayload?.model || 'music-2.5',
      lyricSource: lyrics ? 'plan_lyrics' : 'prompt',
    },
    lyrics: lyrics || null,
    style,
    mood: inferDemoMusicMood(prompt),
  }
}

function pickMusicVariant(packConfig, requestedVariant) {
  const requested = packConfig.musicVariants?.[requestedVariant]
  if (requested) {
    return {
      id: requested.id,
      ...requested,
    }
  }

  return {
    id: MUSIC_VARIANT_IDS.POP_WITH_LYRICS,
    ...packConfig.musicVariants[MUSIC_VARIANT_IDS.POP_WITH_LYRICS],
  }
}

function buildDemoPackRun(packId, options = {}) {
  if (!isSupportedPack(packId)) {
    return null
  }

  const packConfig = DEMO_PACKS[packId]
  const selectedVariant = pickMusicVariant(packConfig, options.musicVariant)
  const messagePack = readJsonPlanFile(packConfig.messages)
  const factsPack = readJsonPlanFile(packConfig.rawFacts)
  const findPack = readJsonPlanFile(packConfig.findFacts)
  const replacePack = readJsonPlanFile(packConfig.replaceFacts)
  const finalPack = readJsonPlanFile(packConfig.finalGraphMusic)
  const minimaxRequest = readJsonPlanFile(selectedVariant.requestFile)
  const minimaxResponse = readJsonPlanFile(selectedVariant.responseFile)
  const minimaxExport = readJsonPlanFile(selectedVariant.exportFile)

  if (!messagePack || !factsPack) {
    return null
  }

  const runId = `${packId}-${Date.now()}`
  const messages = normalizePackMessages(messagePack.messages || [])
  const rawFacts = normalizePackFacts(factsPack.facts || [])
  const seededFacts = rawFacts.slice(0, MAX_YOLK_FACT_LIMIT).map((fact, index) => ({
    ...fact,
    id: fact.id || `fact-${index + 1}`,
    provenance: {
      ...fact.provenance,
      runId,
    },
    status: fact.status || 'pending',
    version: fact.version || 1,
  }))
  const run = createRunRecord(runId, {
    mode: 'seeded',
    seed: packId,
    profile: `AWS Hackathon Presenter — CEO ${factsPack.source === 'plans/discord-chat-hackathon-aws-lof.json' ? 'Desk Team' : 'Event Lead'}`,
    messageCount: messages.length,
    transcript: '',
    promptHint: `Demo pack loaded from ${packId}`,
  })

  const resolvedMood = inferDemoMusicMood(minimaxRequest?.prompt || '')
  const resolvedPrompt = String(minimaxRequest?.prompt || 'Create a judge-ready pop track from extracted facts.')
  run.traceId = minimaxExport?.runId || minimaxRequest?.requestId || crypto.randomUUID()
  run.messages = messages
  run.options.mode = 'seeded'
  run.options.seed = packId
  run.options.profile = `AWS Hackathon Presenter — event narrative deck (pack: ${packId})`
  run.options.promptHint = `Demo pack loaded from ${packConfig.id}`
  run.options.includeTranscript = Boolean(messages.length)

  run.yolkFacts = seededFacts
  run.stage = 'yolk'
  run.version = 1
  run.updatedAt = Date.now()
  run.graph = buildRunGraph(run)
  run.songArtifact = buildDemoSongArtifact(run, packConfig, minimaxExport, minimaxResponse, packId, selectedVariant)
  run.albumenPasses = []
  run.llmNotes.unshift({
    task: 'demo_pack_load',
    model: 'mock-pipeline-loader',
    stage: 'egg',
    confidence: 0.99,
    rationale: 'Loaded pre-generated Hackathon placeholder data bundle for deterministic investor demo.',
    payloadPreview: `pack=${packId} source=${factsPack.id || packConfig.id}`,
    suggestions: ['Use this run as a deterministic baseline for judge demos.'],
    metadata: {
      source: 'demo-pack',
      latencyMs: 0,
      runId,
      traceId: run.traceId,
    },
    createdAt: timestamp(),
  })

  const passSeeds = {
    findSeed: Array.isArray(findPack?.items) && findPack.items[0] ? String(findPack.items[0].find || 'sponsor') : 'sponsor',
    replaceSeed:
      replacePack?.replaceInstructionPlaceholder
      || "add 'amazing' to each sponsor name",
  }
  const findPlaceholderOutputs = normalizePlaceholderFindResults(findPack?.items)
  const replacePlaceholderOutputs = normalizePlaceholderReplaceResults(replacePack?.items)

  return {
    run,
    runState: {
      id: run.id,
      stage: run.stage,
      version: run.version,
      traceId: run.traceId,
      updatedAt: timestamp(),
      errors: [],
    },
    messages,
    facts: run.yolkFacts,
    passes: run.albumenPasses,
    graph: run.graph,
    songArtifact: run.songArtifact,
    llmNotes: run.llmNotes,
    placeholders: {
      selectedMusicVariant: selectedVariant.id,
      variantList: Object.values(packConfig.musicVariants).map((variant) => ({
        id: variant.id,
        label: variant.label,
        requestFile: variant.requestFile,
        responseFile: variant.responseFile,
        responseHeadersFile: variant.responseHeadersFile,
        callArtifactFile: variant.callArtifactFile,
        exportFile: variant.exportFile,
      })),
      placeholderFiles: packConfig.placeholderFiles,
      rawFactsPath: packConfig.rawFacts,
      findFactsPath: packConfig.findFacts,
      replaceFactsPath: packConfig.replaceFacts,
      finalGraphMusicPath: packConfig.finalGraphMusic,
      musicPlaceholderTrackUrl: `/api/plans/artifacts/${String(packConfig.placeholderMusicArtifact || `artifacts/${MUSIC_PLACEHOLDER_TRACK_FILE}`).replace(
        /^artifacts\//,
        '',
      )}`,
      minimaxRequestPath: selectedVariant.requestFile,
      minimaxResponsePath: selectedVariant.responseFile,
      minimaxCallArtifactPath: selectedVariant.callArtifactFile,
      minimaxExportPath: selectedVariant.exportFile || null,
      minimaxResponseHeadersPath: selectedVariant.responseHeadersFile,
      placeholderFindOutputs: findPlaceholderOutputs,
      placeholderReplaceOutputs: replacePlaceholderOutputs,
      findSeed: passSeeds.findSeed,
      replaceSeed: passSeeds.replaceSeed,
      musicPrompt: resolvedPrompt,
      musicMood: resolvedMood,
      responseHeadersAvailable: Boolean(selectedVariant.responseHeadersFile),
    },
    finalBundle: finalPack || null,
  }
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
  const cleaned = facts.slice(0, 18)
  const safePrompt = clampText(String(prompt || 'a realistic hackathon operation report'), 120)
  const safeMood = clampText(String(mood || 'playful'), 80)
  const factsSection = cleaned.length
    ? cleaned.map((fact, index) => `${index + 1}. ${fact.text}`)
    : ['No extracted fact artifacts were available for this run.']

  const hook = [
    '[Intro]',
    `[Verse 1]`,
    `${safePrompt} moved the run from data noise to reliable outputs.`,
    `A ${safeMood} tempo keeps the cycle readable.`,
    `Confidence stayed transparent through every transformation pass.`,
    'We pulled signal from the log, then turned it into structure.',
    ...factsSection.slice(0, 4).map((line) => `- ${line}`),
  ]

  const verse = [
    '[Verse 2]',
    `The audit lane stayed open while facts kept their provenance tags.`,
    `Messages mapped to claims, and claims mapped to checks.`,
    `Graph edges carried evidence for each decision the team made.`,
    ...factsSection.slice(4, 10).map((line) => `- ${line}`),
  ]

  const preChorus = [
    '[Pre-Chorus]',
    'If a pass changed a fact, the trace preserved every diff.',
    'Albumen rules rewrote with intent, not entropy.',
    'If risk appeared, we flagged it and moved it to the next lane.',
  ]

  const chorus = [
    '[Bridge]',
    `At ${safeMood} tempo, the board stayed aligned,`,
    'Evidence passed checks and confidence stayed high.',
    `From ${factsSection.length} extracted threads, ${Math.min(factsSection.length, 6)} were locked for music.`,
  ]

  const chorusDrop = [
    '[Chorus]',
    'Keep the signal high and keep the context clear.',
    'Every message maps to a trace you can review.',
    'Graph edges explain what changed and why.',
    'The stage flow stays explainable all the way to the drop.',
  ]

  const outro = [
    '[Outro]',
    `From seed to song, ${factsSection.length} milestones mapped and verified.`,
    `Final mood: ${safeMood}.`,
    'This is production-shaped confidence in a beat.',
    'If the data is good, the output sounds good.',
  ]

  const instrumental = [
    '[Instrumental]',
    'Layered synth, crisp snare, and rounded sub bass rise.',
    'Crowd noise fades, bassline moves, tempo stays controlled.',
    `Prompt context: ${safePrompt} with ${Math.min(factsSection.length, 6)} highlighted checkpoints.`,
  ]

  return [...hook, '', ...preChorus, '', ...verse, '', ...chorus, '', ...chorusDrop, '', ...instrumental, '', ...outro].join('\n').slice(0, 3500)
}

function scoreToConfidence(score) {
  const normalized = Number(((score % 100) / 100).toFixed(2))
  return Number(Math.max(0.61, Math.min(0.98, 0.61 + normalized * 0.37)).toFixed(2))
}

function buildFactFromMessage(message, existingFacts = new Set(), version = 1) {
  const clean = message.content.toLowerCase()
  const sourceKey = `${message.author}:${message.channel}:${clean.slice(0, 90)}`
  const topic = clean.includes('sponsor')
    ? `${message.author} identified sponsor-related context in ${message.channel}.`
    : clean.includes('deploy')
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

async function extractFactsFromMessages(messages, version = 1, factLimit = DEFAULT_YOLK_FACT_LIMIT) {
  const llmPass = await mockLLM('fact_extraction', {
    messageCount: messages.length,
    sample: messages.slice(0, 4).map((message) => message.content).join(' '),
  })

  const facts = []
  const seen = new Set()
  const safeFactLimit = parseIntSafe(factLimit, DEFAULT_YOLK_FACT_LIMIT, 1, MAX_YOLK_FACT_LIMIT)

  for (const message of messages) {
    if (facts.length >= safeFactLimit) {
      break
    }
    const fact = buildFactFromMessage(message, seen, version)

    if (!fact) {
      continue
    }

    fact.rationale = `${llmPass.rationale} ${fact.rationale}`
    fact.confidence = Number(Math.min(0.99, fact.confidence + 0.03).toFixed(2))
    facts.push(fact)
  }

  const mentionsSponsor = messages.some((message) => /sponsors?/i.test(message.content || ''))
  const hasSponsorFact = facts.some((fact) => /sponsor/i.test(fact.text))
  if (mentionsSponsor && !hasSponsorFact) {
    facts.unshift({
      id: crypto.randomUUID(),
      text: 'A team discussion included sponsor planning and partnership language.',
      confidence: llmPass.confidence,
      provenance: {
        runId: '',
        sourceMessageIds: messages
          .filter((message) => /sponsors?/i.test(message.content || ''))
          .slice(0, 2)
          .map((message) => message.id),
        excerpts: ['Synthetic sponsor evidence injected from chat context.'],
      },
      status: 'pending',
      version,
      rationale: `${llmPass.rationale} Sponsor-aligned fact inserted for traceability.`,
    })
  }

  if (facts.length > safeFactLimit) {
    facts.length = safeFactLimit
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
  const applyReplaceInstruction = (text, find, replaceInstruction) => {
    const token = String(find || '').trim()
    const instruction = String(replaceInstruction || '').trim()
    if (!token) return text
    if (!instruction) return text

    const lowerInstruction = instruction.toLowerCase()
    const sponsorAddMatch = lowerInstruction.match(/add\s+['"]([^'"]+)['"]\s+to\s+each\s+(.+?)\s*(name)?/i)
    if (sponsorAddMatch && token.toLowerCase().includes('sponsor')) {
      const insertion = sponsorAddMatch[1] ? sponsorAddMatch[1].trim() : 'amazing'
      const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const tokenRegex = new RegExp(`\\b${escapedToken}s?\\b`, 'gi')
      return text.replace(tokenRegex, (match) => `${match} "${insertion}"`)
    }

    const replaceClauseMatch = lowerInstruction.match(/replace\s+['"]([^'"]+)['"]\s+with\s+['"]([^'"]+)['"]/i)
    if (replaceClauseMatch) {
      const source = replaceClauseMatch[1].trim()
      const target = replaceClauseMatch[2].trim()
      const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return text.replace(new RegExp(escapedSource, 'gi'), target)
    }

    const addToMatch = lowerInstruction.match(/add\s+['"]([^'"]+)['"]\s+(?:to|at)\s+each\b/i)
    if (addToMatch) {
      const insertion = addToMatch[1].trim()
      return `${text} (${insertion})`
    }

    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const replacement = instruction || '[filtered]'
    return text.replace(new RegExp(escaped, 'gi'), replacement)
  }

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
        text = applyReplaceInstruction(text, rule.find, rule.replace)
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
  const factNodes = (Array.isArray(run.yolkFacts) ? run.yolkFacts : []).slice(0, 5)

  const profileLabel = clampText(
    `Profile: ${run.options?.profile || 'No profile provided.'}`,
    60,
  )
  const contextSource = run.options?.transcript
    ? run.options.transcript
    : run.options?.promptHint
      ? run.options.promptHint
      : run.messageSeed || 'seeded run context'
  const contextLabel = clampText(`Context: ${contextSource}`, 100)
  const profileNodeId = `profile:${run.id}`
  const contextNodeId = `context:${run.id}`

  nodes.push({ id: profileNodeId, label: profileLabel, type: 'profile', category: 'input', source: 'run.profile' })
  nodes.push({
    id: contextNodeId,
    label: contextLabel,
    type: 'context',
    category: 'input',
    source: run.options?.includeTranscript ? 'transcript' : 'promptHint',
  })
  edges.push({ from: profileNodeId, to: contextNodeId, relation: 'provides_context' })

  factNodes.forEach((fact, index) => {
    nodes.push({ id: `fact:${fact.id}`, label: `Fact ${index + 1}`, type: 'fact', status: fact.status, confidence: fact.confidence })
    edges.push({ from: contextNodeId, to: `fact:${fact.id}`, relation: 'derived_from_context' })
  })

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

  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

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

  const json = await callMiniMax(
    endpoint,
    payload,
    requestHeaders,
    Math.max(3000, Math.round(MINIMAX_REQUEST_TIMEOUT_MS * 0.6)),
  )
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

  const json = await callMiniMax(
    endpoint,
    payload,
    requestHeaders,
    Math.max(6000, Math.round(MINIMAX_REQUEST_TIMEOUT_MS * 0.9)),
  )
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

app.get('/api/packs', (_req, res) => {
  res.json({
    packs: Object.keys(DEMO_PACKS).map((packId) => ({
      id: packId,
      name: packId,
    })),
  })
})

app.get('/api/plans/artifacts/:artifactFile', (req, res) => {
  const artifactFile = req.params.artifactFile
  const artifactPath = resolvePlanArtifact(artifactFile)
  if (!artifactPath) {
    return res.status(400).json({ error: 'invalid_artifact_file' })
  }

  const absolutePath = path.resolve(artifactPath)
  if (!absolutePath.startsWith(DEMO_PLAN_ARTIFACTS_DIR)) {
    return res.status(400).json({ error: 'invalid_artifact_file' })
  }

  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'artifact_file_missing' })
  }

  res.setHeader('Content-Type', 'audio/mpeg')
  res.sendFile(absolutePath)
})

app.post('/api/packs/:packId/load', (req, res) => {
  const packId = req.params.packId
  const requestedVariant = typeof req.body?.musicVariant === 'string' ? req.body.musicVariant : undefined
  const loaded = buildDemoPackRun(packId, { musicVariant: requestedVariant })

  if (!loaded || !loaded.run) {
    return res.status(404).json({ error: 'pack_not_found', packId })
  }

  loaded.run.options.tracePack = packId
  runs.set(loaded.run.id, loaded.run)
  pushTelemetry(loaded.run, 'run_pack_loaded', 'yolk', {
    packId,
    source: 'placeholder_pack',
    factCount: loaded.facts.length,
  })

  res.json({
    packId,
    runId: loaded.run.id,
    runState: loaded.runState,
    messages: loaded.messages,
    facts: loaded.facts,
    passes: loaded.passes,
    graph: loaded.graph,
    songArtifact: loaded.songArtifact,
    llmNotes: loaded.llmNotes,
    placeholders: loaded.placeholders,
  })
})

app.get('/api/packs/:packId/artifacts/:artifactFile', (req, res) => {
  const packId = req.params.packId
  const artifactFile = req.params.artifactFile

  if (!isSupportedPack(packId) || artifactFile !== 'minimax-pop-song-with-lyrics.mp3') {
    return res.status(404).json({ error: 'artifact_not_found' })
  }

  const packConfig = DEMO_PACKS[packId]
  const artifactPath = path.join(DEMO_PLANS_DIR, packConfig.localArtifact)
  if (!fs.existsSync(artifactPath)) {
    return res.status(404).json({ error: 'artifact_file_missing' })
  }

  res.setHeader('Content-Type', 'audio/mpeg')
  res.sendFile(artifactPath)
})

app.post('/api/run/egg', async (req, res) => {
  const mode = req.body?.mode || 'seeded'
  const profile = typeof req.body?.profile === 'string' && req.body.profile.trim() ? req.body.profile : ''
  const seed = req.body?.seed || `seed-${Math.floor(Math.random() * 1_000_000)}`
  const effectiveSeed = profile || seed
  const messageCount = parseIntSafe(req.body?.messageCount, 24, 1, MAX_SIMULATED_MESSAGES)
  const transcript = req.body?.transcript || ''
  const promptHint = req.body?.promptHint || ''

  const runId = crypto.randomUUID()
  const traceId = req.body?.traceId || crypto.randomUUID()

  const record = createRunRecord(runId, {
    mode,
    seed: effectiveSeed,
    profile,
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

    const factLimit = parseIntSafe(req.body?.factLimit, DEFAULT_YOLK_FACT_LIMIT, 1, MAX_YOLK_FACT_LIMIT)
    const { facts, llmPass } = await extractFactsFromMessages(run.messages, run.version, factLimit)
    const seededFacts = facts.map((fact) => ({ ...fact, provenance: { ...fact.provenance, runId: run.id } }))
    run.yolkFacts = seededFacts
    addLLMNote(run, 'yolk', llmPass, { source: 'mock-llm' })
    run.version += 1
    run.updatedAt = Date.now()
    run.stage = 'yolk'

    pushTelemetry(run, 'run_yolk_ready', 'yolk', {
      factCount: run.yolkFacts.length,
      factLimit,
    })

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
