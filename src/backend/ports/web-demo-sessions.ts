export type WebDemoSessionStatus =
  | 'started'
  | 'connected'
  | 'completed'
  | 'failed'
  | 'timed_out'
  | 'rate_limited';

export type WebDemoSessionDemoSource = 'direct_openai_realtime';

export interface WebDemoSessionAdminRecord {
  id: string;
  publicSessionId: string;
  requestId: string | null;
  verticalSlug: string | null;
  businessName: string | null;
  importedSiteUrl: string | null;
  demoSource: string;
  status: WebDemoSessionStatus;
  ipAddress: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  userAgent: string | null;
  deviceType: string | null;
  browser: string | null;
  startedAt: string;
  connectedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  transcript: unknown | null;
  summary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebDemoSessionsRepository {
  insertStarted(params: {
    publicSessionId: string;
    requestId: string;
    verticalSlug: string;
    businessName: string;
    ipAddress: string | null;
    country: string | null;
    userAgent: string | null;
    browser: string | null;
    deviceType: string | null;
    demoSource?: WebDemoSessionDemoSource;
    importedSiteUrl?: string | null;
  }): Promise<void>;

  insertRateLimited(params: {
    publicSessionId: string;
    verticalSlug: string;
    businessName: string;
    ipAddress: string | null;
    country: string | null;
    userAgent: string | null;
    browser: string | null;
    deviceType: string | null;
    errorCode: string;
    errorMessage?: string | null;
  }): Promise<void>;

  markConnectedByRequestId(requestId: string): Promise<void>;

  markFailedByRequestId(requestId: string, params: { errorCode: string; errorMessage?: string | null }): Promise<void>;

  finalizeByRequestId(requestId: string, params: { endReason: 'completed' | 'timeout' }): Promise<void>;

  /** Persist the captured browser-demo transcript (array of conversation turns). */
  saveTranscriptByRequestId(requestId: string, transcript: unknown): Promise<void>;

  listForAdmin(params: {
    startedAfter: Date;
    startedBefore: Date;
    verticalSlug?: string | null;
    status?: WebDemoSessionStatus | null;
    country?: string | null;
    search?: string | null;
    limit: number;
    offset: number;
  }): Promise<WebDemoSessionAdminRecord[]>;

  countForAdmin(params: {
    startedAfter: Date;
    startedBefore: Date;
    verticalSlug?: string | null;
    status?: WebDemoSessionStatus | null;
    country?: string | null;
    search?: string | null;
  }): Promise<number>;

  findById(id: string): Promise<WebDemoSessionAdminRecord | null>;
}
