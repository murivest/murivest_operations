export const DISCOVER_SOURCES = [
  'all',
  'off_market',
  'auction',
  'kenya',
  'uk',
  'us',
  'uae',
  'singapore',
] as const

export type DiscoverSource = (typeof DISCOVER_SOURCES)[number]