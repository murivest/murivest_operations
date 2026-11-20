import { sanityClientFor } from './client'
import type {
  AccessTier,
  BriefDoc,
  DiscoverDocumentType,
  DocumentDoc,
  LandingContentDoc,
  MarketReportDoc,
  OpportunityDoc,
} from './types'
import type { DiscoverSource } from '../../sanity/lib/constants'

type ExternalPropertyType = Exclude<DiscoverDocumentType, 'opportunity'>

const AUCTION_PROPERTY_TYPES: ExternalPropertyType[] = ['auctionProperty']
const LISTING_PROPERTY_TYPES: ExternalPropertyType[] = [
  'property',
  'ukProperty',
  'usProperty',
  'uaeProperty',
  'sgProperty',
]

const DISCOVER_SOURCE_CONFIG: Record<
  DiscoverSource,
  {
    includePortalOpportunities: boolean
    auctionTypes: ExternalPropertyType[]
    listingTypes: ExternalPropertyType[]
  }
> = {
  all: {
    includePortalOpportunities: true,
    auctionTypes: AUCTION_PROPERTY_TYPES,
    listingTypes: LISTING_PROPERTY_TYPES,
  },
  off_market: {
    includePortalOpportunities: true,
    auctionTypes: [],
    listingTypes: [],
  },
  auction: {
    includePortalOpportunities: false,
    auctionTypes: AUCTION_PROPERTY_TYPES,
    listingTypes: [],
  },
  kenya: {
    includePortalOpportunities: false,
    auctionTypes: [],
    listingTypes: ['property'],
  },
  uk: {
    includePortalOpportunities: false,
    auctionTypes: [],
    listingTypes: ['ukProperty'],
  },
  us: {
    includePortalOpportunities: false,
    auctionTypes: [],
    listingTypes: ['usProperty'],
  },
  uae: {
    includePortalOpportunities: false,
    auctionTypes: [],
    listingTypes: ['uaeProperty'],
  },
  singapore: {
    includePortalOpportunities: false,
    auctionTypes: [],
    listingTypes: ['sgProperty'],
  },
}

const OPPORTUNITY_PROJECTION = `{
  _id,
  _type,
  title,
  slug,
  status,
  listingType,
  country,
  publicDetailUrl,
  sanityProjectId,
  sanityDataset,
  accessTier,
  assetClass,
  geography,
  dealStructure,
  indicativePrice,
  investmentSizeMin,
  investmentSizeMax,
  financials,
  leaseProfile,
  summary,
  investmentRationale,
  keyRisks,
  auctionUrl,
  featured,
  publishDate,
  "images": images[] { _key, alt, "ref": asset->_ref },
  "documents": documents[] { _key, _ref },
  "availableBriefs": availableBriefs[] { _key, _ref }
}`

const EXTERNAL_PROPERTY_PROJECTION = `{
  _id,
  _type,
  _createdAt,
  title,
  "slug": slug.current,
  status,
  listingType,
  country,
  publicDetailUrl,
  accessTier,
  assetClass,
  assetType,
  propertyType,
  type,
  geography,
  city,
  emirate,
  community,
  submarket,
  district,
  address,
  location,
  dealStructure,
  indicativePrice,
  askingPrice,
  guidePrice,
  reservePrice,
  expectedPrice,
  price,
  priceAed,
  priceUsd,
  priceGbp,
  priceKsh,
  priceSgd,
  currency,
  priceCurrency,
  financials,
  noi,
  capRate,
  grossRentalYield,
  yield,
  annualYield,
  occupancyRate,
  occupancy,
  summary,
  descriptionShort,
  subtitle,
  description,
  investmentRationale,
  keyRisks,
  leaseProfile,
  featured,
  isFeatured,
  publishDate,
  publishedAt,
  isOffMarket,
  auctionUrl,
  investmentSizeMin,
  investmentSizeMax,
  images
}`

const BRIEF_PROJECTION = `{
  _id, title, "slug": slug.current, briefType, accessTier, scope,
  deliveryExpectations, pricing, auctionRef, description,
  "coverRef": coverImage.asset->_ref,
  "linkedOpportunityId": linkedOpportunity->_id
}`

