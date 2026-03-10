export interface SpotifyData {
  monthly_listeners: number
  total_streams: number
  top_tracks: TopTrack[]
  catalog_releases: CatalogRelease[]
  valuation_conservative: number
  valuation_base: number
  valuation_optimistic: number
  captured_at: string
}

export interface TopTrack {
  name: string
  streams: number
  position: number
}

export interface CatalogRelease {
  name: string
  type: string
  release_date: string
  total_tracks?: number
}

export type RefreshStatus = 'idle' | 'loading' | 'polling' | 'success' | 'error'
