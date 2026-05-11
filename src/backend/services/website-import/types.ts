export type ImportSourceType =
  | 'google_maps'
  | 'yelp'
  | 'facebook'
  | 'instagram'
  | 'vagaro'
  | 'booksy'
  | 'glossgenius'
  | 'fresha'
  | 'styleseat'
  | 'square_site'
  | 'linktree'
  | 'normal_website';

export type CandidateBucket =
  | 'homepage'
  | 'service_hub'
  | 'service_child'
  | 'contact_hours'
  | 'about_team'
  | 'staff_team'
  | 'policies'
  | 'faq'
  | 'promotions'
  | 'booking'
  | 'noise';
export type CandidateSource = 'homepage' | 'nav' | 'footer' | 'sitemap' | 'robots_sitemap' | 'canonical' | 'og' | 'jsonld' | 'service_hub_child';

export type ImportField<T> = { value: T | null; confidence: number; source: string | null };
export type WeeklyHours = Record<string, unknown>;

export type CandidateUrl = {
  url: string;
  source: CandidateSource;
  anchorText?: string;
  sitemapLastmod?: string;
  pathTokens: string[];
  parentUrl?: string;
  discoveredFrom?: string;
};

export type PagePreview = {
  url: string;
  title: string;
  h1: string;
  h2s: string[];
  firstTextChars: string;
  priceCount: number;
  durationCount: number;
  serviceKeywordCount: number;
  internalServiceLikeLinkCount: number;
  links: Array<{ href: string; text: string }>;
  jsonLd: unknown[];
  contentScore: number;
};

export type SelectedPageDiagnostic = {
  url: string;
  bucket: CandidateBucket;
  score: number;
  source: CandidateSource;
  reason: string;
};

export type ImportedServiceSuggestion = {
  categoryName: string;
  name: string;
  description?: string | null;
  durationText?: string | null;
  durationMinutes?: number | null;
  priceAmount?: number | null;
  priceCurrency?: string;
  priceType?: 'fixed' | 'from' | 'varies' | 'consultation';
  aliases?: string[];
  bookingNotes?: string | null;
  bookable?: boolean;
  source: string;
  confidence: number;
};

export type StaffSuggestion = {
  name: string;
  role?: string;
  specialties?: string[];
  bio?: string;
  source: 'website' | 'llm' | 'jsonld';
  sourceUrl?: string;
  confidence: number;
  evidenceSnippet?: string;
};

export type PolicySuggestion = {
  type:
    | 'cancellation'
    | 'no_show'
    | 'deposit'
    | 'late_arrival'
    | 'walk_ins'
    | 'refund'
    | 'appointment_prep'
    | 'consultation'
    | 'other';
  title: string;
  content: string;
  source: 'website' | 'llm';
  sourceUrl?: string;
  confidence: number;
  evidenceSnippet?: string;
};

export type FaqSuggestion = {
  question: string;
  answer: string;
  source: 'website' | 'llm';
  sourceUrl?: string;
  confidence: number;
  evidenceSnippet?: string;
};

export type PromotionSuggestion = {
  title: string;
  description?: string;
  expiresAt?: string | null;
  source: 'website' | 'llm';
  sourceUrl?: string;
  confidence: number;
  evidenceSnippet?: string;
};

export type BookingSetupSuggestion = {
  type: 'booking_link' | 'booking_platform' | 'provider_booking' | 'consultation_required' | 'call_to_book' | 'other';
  label: string;
  value?: string;
  platform?: 'vagaro' | 'booksy' | 'fresha' | 'glossgenius' | 'square' | 'calendly' | 'other' | null;
  source: 'website' | 'llm' | 'deterministic';
  sourceUrl?: string;
  confidence: number;
};

export type ImportSuggestions = {
  status: 'success' | 'partial' | 'failed';
  sourceUrl: string;
  sourceType: ImportSourceType;
  businessProfile: {
    name: ImportField<string>;
    primaryType: ImportField<string>;
    phone: ImportField<string>;
    website: ImportField<string>;
    address: ImportField<string>;
    timezone: ImportField<string>;
  };
  hours: ImportField<Record<string, unknown>>;
  serviceCatalog: {
    confidence: number;
    source: string | null;
    categories: Array<{ name: string; source: string; confidence: number; groupKind: 'primary' | 'addon' | 'custom' | null }>;
    services: ImportedServiceSuggestion[];
  };
  alsoOffers: Array<ImportField<string>>;
  bookingUrl: ImportField<string>;
  languages: Array<ImportField<string>>;
  staffSuggestions: StaffSuggestion[];
  policySuggestions: PolicySuggestion[];
  faqSuggestions: FaqSuggestion[];
  promotionSuggestions: PromotionSuggestion[];
  bookingSetupSuggestions: BookingSetupSuggestion[];
  warnings: string[];
  completeness?: WebsiteImportCompleteness;
};

export type WebsiteImportCompleteness = {
  businessProfileCompleteness: number;
  contactCompleteness: number;
  hoursCompleteness: number;
  serviceCompleteness: number;
  overallConfidence: number;
  missingFields: string[];
  lowConfidenceFields: string[];
  recommendedNextAction:
    | 'ready_for_review'
    | 'needs_manual_review'
    | 'manual_setup_recommended'
    | 'partial_import'
    | 'retry_with_google_maps_link'
    | 'service_details_incomplete';
};

export type LlmImportExtraction = {
  businessProfile?: {
    name?: ImportField<string>;
    primaryType?: ImportField<string>;
    phone?: ImportField<string>;
    website?: ImportField<string>;
    address?: ImportField<string>;
    timezone?: ImportField<string>;
  };
  hours?: ImportField<WeeklyHours>;
  serviceCatalog?: {
    confidence: number;
    source?: string | null;
    categories?: Array<{ name: string; source?: string; confidence: number; groupKind?: 'primary' | 'addon' | 'custom' | null }>;
    services?: ImportedServiceSuggestion[];
  };
  alsoOffers?: Array<ImportField<string>>;
  bookingUrl?: ImportField<string>;
  languages?: Array<ImportField<string>>;
  staffSuggestions?: StaffSuggestion[];
  policySuggestions?: PolicySuggestion[];
  faqSuggestions?: FaqSuggestion[];
  promotionSuggestions?: PromotionSuggestion[];
  bookingSetupSuggestions?: BookingSetupSuggestion[];
  warnings?: string[];
};

export type ImportDiagnostics = {
  selectedPages: SelectedPageDiagnostic[];
  skippedPagesSummary: string[];
  sitemapSourcesFound: string[];
  serviceHubPagesFound: string[];
  childServicePagesFound: string[];
  confidenceSummary: Record<string, number>;
  warnings: string[];
  fallbackUsed: string[];
};

export type WebsiteImportResult = {
  ok: boolean;
  suggestions: ImportSuggestions;
  diagnostics: ImportDiagnostics;
};