const DOCUMENT_PROJECTION = `{
  _id, title, docType, accessTier, description, downloadable, publishDate,
  "fileRef": file.asset->_ref,
  "fileExtension": file.asset->extension,
  "fileSize": file.asset->size,
  "linkedOpportunityId": linkedOpportunity->_id
}`

const REPORT_PROJECTION = `{
  _id, title, "slug": slug.current, category, geography, accessTier, summary,
  body, publishDate, "coverRef": coverImage.asset->_ref,
  "attachedDocumentId": attachDocument->_id
}`

interface ExternalPropertyRaw {
  _id: string
  _type: ExternalPropertyType
  [key: string]: unknown
}

type ExternalProject = 'auction' | 'listings'

export async function getDiscoverBySource(
  source: DiscoverSource,
  userTier: AccessTier,
): Promise<OpportunityDoc[]> {
  const config = DISCOVER_SOURCE_CONFIG[source]
  const tiers = tiersAllowedBy(userTier)

  const portalClient = config.includePortalOpportunities
    ? sanityClientFor('portal')
    : null
  const auctionClient = config.auctionTypes.length
    ? sanityClientFor('auction')
    : null
  const listingsClient = config.listingTypes.length
    ? sanityClientFor('listings')
    : null

  const portalPromise = portalClient
    ? portalClient.fetch<OpportunityDoc[]>(
        `*[
          _type == "opportunity"
          && defined(published)
          && published == true
          && accessTier in $tiers
          ${
            source === 'off_market'
              ? '&& (status == "off_market" || listingType == "off_market")'
              : ''
          }
        ] | order(featured desc, publishDate desc, title asc) ${OPPORTUNITY_PROJECTION}`,
        { tiers },
      )
    : Promise.resolve([] as OpportunityDoc[])

  const auctionPromise = auctionClient
    ? auctionClient
        .fetch<ExternalPropertyRaw[]>(
          `*[_type in $types && ${externalPropertyFilter(source)}]
           | order(coalesce(featured, isFeatured, false) desc, coalesce(publishDate, publishedAt, _createdAt) desc, title asc)
           ${EXTERNAL_PROPERTY_PROJECTION}`,
          { types: config.auctionTypes, tiers },
        )
        .then((docs) => docs.map((doc) => normalizeExternalProperty(doc, 'auction')))
    : Promise.resolve([] as OpportunityDoc[])

  const listingsPromise = listingsClient
    ? listingsClient
        .fetch<ExternalPropertyRaw[]>(
          `*[_type in $types && ${externalPropertyFilter(source)}]
           | order(coalesce(featured, isFeatured, false) desc, coalesce(publishDate, publishedAt, _createdAt) desc, title asc)
           ${EXTERNAL_PROPERTY_PROJECTION}`,
          { types: config.listingTypes, tiers },
        )
        .then((docs) => docs.map((doc) => normalizeExternalProperty(doc, 'listings')))
    : Promise.resolve([] as OpportunityDoc[])

  const [portalDocs, auctionDocs, listingDocs] = await Promise.all([
    portalPromise,
    auctionPromise,
    listingsPromise,
  ])

  return [...portalDocs, ...auctionDocs, ...listingDocs].sort(compareDiscoverDocs)
}

function externalPropertyFilter(source: DiscoverSource): string {
  const kenyaFilter =
    source === 'kenya'
      ? '&& lower(coalesce(country, geography.country)) in ["kenya", "ke"]'
      : ''

  return `defined(title)
    && (!defined(published) || published == true)
    && (!defined(accessTier) || accessTier in $tiers)
    && !coalesce(isOffMarket, false)
    && (!defined(status) || (
      lower(status) != "off_market"
      && lower(status) != "off-market"
      && lower(status) != "off market"
    ))
    && (!defined(listingType) || (
      listingType != "off_market"
      && listingType != "off-market"
    ))
    ${kenyaFilter}`
}

