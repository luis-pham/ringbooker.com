import type { Shop, ShopService } from '@/src/backend/domain/types';
import type { UpsertShopStaff } from '@/src/backend/ports/repositories';
import { SquareAppointmentsProvider } from '@/src/backend/services/booking-providers/square';
import {
  encodeSquareConnectionCredentials,
  parseSquareConnectionCredentials,
  squareFetchConnectionOptions,
  type SquareConnectionCredentials,
  type SquareConnectionOptions,
} from '@/src/backend/services/calendar/provider-connections';
import { syncSquareCatalogToShopServices } from '@/src/backend/services/calendar/square-catalog-sync';
import type {
  LocationSyncResult,
  MappingSyncResult,
  PlatformSyncAdapter,
  PlatformSyncDeps,
  ServiceSyncResult,
  StaffSyncResult,
  SyncCapabilities,
  SyncItemAction,
  SyncResult,
} from '@/src/backend/services/platform-sync/types';

function selectSquareLocation(locations: SquareConnectionOptions['locations']) {
  return locations.find((location) => location.status === 'ACTIVE') ?? locations[0] ?? null;
}

function mergeSquareCredentials(
  current: SquareConnectionCredentials,
  patch: Partial<SquareConnectionCredentials>,
): SquareConnectionCredentials {
  return {
    provider: 'square_appointments',
    access_token: patch.access_token ?? current.access_token,
    refresh_token: patch.refresh_token ?? current.refresh_token,
    expires_at: patch.expires_at ?? current.expires_at,
    merchant_id: patch.merchant_id ?? current.merchant_id,
    location_id: patch.location_id ?? current.location_id,
    service_variation_id: patch.service_variation_id ?? current.service_variation_id,
    service_variation_version: patch.service_variation_version ?? current.service_variation_version,
    team_member_id: patch.team_member_id ?? current.team_member_id,
  };
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').trim().slice(0, maxLength);
}

function sanitizeExternalId(value: unknown): string | null {
  const id = sanitizeText(value, 200);
  return id.length > 0 ? id : null;
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const [code, status] = raw.split(':');
  return [code, status].filter(Boolean).join(':').slice(0, 120) || 'unknown_error';
}

function emptyServiceResult(status: ServiceSyncResult['status'], error?: string): ServiceSyncResult {
  return { status, total: 0, matched: 0, created: 0, updated: 0, skipped: 0, failed: 0, items: [], error };
}

function emptyStaffResult(status: StaffSyncResult['status'], error?: string): StaffSyncResult {
  return { status, total: 0, matched: 0, created: 0, updated: 0, skipped: 0, failed: 0, items: [], error };
}

function actionForStaff(index: number, created: number, updated: number): SyncItemAction {
  if (index < created) return 'created';
  if (index < created + updated) return 'updated';
  return 'skipped';
}

function getTeamMemberIds(service: ShopService): string[] {
  const raw = service.externalMetadata?.teamMemberIds;
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeExternalId).filter((id): id is string => Boolean(id));
}

export class SquareSyncAdapter implements PlatformSyncAdapter {
  readonly platform = 'square' as const;
  readonly capabilities: SyncCapabilities = {
    canSyncLocation: true,
    canSyncServices: true,
    canSyncStaff: true,
    canSyncStaffServiceMapping: true,
  };

  constructor(private readonly deps: PlatformSyncDeps) {}

  async syncAll(shop: Shop): Promise<SyncResult> {
    const start = Date.now();
    const location = await this.syncLocation(shop);
    const services = await this.syncServices(shop);
    const staff = await this.syncStaff(shop);
    const mapping = await this.syncStaffServiceMapping(shop);
    return {
      platform: this.platform,
      shopId: shop.id,
      triggeredAt: new Date(),
      location,
      services,
      staff,
      mapping,
      durationMs: Date.now() - start,
    };
  }

  private async fetchOptionsAndPersistCredentials(shop: Shop): Promise<{
    credentials: SquareConnectionCredentials;
    options: SquareConnectionOptions;
  }> {
    const current = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
    if (!current?.access_token || !current.refresh_token) {
      throw new Error('square_missing_credentials');
    }

    const result = await squareFetchConnectionOptions(current);
    const selectedLocation = selectSquareLocation(result.options.locations);
    const credentials = mergeSquareCredentials(current, {
      ...result.credentials,
      location_id: selectedLocation?.id ?? result.credentials.location_id ?? current.location_id,
    });

    const shouldPersist =
      credentials.access_token !== current.access_token ||
      credentials.refresh_token !== current.refresh_token ||
      credentials.expires_at !== current.expires_at ||
      credentials.location_id !== current.location_id;

    if (shouldPersist) {
      await this.deps.shopsRepository.updateCalendarConnection(shop.id, {
        google_cal_id: shop.google_cal_id ?? null,
        google_cal_credentials_encrypted: encodeSquareConnectionCredentials(credentials),
      });
    }

    return {
      credentials,
      options: result.options,
    };
  }

