import { NextRequest, NextResponse } from 'next/server'
import { triggerSpotifyRun } from '@/lib/twin'

export const runtime = 'edge'

const ARTIST_SPOTIFY_URLS: Record<string, string> = {
  sza: 'https://open.spotify.com/artist/3tVQdUvClmAT7URs9V3rsp',
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  const spotifyUrl = ARTIST_SPOTIFY_URLS[params.slug]

  if (!spotifyUrl) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  try {
    const runId = await triggerSpotifyRun(spotifyUrl)
    return NextResponse.json({ run_id: runId, status: 'started' })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
