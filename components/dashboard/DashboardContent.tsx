'use client'

import { useMemo, useState } from 'react'
import { RefreshStatus, SpotifyData } from '@/lib/types'

const fallbackData: SpotifyData = {
  monthly_listeners: 47500000,
  total_streams: 11600000000,
  top_tracks: [
    { name: 'Kill Bill', streams: 1800000000, position: 1 },
    { name: 'Snooze', streams: 1200000000, position: 2 },
    { name: 'Good Days', streams: 900000000, position: 3 },
  ],
  catalog_releases: [
    { name: 'SOS', type: 'Album', release_date: '2022-12-09', total_tracks: 23 },
    { name: 'Ctrl', type: 'Album', release_date: '2017-06-09', total_tracks: 14 },
  ],
  valuation_conservative: 160000000,
  valuation_base: 240000000,
  valuation_optimistic: 360000000,
  captured_at: new Date().toISOString(),
}

const fmt = (n: number): string => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const fmtMoney = (n: number): string => `$${(n / 1_000_000).toFixed(1)}M`

export default function DashboardContent(): JSX.Element {
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>('idle')
  const [spotifyData, setSpotifyData] = useState<SpotifyData | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<string>('Never')

  const activeData = useMemo(() => spotifyData ?? fallbackData, [spotifyData])

  const handleRefresh = async (): Promise<void> => {
    setRefreshStatus('loading')

    try {
      const res = await fetch('/api/artist/sza/refresh', { method: 'POST' })
      if (!res.ok) {
        setRefreshStatus('error')
        return
      }

      const payload = (await res.json()) as { run_id?: string }
      if (!payload.run_id) {
        setRefreshStatus('error')
        return
      }

      setRefreshStatus('polling')

      const poll = async (): Promise<void> => {
        const runRes = await fetch(`/api/runs/${payload.run_id}`)
        if (!runRes.ok) {
          setRefreshStatus('error')
          return
        }

        const run = (await runRes.json()) as {
          outcome?: 'SUCCESS' | 'PARTIAL' | 'FAIL'
          result?: SpotifyData
        }

        if (run.outcome === 'SUCCESS' && run.result) {
          setSpotifyData(run.result)
          setLastRefreshed(new Date().toLocaleTimeString())
          setRefreshStatus('success')
          return
        }

        if (run.outcome === 'FAIL') {
          setRefreshStatus('error')
          return
        }

        setTimeout(() => {
          void poll()
        }, 4000)
      }

      setTimeout(() => {
        void poll()
      }, 4000)
    } catch {
      setRefreshStatus('error')
    }
  }

  const buttonLabel: Record<RefreshStatus, string> = {
    idle: 'Refresh Data',
    loading: 'Starting...',
    polling: 'Fetching...',
    success: 'Refresh Data',
    error: 'Retry',
  }

  return (
    <main className="grid grid-cols-12 gap-6 p-6 text-white">
      <section className="col-span-9 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard title="Monthly Listeners" value={fmt(activeData.monthly_listeners)} />
          <StatCard title="All-Time Streams" value={fmt(activeData.total_streams)} />
          <StatCard title="Catalog Valuation" value={fmtMoney(activeData.valuation_base)} />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-4 text-lg font-semibold">Streaming</h2>
          <table className="w-full text-left">
            <thead className="text-xs uppercase text-white/60">
              <tr>
                <th>#</th>
                <th>Track</th>
                <th>Streams</th>
              </tr>
            </thead>
            <tbody>
              {activeData.top_tracks.map((track) => (
                <tr key={`${track.position}-${track.name}`} className="border-t border-white/10">
                  <td className="py-2">{track.position}</td>
                  <td>{track.name}</td>
                  <td>{fmt(track.streams)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="col-span-3 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-white/70">
          <span className="mr-2 inline-flex items-center gap-2">
            Last synced
            {refreshStatus === 'polling' ? (
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-purple-400" />
            ) : null}
          </span>
          <span className="font-medium text-white">{lastRefreshed}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleRefresh()
          }}
          disabled={refreshStatus === 'loading' || refreshStatus === 'polling'}
          className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {buttonLabel[refreshStatus]}
        </button>

        <div className="rounded-lg border border-white/10 p-3">
          <h3 className="text-sm font-semibold">Catalog Value</h3>
          <p className="mt-2 text-xs text-white/70">Conservative: {fmtMoney(activeData.valuation_conservative)}</p>
          <p className="text-xs text-white/70">Base: {fmtMoney(activeData.valuation_base)}</p>
          <p className="text-xs text-white/70">Optimistic: {fmtMoney(activeData.valuation_optimistic)}</p>
        </div>

        <div className="rounded-lg border border-white/10 p-3">
          <h3 className="text-sm font-semibold">Key Metrics</h3>
          <p className="mt-2 text-xs text-white/70">Monthly Listeners: {fmt(activeData.monthly_listeners)}</p>
          <p className="text-xs text-white/70">Total Streams: {fmt(activeData.total_streams)}</p>
        </div>
      </aside>
    </main>
  )
}

interface StatCardProps {
  title: string
  value: string
}

function StatCard({ title, value }: StatCardProps): JSX.Element {
  return (
    <article className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-xs uppercase tracking-wide text-white/60">{title}</h3>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  )
}