  async syncLocation(shop: Shop): Promise<LocationSyncResult> {
    try {
      const result = await this.fetchOptionsAndPersistCredentials(shop);
      const selectedLocation = selectSquareLocation(result.options.locations);
      if (!selectedLocation) {
        return { status: 'failed', locationId: null, locationName: null, error: 'no_active_location' };
      }
      return {
        status: 'success',
        locationId: selectedLocation.id,
        locationName: selectedLocation.name,
      };
    } catch (error) {
      return {
        status: 'failed',
        locationId: null,
        locationName: null,
        error: sanitizeError(error),
      };
    }
  }

  async syncServices(shop: Shop): Promise<ServiceSyncResult> {
    try {
      const { credentials, options } = await this.fetchOptionsAndPersistCredentials(shop);
      const result = await syncSquareCatalogToShopServices({
        shopsRepository: this.deps.shopsRepository,
        shop,
        serviceVariations: options.serviceVariations,
        locationId: credentials.location_id,
      });
      const skipped = result.unmatched + result.skippedDuplicate;
      return {
        status: skipped > 0 ? 'partial' : 'success',
        total: options.serviceVariations.length,
        matched: result.matched,
        created: 0,
        updated: result.matched,
        skipped,
        failed: 0,
        items: [],
      };
    } catch (error) {
      return emptyServiceResult('failed', sanitizeError(error));
    }
  }

  async syncStaff(shop: Shop): Promise<StaffSyncResult> {
    if (!this.deps.shopStaffRepository) {
      return emptyStaffResult('skipped', 'shop_staff_repository_unavailable');
    }

    try {
      const { credentials } = await this.fetchOptionsAndPersistCredentials(shop);
      if (!credentials.location_id) {
        return emptyStaffResult('skipped', 'missing_location');
      }

      const providerShop: Shop = {
        ...shop,
        google_cal_credentials_encrypted: encodeSquareConnectionCredentials(credentials),
      };
      const provider = new SquareAppointmentsProvider(providerShop, {
        persistCredentials: async (encodedCredentials) => {
          await this.deps.shopsRepository.updateCalendarConnection(shop.id, {
            google_cal_id: shop.google_cal_id ?? null,
            google_cal_credentials_encrypted: encodedCredentials,
          });
        },
      });
      const teamMembers = await provider.getTeamMembers();
      const records = teamMembers
        .map((member): UpsertShopStaff | null => {
          const externalStaffId = sanitizeExternalId(member.id);
          const name = sanitizeText(member.displayName || [member.givenName, member.familyName].filter(Boolean).join(' '), 200);
          if (!externalStaffId || !name) return null;
          return {
            shopId: shop.id,
            name,
            role: null,
            specialties: [],
            notes: null,
            active: true,
            externalProvider: 'square' as const,
            externalStaffId,
            externalMetadata: {
              squareTeamMemberId: externalStaffId,
              ...(member.givenName ? { givenName: sanitizeText(member.givenName, 100) } : {}),
              ...(member.familyName ? { familyName: sanitizeText(member.familyName, 100) } : {}),
            },
          };
        })
        .filter((item): item is UpsertShopStaff => Boolean(item));

      const result = await this.deps.shopStaffRepository.bulkUpsertFromSync(shop.id, records);
      await this.deps.shopStaffRepository.deactivateNotInList(
        shop.id,
        'square',
        records.map((record) => record.externalStaffId),
      );

      return {
        status: 'success',
        total: records.length,
        matched: result.updated,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: 0,
        items: records.map((record, index) => ({
          externalId: record.externalStaffId,
          name: record.name,
          action: actionForStaff(index, result.created, result.updated),
        })),
      };
    } catch (error) {
      return emptyStaffResult('failed', sanitizeError(error));
    }
  }

  async syncStaffServiceMapping(shop: Shop): Promise<MappingSyncResult> {
    if (!this.deps.shopStaffRepository || !this.deps.shopStaffServicesRepository) {
      return { status: 'skipped', totalMappings: 0, created: 0, skipped: 0, error: 'mapping_repositories_unavailable' };
    }

    try {
      const catalog = await this.deps.shopsRepository.findServiceCatalogByShopId(shop.id);
      const squareServices = (catalog?.services ?? []).filter(
        (service) => service.externalProvider === 'square' && Boolean(service.externalServiceId),
      );
      if (squareServices.length === 0) {
        return { status: 'skipped', totalMappings: 0, created: 0, skipped: 0 };
      }

      let created = 0;
      let skipped = 0;
      for (const service of squareServices) {
        const teamMemberIds = getTeamMemberIds(service);
        for (const teamMemberId of teamMemberIds) {
          const staff = await this.deps.shopStaffRepository.findByExternalId(shop.id, 'square', teamMemberId);
          if (!staff) {
            skipped += 1;
            continue;
          }
          const result = await this.deps.shopStaffServicesRepository.setMappingsForStaff(shop.id, staff.id, [service.id]);
          created += result.created;
          skipped += result.skipped;
        }
      }

      return {
        status: created > 0 || skipped > 0 ? 'success' : 'skipped',
        totalMappings: created + skipped,
        created,
        skipped,
      };
    } catch (error) {
      return {
        status: 'failed',
        totalMappings: 0,
        created: 0,
        skipped: 0,
        error: sanitizeError(error),
      };
    }
  }
}
