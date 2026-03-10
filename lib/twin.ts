import { SpotifyData } from '@/lib/types'

const TWIN_API_BASE = 'https://api.twin.so/v1'
const TWIN_API_KEY = process.env.TWIN_API_KEY
const SPOTIFY_AGENT_ID = process.env.TWIN_SPOTIFY_AGENT_ID

const ensureTwinEnv = (): void => {
  if (!TWIN_API_KEY || !SPOTIFY_AGENT_ID) {
    throw new Error('Missing Twin API credentials in environment variables')
  }
}

export async function triggerSpotifyRun(spotifyUrl: string): Promise<string> {
  ensureTwinEnv()

  const res = await fetch(`${TWIN_API_BASE}/agents/${SPOTIFY_AGENT_ID}/runs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TWIN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      goal: `Scrape Spotify artist data for ${spotifyUrl} and return monthly listeners, top tracks with stream counts, total catalog streams, and catalog valuation using 8x/12x/18x multiples.`,
    }),
  })

  if (!res.ok) {
    throw new Error(`Failed to trigger run: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as { run_id?: string; id?: string }
  const runId = data.run_id ?? data.id

  if (!runId) {
    throw new Error('Twin run response did not include a run ID')
  }

  return runId
}


const parseJsonString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const digitsOnly = value.replace(/[$,\s]/g, '')
    const parsed = Number(digitsOnly)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const isSpotifyData = (value: unknown): value is SpotifyData => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SpotifyData>

  return (
    typeof candidate.monthly_listeners === 'number' &&
    typeof candidate.total_streams === 'number' &&
    Array.isArray(candidate.top_tracks) &&
    typeof candidate.valuation_base === 'number' &&
    typeof candidate.valuation_conservative === 'number' &&
    typeof candidate.valuation_optimistic === 'number'
  )
}

const coerceSpotifyData = (value: unknown): SpotifyData | undefined => {
  if (!value || typeof value !== 'object') return undefined

  const record = value as Record<string, unknown>
  const monthlyListeners = parseNumeric(record.monthly_listeners)
  const totalStreams = parseNumeric(record.total_streams)
  const valuationConservative = parseNumeric(record.valuation_conservative)
  const valuationBase = parseNumeric(record.valuation_base)
  const valuationOptimistic = parseNumeric(record.valuation_optimistic)

  if (
    monthlyListeners === null ||
    totalStreams === null ||
    valuationConservative === null ||
    valuationBase === null ||
    valuationOptimistic === null
  ) {
    return undefined
  }

  const topTracksRaw = Array.isArray(record.top_tracks) ? record.top_tracks : []
  const catalogReleasesRaw = Array.isArray(record.catalog_releases) ? record.catalog_releases : []

  return {
    monthly_listeners: monthlyListeners,
    total_streams: totalStreams,
    top_tracks: topTracksRaw
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const track = item as Record<string, unknown>
        const streams = parseNumeric(track.streams)
        const position = parseNumeric(track.position)
        if (streams === null) return null

        return {
          name: typeof track.name === 'string' ? track.name : `Track ${index + 1}`,
          streams,
          position: position ?? index + 1,
        }
      })
      .filter((track): track is SpotifyData['top_tracks'][number] => track !== null),
    catalog_releases: catalogReleasesRaw
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const release = item as Record<string, unknown>
        return {
          name: typeof release.name === 'string' ? release.name : 'Unknown release',
          type: typeof release.type === 'string' ? release.type : 'unknown',
          release_date:
            typeof release.release_date === 'string' ? release.release_date : 'unknown',
          total_tracks: parseNumeric(release.total_tracks) ?? undefined,
        }
      })
      .filter((release): release is SpotifyData['catalog_releases'][number] => release !== null),
    valuation_conservative: valuationConservative,
    valuation_base: valuationBase,
    valuation_optimistic: valuationOptimistic,
    captured_at: new Date().toISOString(),
  }
}

export interface TwinRun {
  run_id: string
  status: 'started' | 'running' | 'completed' | 'failed'
  outcome?: 'SUCCESS' | 'PARTIAL' | 'FAIL'
  summary?: string
  result?: SpotifyData
}

export async function getRun(runId: string): Promise<TwinRun> {
  ensureTwinEnv()

  const res = await fetch(`${TWIN_API_BASE}/runs/${runId}`, {
    headers: {
      Authorization: `Bearer ${TWIN_API_KEY}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to get run: ${res.status} ${res.statusText}`)
  }

  const raw = (await res.json()) as Record<string, unknown>

  const rawResult = parseJsonString(raw.result ?? raw.output ?? raw.data)
  const parsedResult =
    (isSpotifyData(rawResult) ? rawResult : undefined) ??
    coerceSpotifyData(rawResult) ??
    coerceSpotifyData(parseJsonString(raw.summary))

  return {
    run_id: (raw.run_id as string) ?? (raw.id as string) ?? runId,
    status: (raw.status as TwinRun['status']) ?? 'running',
    outcome: raw.outcome as TwinRun['outcome'] | undefined,
    summary: typeof raw.summary === 'string' ? raw.summary : undefined,
    result: parsedResult,
  }
}
