export type AccessTier = 'tier_1' | 'tier_2' | 'tier_3'

export type DiscoverDocumentType =
  | 'opportunity'
  | 'auctionProperty'
  | 'property'
  | 'ukProperty'
  | 'usProperty'
  | 'uaeProperty'
  | 'sgProperty'

export type OpportunityStatus =
  | 'marketed'
  | 'auction'
  | 'off_market'
  | 'under_offer'
  | 'closed'

export type OpportunityListingType =
  | 'auction'
  | 'off_market'
  | 'available_by_country'

export interface SanitySlug {
  _type?: 'slug'
  current: string
}

export interface SanityImage {
  _key?: string
  _type?: 'image'
  alt?: string | null
  ref?: string | null
  asset?: { _ref: string; _type: 'reference' }
}

export interface SanityRef {
  _key?: string
  _type?: 'reference'
  _ref: string
}

export interface OpportunityGeography {
  country?: string
  city?: string
  district?: string
  addressLine?: string
}

export interface OpportunityPrice {
  amount: number | null
  currency: string | null
  basis?: string | null
  display?: string | null
}

export interface OpportunityFinancials {
  grossIncomeAnnual?: number | null
  operatingExpenses?: number | null
  noi?: number | null
  grossYieldPct?: number | null
  netYieldPct?: number | null
  occupancyPct?: number | null
  financialCurrency?: string | null
}

export interface OpportunityDoc {
  _id: string
  _type: DiscoverDocumentType
  title: string
  slug: SanitySlug | null
  status: OpportunityStatus
  listingType: OpportunityListingType
  country: string
  publicDetailUrl?: string | null
  sanityProjectId?: string | null
  sanityDataset?: string | null
  accessTier: AccessTier
  assetClass?: string | null
  geography?: OpportunityGeography
  dealStructure?: string | null
  indicativePrice?: OpportunityPrice | null
  investmentSizeMin?: number | null
  investmentSizeMax?: number | null
  financials?: OpportunityFinancials | null
  leaseProfile?: unknown[] | null
  summary?: string | null
  investmentRationale?: unknown[] | null
  keyRisks?: string[] | null
  auctionUrl?: string | null
  featured?: boolean | null
  isOffMarket?: boolean
  publishDate?: string | null
  images?: SanityImage[] | null
  documents?: SanityRef[] | null
  availableBriefs?: SanityRef[] | null
}

export interface BriefDoc {
  _id: string
  title: string
  slug?: string | null
  briefType?: string | null
  accessTier: AccessTier
  scope?: string | null
  deliveryExpectations?: string | null
  pricing?: string | null
  auctionRef?: string | null
  description?: string | null
  coverRef?: string | null
  linkedOpportunityId?: string | null
}

export interface DocumentDoc {
  _id: string
  title: string
  docType?: string | null
  accessTier: AccessTier
  description?: string | null
  downloadable?: boolean | null
  publishDate?: string | null
  fileRef?: string | null
  fileExtension?: string | null
  fileSize?: number | null
  linkedOpportunityId?: string | null
}

export interface MarketReportDoc {
  _id: string
  title: string
  slug?: string | null
  category?: string | null
  geography?: string | null
  accessTier: AccessTier
  summary?: string | null
  body?: unknown
  publishDate?: string | null
  coverRef?: string | null
  attachedDocumentId?: string | null
}

export interface LandingValueProp {
  _key?: string
  heading?: string | null
  detail?: string | null
}

export interface LandingContentDoc {
  heroEyebrow?: string | null
  heroHeadline?: string | null
  heroSubline?: string | null
  credibility?: unknown
  coverageMarkets?: unknown
  directorName?: string | null
  directorVideoUrl?: string | null
  directorVideoCaption?: string | null
  directorVideoPosterRef?: string | null
  valueProps?: LandingValueProp[] | null
}