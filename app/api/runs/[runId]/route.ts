import { NextRequest, NextResponse } from 'next/server'
import { getRun } from '@/lib/twin'

export const runtime = 'edge'

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } },
): Promise<NextResponse> {
  try {
    const run = await getRun(params.runId)
    return NextResponse.json(run)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