export async function getOpportunities(userTier: AccessTier): Promise<OpportunityDoc[]> {
  const client = sanityClientFor('portal')
  if (!client) return []

  return client.fetch(
    `*[
      _type == "opportunity"
      && defined(published)
      && published == true
      && accessTier in $tiers
    ] | order(featured desc, publishDate desc, title asc) ${OPPORTUNITY_PROJECTION}`,
    { tiers: tiersAllowedBy(userTier) },
  )
}

export async function getOpportunityById(
  id: string,
  userTier: AccessTier,
): Promise<OpportunityDoc | null> {
  const tiers = tiersAllowedBy(userTier)
  const portalClient = sanityClientFor('portal')

  if (portalClient) {
    const opportunity = await portalClient.fetch<OpportunityDoc | null>(
      `*[
        _type == "opportunity"
        && _id == $id
        && defined(published)
        && published == true
        && accessTier in $tiers
      ][0] ${OPPORTUNITY_PROJECTION}`,
      { id, tiers },
    )

    if (opportunity) return opportunity
  }

  const auctionClient = sanityClientFor('auction')
  const auctionProperty = auctionClient
    ? await getExternalPropertyById(
        auctionClient,
        id,
        AUCTION_PROPERTY_TYPES,
        tiers,
        'auction',
      )
    : null

  if (auctionProperty) return auctionProperty

  const listingsClient = sanityClientFor('listings')
  return listingsClient
    ? getExternalPropertyById(
        listingsClient,
        id,
        LISTING_PROPERTY_TYPES,
        tiers,
        'listings',
      )
    : null
}

async function getExternalPropertyById(
  client: NonNullable<ReturnType<typeof sanityClientFor>>,
  id: string,
  types: ExternalPropertyType[],
  tiers: AccessTier[],
  project: ExternalProject,
): Promise<OpportunityDoc | null> {
  const property = await client.fetch<ExternalPropertyRaw | null>(
    `*[
      _type in $types
      && _id == $id
      && ${externalPropertyFilter('all')}
    ][0] ${EXTERNAL_PROPERTY_PROJECTION}`,
    { id, types, tiers },
  )

  return property ? normalizeExternalProperty(property, project) : null
}

