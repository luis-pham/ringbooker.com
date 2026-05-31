import type { Shop } from '@/src/backend/domain/types';
import type {
  ShopStaffRepository,
  ShopStaffServicesRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';

export type SyncPlatform = 'square' | 'vagaro' | 'mindbody' | 'acuity';

export type SyncCapabilities = {
  canSyncLocation: boolean;
  canSyncServices: boolean;
  canSyncStaff: boolean;
  canSyncStaffServiceMapping: boolean;
};

export type SyncStatus = 'success' | 'partial' | 'failed' | 'skipped';

export type SyncItemAction = 'created' | 'updated' | 'skipped' | 'failed';

export type SyncItemResult = {
  externalId: string;
  name: string;
  action: SyncItemAction;
  error?: string;
};

export type LocationSyncResult = {
  status: SyncStatus;
  locationId: string | null;
  locationName: string | null;
  error?: string;
};

export type ServiceSyncResult = {
  status: SyncStatus;
  total: number;
  matched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: SyncItemResult[];
  error?: string;
};

export type StaffSyncResult = {
  status: SyncStatus;
  total: number;
  matched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: SyncItemResult[];
  error?: string;
};

export type MappingSyncResult = {
  status: SyncStatus;
  totalMappings: number;
  created: number;
  skipped: number;
  error?: string;
};

export type SyncResult = {
  platform: SyncPlatform;
  shopId: string;
  triggeredAt: Date;
  location: LocationSyncResult;
  services: ServiceSyncResult;
  staff: StaffSyncResult;
  mapping: MappingSyncResult;
  durationMs: number;
};

export interface PlatformSyncAdapter {
  readonly platform: SyncPlatform;
  readonly capabilities: SyncCapabilities;
  syncAll(shop: Shop): Promise<SyncResult>;
  syncLocation(shop: Shop): Promise<LocationSyncResult>;
  syncServices(shop: Shop): Promise<ServiceSyncResult>;
  syncStaff(shop: Shop): Promise<StaffSyncResult>;
  syncStaffServiceMapping(shop: Shop): Promise<MappingSyncResult>;
}

export type PlatformSyncLogger = {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error?: (obj: Record<string, unknown>, msg?: string) => void;
};

export type PlatformSyncDeps = {
  shopsRepository: ShopsRepository;
  shopStaffRepository?: ShopStaffRepository;
  shopStaffServicesRepository?: ShopStaffServicesRepository;
  logger: PlatformSyncLogger;
};
