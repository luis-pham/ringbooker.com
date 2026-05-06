import type { SupabaseClient } from '@supabase/supabase-js';

import type { ContactRequest, ContactRequestIntent, ContactRequestPlanInterest, ContactRequestStatus } from '@/src/backend/domain/types';
import type { ContactRequestsRepository } from '@/src/backend/ports/repositories';

type ContactRequestRow = {
  id: string;
  request_id: string;
  full_name: string;
  business_name: string;
  email: string;
  phone_number: string;
  business_type: string;
  current_setup: string;
  help_need: string;
  best_time: string;
  intent: ContactRequestIntent | null;
  lead_source: string | null;
  plan_interest: ContactRequestPlanInterest | null;
  location_count: number | null;
  estimated_call_volume: string | null;
  booking_software: string | null;
  routing_needs: string | null;
  go_live_timeline: string | null;
  number_of_locations: number | null;
  locations_text: string | null;
  main_contact: string | null;
  current_phone_provider: string | null;
  current_booking_software: string | null;
  current_crm: string | null;
  estimated_monthly_call_volume: string | null;
  languages_needed: string | null;
  routing_rules: string | null;
  escalation_rules: string | null;
  integration_requirements: string | null;
  preferred_go_live_timeline: string | null;
  status: ContactRequestStatus;
  source: string;
  ip: string | null;
  notes: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
};