function normalizeExternalProperty(
  raw: ExternalPropertyRaw,
  project: ExternalProject,
): OpportunityDoc {
  const indicativePrice = asRecord(raw['indicativePrice'])
  const financials = asRecord(raw['financials'])
  const geography = asRecord(raw['geography'])

  const country =
    firstString(raw['country'], geography?.['country']) || defaultCountryForType(raw._type)
  const city = firstString(raw['city'], raw['emirate'], geography?.['city'])
  const district = firstString(raw['submarket'], raw['community'], raw['district'], geography?.['district'])
  const addressLine = firstString(raw['address'], raw['location'], geography?.['addressLine'])

  const rawStatus = firstString(raw['status'])?.toLowerCase().replace(/[\s-]+/g, '_')
  const isAuction = raw._type === 'auctionProperty' || rawStatus === 'auction'
  const isOffMarket = raw['isOffMarket'] === true || rawStatus === 'off_market'

  const status: OpportunityDoc['status'] = isAuction
    ? 'auction'
    : isOffMarket
      ? 'off_market'
      : rawStatus === 'under_offer' || rawStatus === 'under_contract'
        ? 'under_offer'
        : rawStatus === 'sold' || rawStatus === 'closed' || rawStatus === 'withdrawn'
          ? 'closed'
          : 'marketed'

  const assetClass = firstString(raw['assetClass'], raw['assetType'], raw['propertyType'], raw['type'])
  const rawPrice = firstPresent(
    indicativePrice?.['amount'],
    raw['askingPrice'],
    raw['guidePrice'],
    raw['reservePrice'],
    raw['expectedPrice'],
    raw['priceAed'],
    raw['priceUsd'],
    raw['priceGbp'],
    raw['priceKsh'],
    raw['priceSgd'],
    raw['price'],
  )

  const displayPrice = firstString(
    raw['price'],
    raw['priceAed'],
    raw['priceUsd'],
    raw['priceGbp'],
    raw['priceKsh'],
    raw['priceSgd'],
    raw['guidePrice'],
    raw['reservePrice'],
    raw['expectedPrice'],
  )

  const priceCurrency =
    firstString(indicativePrice?.['currency'], raw['currency'], raw['priceCurrency']) ||
    currencyFromPriceLabel(displayPrice) ||
    currencyForCountry(country)

  const netYieldPct = numericValue(
    firstPresent(financials?.['netYieldPct'], raw['yield'], raw['annualYield'], raw['capRate']),
  )
  const grossYieldPct = numericValue(
    firstPresent(financials?.['grossYieldPct'], raw['grossRentalYield']),
  )
  const occupancyPct = numericValue(
    firstPresent(financials?.['occupancyPct'], raw['occupancyRate'], raw['occupancy']),
  )
  const noi = numericValue(firstPresent(financials?.['noi'], raw['noi']))
  const grossIncomeAnnual = numericValue(financials?.['grossIncomeAnnual'])
  const operatingExpenses = numericValue(financials?.['operatingExpenses'])
  const financialCurrency = firstString(financials?.['financialCurrency']) || priceCurrency

  const hasFinancials = [
    netYieldPct,
    grossYieldPct,
    occupancyPct,
    noi,
    grossIncomeAnnual,
    operatingExpenses,
  ].some((value) => value !== null)

  const slugRecord = asRecord(raw['slug'])
  const slugValue = firstString(raw['slug'], slugRecord?.['current'])
  const accessTier: AccessTier =
    raw['accessTier'] === 'tier_2' || raw['accessTier'] === 'tier_3' ? raw['accessTier'] : 'tier_1'

  const listingType: OpportunityDoc['listingType'] = isAuction
    ? 'auction'
    : isOffMarket
      ? 'off_market'
      : 'available_by_country'

  const projectId =
    project === 'auction'
      ? process.env['SANITY_AUCTION_PROJECT_ID']
      : process.env['SANITY_LISTINGS_PROJECT_ID']
  const dataset =
    (project === 'auction'
      ? process.env['SANITY_AUCTION_DATASET']
      : process.env['SANITY_LISTINGS_DATASET']) || 'production'

  return {
    _id: raw._id,
    _type: raw._type,
    title: firstString(raw['title']) || 'Untitled property',
    slug: slugValue ? { current: slugValue } : null,
    status,
    listingType,
    country,
    publicDetailUrl: firstString(raw['publicDetailUrl']),
    sanityProjectId: projectId || null,
    sanityDataset: dataset,
    accessTier,
    assetClass: assetClass ? normalizeAssetClass(assetClass) : null,
    geography: {
      country,
      ...(city ? { city } : {}),
      ...(district ? { district } : {}),
      ...(addressLine ? { addressLine } : {}),
    },
    dealStructure: firstString(raw['dealStructure'])
      ? normalizeDealStructure(firstString(raw['dealStructure'])!)
      : null,
    indicativePrice: {
      amount: numericValue(rawPrice),
      currency: priceCurrency,
      basis:
        firstString(indicativePrice?.['basis']) ||
        (rawPrice == null ? null : 'Published guidance'),
      display: displayPrice,
    },
    investmentSizeMin: numericValue(raw['investmentSizeMin']),
    investmentSizeMax: numericValue(raw['investmentSizeMax']),
    financials: hasFinancials
      ? {
          grossIncomeAnnual,
          operatingExpenses,
          noi,
          grossYieldPct,
          netYieldPct,
          occupancyPct,
          financialCurrency,
        }
      : null,
    leaseProfile: Array.isArray(raw['leaseProfile'])
      ? (raw['leaseProfile'] as NonNullable<OpportunityDoc['leaseProfile']>)
      : null,
    summary: firstString(raw['summary'], raw['descriptionShort'], raw['subtitle'], raw['description']),
    investmentRationale: Array.isArray(raw['investmentRationale'])
      ? raw['investmentRationale']
      : null,
    keyRisks: Array.isArray(raw['keyRisks'])
      ? raw['keyRisks'].filter((risk): risk is string => typeof risk === 'string')
      : null,
    auctionUrl: firstString(raw['auctionUrl']),
    featured: raw['featured'] === true || raw['isFeatured'] === true,
    isOffMarket,
    publishDate: firstString(raw['publishDate'], raw['publishedAt'], raw['createdAt']),
    images: Array.isArray(raw['images'])
      ? (raw['images'] as NonNullable<OpportunityDoc['images']>)
      : null,
    documents: null,
    availableBriefs: null,
  }
}

