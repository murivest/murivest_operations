import { createClient, type SanityClient } from '@sanity/client'
import type { DiscoverSource } from '../../sanity/lib/constants'

type SanityProject = 'portal' | 'auction' | 'listings'

const projectConfig: Record<
  SanityProject,
  {
    projectId: string | undefined
    dataset: string | undefined
    apiVersion: string | undefined
    token: string | undefined
  }
> = {
  portal: {
    projectId: process.env['SANITY_PROJECT_ID'],
    dataset: process.env['SANITY_DATASET'],
    apiVersion: process.env['SANITY_API_VERSION'],
    token: process.env['SANITY_API_READ_TOKEN'],
  },
  auction: {
    projectId: process.env['SANITY_AUCTION_PROJECT_ID'],
    dataset: process.env['SANITY_AUCTION_DATASET'],
    apiVersion: process.env['SANITY_AUCTION_API_VERSION'],
    token: process.env['SANITY_AUCTION_READ_TOKEN'],
  },
  listings: {
    projectId: process.env['SANITY_LISTINGS_PROJECT_ID'],
    dataset: process.env['SANITY_LISTINGS_DATASET'],
    apiVersion: process.env['SANITY_LISTINGS_API_VERSION'],
    token: process.env['SANITY_LISTINGS_READ_TOKEN'],
  },
}

const clients: Partial<Record<SanityProject, SanityClient | null>> = {}

export function sanityClientFor(project: SanityProject): SanityClient | null {
  if (project in clients) return clients[project] ?? null

  const config = projectConfig[project]
  if (!config.projectId || config.projectId === 'your-project-id') {
    clients[project] = null
    return null
  }

  clients[project] = createClient({
    projectId: config.projectId,
    dataset: config.dataset || 'production',
    apiVersion: config.apiVersion || '2024-01-01',
    useCdn: true,
    ...(config.token ? { token: config.token } : {}),
    perspective: 'published',
  })

  return clients[project] ?? null
}

export function sanityClient(): SanityClient | null {
  return sanityClientFor('portal')
}

export function isSanityConfigured(): boolean {
  return sanityClientFor('portal') !== null
}

export function isDiscoverSanityConfigured(source: DiscoverSource): boolean {
  if (source === 'off_market') return sanityClientFor('portal') !== null
  if (source === 'auction') return sanityClientFor('auction') !== null
  if (source === 'all') {
    return (
      sanityClientFor('portal') !== null ||
      sanityClientFor('auction') !== null ||
      sanityClientFor('listings') !== null
    )
  }

  return sanityClientFor('listings') !== null
}