function toContactRequest(row: ContactRequestRow): ContactRequest {
  return {
    id: row.id,
    requestId: row.request_id,
    fullName: row.full_name,
    businessName: row.business_name,
    email: row.email,
    phoneNumber: row.phone_number,
    businessType: row.business_type,
    currentSetup: row.current_setup,
    helpNeed: row.help_need,
    bestTime: row.best_time,
    intent: row.intent ?? 'general',
    sourceDetail: row.lead_source,
    planInterest: row.plan_interest ?? 'unknown',
    locationCount: row.location_count,
    estimatedCallVolume: row.estimated_call_volume,
    bookingSoftware: row.booking_software,
    routingNeeds: row.routing_needs,
    goLiveTimeline: row.go_live_timeline,
    numberOfLocations: row.number_of_locations,
    locationsText: row.locations_text,
    mainContact: row.main_contact,
    currentPhoneProvider: row.current_phone_provider,
    currentBookingSoftware: row.current_booking_software,
    currentCrm: row.current_crm,
    estimatedMonthlyCallVolume: row.estimated_monthly_call_volume,
    languagesNeeded: row.languages_needed,
    routingRules: row.routing_rules,
    escalationRules: row.escalation_rules,
    integrationRequirements: row.integration_requirements,
    preferredGoLiveTimeline: row.preferred_go_live_timeline,
    status: row.status,
    source: row.source,
    ip: row.ip,
    notes: row.notes,
    handledBy: row.handled_by,
    handledAt: row.handled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeLimit(limit?: number, maxCap = 500): number {
  if (!limit || limit <= 0) return 100;
  return Math.min(limit, maxCap);
}

function applySearch<T extends { or: (filters: string) => T }>(query: T, search?: string): T {
  const normalized = search?.trim();
  if (!normalized) return query;
  const escaped = normalized.replace(/,/g, ' ');
  return query.or(
    [
      `request_id.ilike.%${escaped}%`,
      `full_name.ilike.%${escaped}%`,
      `business_name.ilike.%${escaped}%`,
      `email.ilike.%${escaped}%`,
      `phone_number.ilike.%${escaped}%`,
      `business_type.ilike.%${escaped}%`,
      `current_setup.ilike.%${escaped}%`,
      `help_need.ilike.%${escaped}%`,
      `best_time.ilike.%${escaped}%`,
      `lead_source.ilike.%${escaped}%`,
      `plan_interest.ilike.%${escaped}%`,
      `estimated_call_volume.ilike.%${escaped}%`,
      `booking_software.ilike.%${escaped}%`,
      `routing_needs.ilike.%${escaped}%`,
      `go_live_timeline.ilike.%${escaped}%`,
    ].join(','),
  );
}

export class SupabaseContactRequestsRepository implements ContactRequestsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(params: {
    requestId: string;
    fullName: string;
    businessName: string;
    email: string;
    phoneNumber: string;
    businessType: string;
    currentSetup: string;
    helpNeed: string;
    bestTime: string;
    intent?: ContactRequestIntent;
    sourceDetail?: string | null;
    planInterest?: ContactRequestPlanInterest;
    locationCount?: number | null;
    estimatedCallVolume?: string | null;
    bookingSoftware?: string | null;
    routingNeeds?: string | null;
    goLiveTimeline?: string | null;
    numberOfLocations?: number | null;
    locationsText?: string | null;
    mainContact?: string | null;
    currentPhoneProvider?: string | null;
    currentBookingSoftware?: string | null;
    currentCrm?: string | null;
    estimatedMonthlyCallVolume?: string | null;
    languagesNeeded?: string | null;
    routingRules?: string | null;
    escalationRules?: string | null;
    integrationRequirements?: string | null;
    preferredGoLiveTimeline?: string | null;
    source?: string;
    ip?: string | null;
  }): Promise<ContactRequest> {
    const { data, error } = await this.supabase
      .from('contact_requests')
      .insert({
        request_id: params.requestId,
        full_name: params.fullName,
        business_name: params.businessName,
        email: params.email,
        phone_number: params.phoneNumber,
        business_type: params.businessType,
        current_setup: params.currentSetup,
        help_need: params.helpNeed,
        best_time: params.bestTime,
        intent: params.intent ?? 'general',
        lead_source: params.sourceDetail ?? null,
        plan_interest: params.planInterest ?? 'unknown',
        location_count: params.locationCount ?? null,
        estimated_call_volume: params.estimatedCallVolume ?? null,
        booking_software: params.bookingSoftware ?? null,
        routing_needs: params.routingNeeds ?? null,
        go_live_timeline: params.goLiveTimeline ?? null,
        number_of_locations: params.numberOfLocations ?? null,
        locations_text: params.locationsText ?? null,
        main_contact: params.mainContact ?? null,
        current_phone_provider: params.currentPhoneProvider ?? null,
        current_booking_software: params.currentBookingSoftware ?? null,
        current_crm: params.currentCrm ?? null,
        estimated_monthly_call_volume: params.estimatedMonthlyCallVolume ?? null,
        languages_needed: params.languagesNeeded ?? null,
        routing_rules: params.routingRules ?? null,
        escalation_rules: params.escalationRules ?? null,
        integration_requirements: params.integrationRequirements ?? null,
        preferred_go_live_timeline: params.preferredGoLiveTimeline ?? null,
        status: 'new',
        source: params.source ?? 'marketing_contact_form',
        ip: params.ip ?? null,
      })
      .select('*')
      .single<ContactRequestRow>();

    if (error) {
      throw new Error(`contact_requests_create_failed:${error.message}`);
    }
    return toContactRequest(data);
  }

  async listForAdmin(params?: {
    limit?: number;
    status?: ContactRequestStatus | 'all';
    query?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    intent?: ContactRequestIntent | 'all';
  }): Promise<ContactRequest[]> {
    const hasRange = Boolean(params?.createdAfter && params?.createdBefore);
    const limit = normalizeLimit(params?.limit, hasRange ? 10_000 : 500);
    const status = params?.status ?? 'all';
    const intent = params?.intent ?? 'all';
    let query = this.supabase.from('contact_requests').select('*').order('created_at', { ascending: false }).limit(limit);
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (intent !== 'all') {
      query = query.eq('intent', intent);
    }
    if (params?.createdAfter) {
      query = query.gte('created_at', params.createdAfter.toISOString());
    }
    if (params?.createdBefore) {
      query = query.lte('created_at', params.createdBefore.toISOString());
    }
    query = applySearch(query, params?.query);
    const { data, error } = await query.returns<ContactRequestRow[]>();
    if (error) {
      throw new Error(`contact_requests_list_for_admin_failed:${error.message}`);
    }
    return (data ?? []).map(toContactRequest);
  }

  async updateStatus(
    id: string,
    params: {
      status: ContactRequestStatus;
      notes?: string | null;
      handledBy?: string | null;
    },
  ): Promise<ContactRequest | null> {
    const { data: current, error: currentError } = await this.supabase
      .from('contact_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle<ContactRequestRow>();
    if (currentError) {
      throw new Error(`contact_requests_find_for_update_failed:${currentError.message}`);
    }
    if (!current) return null;

    const nextStatus = params.status;
    const touchedStatus = current.status !== nextStatus;
    const { data, error } = await this.supabase
      .from('contact_requests')
      .update({
        status: nextStatus,
        notes: params.notes !== undefined ? params.notes : current.notes,
        handled_by: params.handledBy !== undefined ? params.handledBy : current.handled_by,
        handled_at: touchedStatus ? new Date().toISOString() : current.handled_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .maybeSingle<ContactRequestRow>();

    if (error) {
      throw new Error(`contact_requests_update_status_failed:${error.message}`);
    }
    return data ? toContactRequest(data) : null;
  }
}