function compareDiscoverDocs(a: OpportunityDoc, b: OpportunityDoc): number {
  const aFeatured = Boolean(a.featured)
  const bFeatured = Boolean(b.featured)
  if (aFeatured !== bFeatured) return aFeatured ? -1 : 1

  const dateDifference =
    Date.parse(b.publishDate || '') - Date.parse(a.publishDate || '')
  if (Number.isFinite(dateDifference) && dateDifference !== 0) return dateDifference

  return a.title.localeCompare(b.title)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function firstPresent(...values: unknown[]): unknown {
  return values.find((value) => value !== null && value !== undefined && value !== '')
}

function firstString(...values: unknown[]): string | null {
  const value = values.find(
    (item) => typeof item === 'string' && item.trim().length > 0,
  )
  return typeof value === 'string' ? value.trim() : null
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null

  const number = Number(match[0])
  const suffix = value.slice((match.index || 0) + match[0].length).toLowerCase()
  const multiplier = /\b(?:b|bn|billion)s?\b/.test(suffix)
    ? 1_000_000_000
    : /\b(?:m|mn|million)s?\b/.test(suffix)
      ? 1_000_000
      : /\b(?:k|thousand)s?\b/.test(suffix)
        ? 1_000
        : 1

  const parsed = number * multiplier
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeOptionValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function normalizeAssetClass(value: string): string {
  const normalized = normalizeOptionValue(value)

  if (normalized.includes('industrial') || normalized.includes('logistics'))
    return 'industrial'
  if (normalized === 'hotel' || normalized === 'hotels') return 'hospitality'
  if (normalized.includes('mixed_use')) return 'mixed_use'
  if (normalized.includes('residential') || normalized === 'living') return 'living'

  return normalized
}

function normalizeDealStructure(value: string): string {
  const normalized = normalizeOptionValue(value)

  if (normalized.includes('joint_venture')) return 'joint_venture'
  if (normalized.includes('preferred_equity')) return 'preferred_equity'
  if (normalized.includes('debt') || normalized.includes('credit')) return 'debt'
  if (normalized.includes('direct')) return 'direct'

  return normalized
}

function defaultCountryForType(type: ExternalPropertyType): string {
  switch (type) {
    case 'ukProperty':
      return 'United Kingdom'
    case 'uaeProperty':
      return 'United Arab Emirates'
    case 'sgProperty':
      return 'Singapore'
    case 'usProperty':
      return 'United States'
    default:
      return 'Kenya'
  }
}

function currencyForCountry(country: string): string {
  const value = country.toLowerCase()

  if (value.includes('kenya') || value === 'ke') return 'KES'
  if (value === 'uk' || value.includes('kingdom')) return 'GBP'
  if (value === 'uae' || value.includes('emirates')) return 'AED'
  if (value.includes('singapore')) return 'SGD'
  if (value === 'us' || value.includes('united states')) return 'USD'

  return 'USD'
}

function currencyFromPriceLabel(value: string | null): string | null {
  if (!value) return null

  const match = value.match(/\b(USD|KES|GBP|AED|SGD|EUR)\b/i)
  return match?.[1]?.toUpperCase() ?? null
}

export async function getBriefs(userTier: AccessTier): Promise<BriefDoc[]> {
  const client = sanityClientFor('portal')
  if (!client) return []

  return client.fetch(
    `*[_type == "brief" && defined(published) && published == true && accessTier in $tiers]
      | order(title asc) ${BRIEF_PROJECTION}`,
    { tiers: tiersAllowedBy(userTier) },
  )
}

export async function getBriefById(
  id: string,
  userTier: AccessTier,
): Promise<BriefDoc | null> {
  const client = sanityClientFor('portal')
  if (!client) return null

  return client.fetch(
    `*[_type == "brief" && _id == $id && defined(published) && published == true && accessTier in $tiers][0]
      ${BRIEF_PROJECTION}`,
    { id, tiers: tiersAllowedBy(userTier) },
  )
}

export async function getBriefBySlug(
  slug: string,
  userTier: AccessTier,
): Promise<BriefDoc | null> {
  const client = sanityClientFor('portal')
  if (!client) return null

  return client.fetch(
    `*[_type == "brief" && slug.current == $slug && defined(published) && published == true && accessTier in $tiers][0]
      ${BRIEF_PROJECTION}`,
    { slug, tiers: tiersAllowedBy(userTier) },
  )
}

export async function getDocuments(userTier: AccessTier): Promise<DocumentDoc[]> {
  const client = sanityClientFor('portal')
  if (!client) return []

  return client.fetch(
    `*[_type == "document" && defined(published) && published == true && accessTier in $tiers]
      | order(publishDate desc, title asc) ${DOCUMENT_PROJECTION}`,
    { tiers: tiersAllowedBy(userTier) },
  )
}

export async function getDocumentById(
  id: string,
  userTier: AccessTier,
): Promise<DocumentDoc | null> {
  const client = sanityClientFor('portal')
  if (!client) return null

  return client.fetch(
    `*[_type == "document" && _id == $id && defined(published) && published == true && accessTier in $tiers][0]
      ${DOCUMENT_PROJECTION}`,
    { id, tiers: tiersAllowedBy(userTier) },
  )
}

export async function getMarketReports(
  userTier: AccessTier,
): Promise<MarketReportDoc[]> {
  const client = sanityClientFor('portal')
  if (!client) return []

  return client.fetch(
    `*[_type == "marketReport" && defined(published) && published == true && accessTier in $tiers]
      | order(publishDate desc) ${REPORT_PROJECTION}`,
    { tiers: tiersAllowedBy(userTier) },
  )
}

export async function getMarketReportById(
  id: string,
  userTier: AccessTier,
): Promise<MarketReportDoc | null> {
  const client = sanityClientFor('portal')
  if (!client) return null

  return client.fetch(
    `*[_type == "marketReport" && _id == $id && defined(published) && published == true && accessTier in $tiers][0]
      ${REPORT_PROJECTION}`,
    { id, tiers: tiersAllowedBy(userTier) },
  )
}

export async function getLandingContent(): Promise<LandingContentDoc | null> {
  const client = sanityClientFor('portal')
  if (!client) return null

  return client.fetch(`*[_type == "landingContent"][0] {
    heroEyebrow, heroHeadline, heroSubline, credibility, coverageMarkets,
    directorName, directorVideoUrl, directorVideoCaption,
    "directorVideoPosterRef": directorVideoPoster.asset->_ref,
    "valueProps": valueProps[] { _key, heading, detail }
  }`)
}

/** Resolve a portal Sanity file asset id to its authenticated URL on the server. */
export async function getFileAssetUrl(assetRef: string): Promise<string | null> {
  const client = sanityClientFor('portal')
  if (!client) return null

  const url = await client.fetch(
    `*[_type == "sanity.fileAsset" && _id == $ref][0].url`,
    { ref: assetRef },
  )

  return typeof url === 'string' ? url : null
}

/** Resolve a portal Sanity image asset id to its CDN URL. */
export function getImageAssetUrl(assetRef: string, width?: number): string | null {
  const projectId = process.env['SANITY_PROJECT_ID']
  if (!projectId || !assetRef.startsWith('image-')) return null

  const dataset = process.env['SANITY_DATASET'] || 'production'
  const match = assetRef.match(/^image-([a-f0-9]+)-(\d+)x(\d+)-(\w+)$/)
  if (!match) return null

  const [, id, , , extension] = match
  const dimensions = width ? `?w=${width}` : ''
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${id}-${extension}${dimensions}`
}

function tiersAllowedBy(userTier: AccessTier): AccessTier[] {
  const tiers: AccessTier[] = ['tier_1', 'tier_2', 'tier_3']
  const rank: Record<AccessTier, number> = { tier_1: 1, tier_2: 2, tier_3: 3 }

  return tiers.filter((tier) => rank[tier] <= rank[userTier])
}