'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'next/navigation';

import { callOutcomeTagClass } from '@/components/admin/admin-call-outcome-tag';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import {
  IconBilling,
  IconOverview,
  IconPhone,
  IconShop,
  IconSliders,
} from '@/components/admin/admin-sidebar-icons';
import {
  adminBlockReasonLabel,
  adminLiveAnsweringLabel,
  adminOnboardingLabel,
  adminPaymentMethodLabel,
  adminPhoneSetupLabel,
  adminSubscriptionLabel,
  adminTrialCardLabel,
} from '@/lib/admin-shop-status-ui';
import type { AdminShopStatus } from '@/src/backend/services/admin/admin-shop-status';
import { adminShopDetailScripts, adminShopDetailStyles } from '@/components/admin/admin-shop-detail';

type ServiceItem = {
  name: string;
  duration_min: number;
  price: number;
};

type HoursValue =
  | {
      closed: true;
    }
  | {
      open: string;
      close: string;
    };

type ShopDetail = {
  id: string;
  name: string;
  brand_slug?: string | null;
  phone_number: string;
  user_phone: string;
  handoff_phone?: string | null;
  user_name?: string | null;
  address?: string | null;
  timezone: string;
  services: ServiceItem[];
  hours: Record<string, HoursValue>;
  cancel_policy: string;
  promotions?: string | null;
  booking_url?: string | null;
  ai_voice?: string | null;
  ai_welcome_message?: string | null;
  ai_custom_instructions?: string | null;
  allow_transfers: boolean;
  allow_callbacks: boolean;
  send_reminder_sms: boolean;
  send_review_request_sms: boolean;
  send_missed_call_followup_sms: boolean;
  plan: string;
  active: boolean;
};

type CallsPagination = {
  page: number;
  pageSize: number;
  total: number;
};


type ShopLocation = {
  id: string;
  shopId: string;
  name: string;
  address?: string | null;
  timezone: string;
  phoneNumber?: string | null;
  telnyxNumber?: string | null;
  businessHours: Record<string, unknown>;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ShopRoutingRule = {
  id: string;
  shopId: string;
  locationId?: string | null;
  ruleType: string;
  conditionJson: Record<string, unknown>;
  actionJson: Record<string, unknown>;
  priority: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type CommercialAccount = {
  shopId: string;
  contractStatus: 'draft' | 'sent' | 'signed' | 'active' | 'paused' | 'terminated';
  monthlyMinimumCents?: number | null;
  setupFeeCents?: number | null;
  includedLocations?: number | null;
  includedMinutes?: number | null;
  includedCapturedCallers?: number | null;
  maxConcurrentLiveCalls?: number | null;
  maxCallDurationSeconds?: number | null;
  overageRateCents?: number | null;
  billingMethod: 'manual_invoice' | 'paddle_custom' | 'wire' | 'ach' | 'other';
  contractSignedAt?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
};

type LoadShopResponse = {
  ok: boolean;
  shop?: ShopDetail;
  adminStatus?: AdminShopStatus;
  commercialGoLiveApprovalEvents?: CommercialGoLiveApprovalEvent[];
  shopLocations?: ShopLocation[];
  shopRoutingRules?: ShopRoutingRule[];
  commercialAccount?: CommercialAccount | null;
  error?: string;
};

type CommercialGoLiveApprovalEvent = {
  id: string;
  shopId: string;
  eventType: 'approved';
  actorEmail: string;
  note?: string | null;
  createdAt: string;
};

type CallsListResponse = {
  ok: boolean;
  recentCalls?: ShopCall[];
  callsPagination?: CallsPagination;
  filter?: { dateFrom: string | null; dateTo: string | null };
  error?: string;
};

type ShopCall = {
  provider: string;
  providerCallId: string;
  shopId: string;
  callerPhone?: string;
  destinationPhone?: string;
  requestId?: string;
  roomName?: string;
  startedAt?: string;
  endedAt?: string;
  agentJoined: boolean;
  humanAnswered: boolean;
  transcriptStatus?: string;
  transcriptText?: string;
  outcome?: string;
};

type BookingRow = {
  id: string;
  customerPhone: string;
  customerName?: string | null;
  service: string;
  datetimeUtc: string;
  timezone: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

type AnalyticsResponse = {
  ok: boolean;
  shopName?: string;
  period?: { dateFrom: string; dateTo: string };
  bookingsInPeriod?: number;
  byStatus?: Record<string, number>;
  bookingsUpdatedAfterCreate?: number;
  recentBookings?: BookingRow[];
  error?: string;
};

function formatShortDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

type ShopTab = 'overview' | 'info' | 'ai' | 'billing' | 'locations' | 'routing' | 'commercial' | 'calls' | 'analytics';

function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcDaysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
}

function checklistStatusLabel(status: AdminShopStatus['goLiveChecklist'][number]['status']) {
  if (status === 'complete') return 'Complete';
  if (status === 'blocked') return 'Blocked';
  if (status === 'not_required') return 'Not required';
  return 'Pending';
}

function checklistStatusStyle(status: AdminShopStatus['goLiveChecklist'][number]['status']) {
  if (status === 'complete') return { background: '#dcfce7', color: '#16a34a' };
  if (status === 'blocked') return { background: '#fee2e2', color: '#dc2626' };
  if (status === 'not_required') return { background: '#f1f5f9', color: '#475569' };
  return { background: '#fef3c7', color: '#d97706' };
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonField<T>(input: FormDataEntryValue | null, fallback: T): T {
  if (typeof input !== 'string' || input.trim().length === 0) return fallback;
  return JSON.parse(input) as T;
}

function TabIcon({ children }: { children: ReactNode }) {
  return <div className="nav-icon">{children}</div>;
}

export function AdminShopDetailLive() {
  const params = useParams<{ id: string }>();
  const shopId = params?.id;
  const [tab, setTab] = useState<ShopTab>('overview');
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [adminStatus, setAdminStatus] = useState<AdminShopStatus | null>(null);
  const [commercialApprovalEvents, setCommercialApprovalEvents] = useState<CommercialGoLiveApprovalEvent[]>([]);
  const [shopLocations, setShopLocations] = useState<ShopLocation[]>([]);
  const [shopRoutingRules, setShopRoutingRules] = useState<ShopRoutingRule[]>([]);
  const [commercialAccount, setCommercialAccount] = useState<CommercialAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [approvingCommercial, setApprovingCommercial] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [recentCalls, setRecentCalls] = useState<ShopCall[]>([]);
  const [callsPagination, setCallsPagination] = useState<CallsPagination | null>(null);
  const [callsPage, setCallsPage] = useState(1);
  const [callDateFrom, setCallDateFrom] = useState(() => utcDaysAgoIso(30));
  const [callDateTo, setCallDateTo] = useState(() => utcTodayIso());
  const [appliedCallFrom, setAppliedCallFrom] = useState(() => utcDaysAgoIso(30));
  const [appliedCallTo, setAppliedCallTo] = useState(() => utcTodayIso());
  const [activeCall, setActiveCall] = useState<ShopCall | null>(null);
  const [callDetailOpen, setCallDetailOpen] = useState(false);
  const callDetailDialogRef = useRef<HTMLDialogElement>(null);
  const [callsLoading, setCallsLoading] = useState(false);

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState(() => utcDaysAgoIso(30));
  const [analyticsDateTo, setAnalyticsDateTo] = useState(() => utcTodayIso());
  const [appliedAnalyticsFrom, setAppliedAnalyticsFrom] = useState(() => utcDaysAgoIso(30));
  const [appliedAnalyticsTo, setAppliedAnalyticsTo] = useState(() => utcTodayIso());

  const prevShopIdRef = useRef<string | undefined>(undefined);

  const loadShop = useCallback(async () => {
    if (!shopId) return;
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}`);
      const body = (await response.json()) as LoadShopResponse;
      if (!body.ok || !body.shop) {
        setError(body.error ?? 'unable_to_load');
        setShop(null);
        setAdminStatus(null);
        return;
      }
      setError(null);
      setShop(body.shop);
      setAdminStatus(body.adminStatus ?? null);
      setCommercialApprovalEvents(body.commercialGoLiveApprovalEvents ?? []);
      setShopLocations(body.shopLocations ?? []);
      setShopRoutingRules(body.shopRoutingRules ?? []);
      setCommercialAccount(body.commercialAccount ?? null);
    } catch {
      setError('network_error');
      setShop(null);
      setAdminStatus(null);
      setCommercialApprovalEvents([]);
      setShopLocations([]);
      setShopRoutingRules([]);
      setCommercialAccount(null);
    }
  }, [shopId]);

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  useEffect(() => {
    const changed = prevShopIdRef.current !== shopId;
    prevShopIdRef.current = shopId;
    if (changed) {
      setTab('overview');
      setCallsPage(1);
      setActiveCall(null);
      setCallDetailOpen(false);
      const from = utcDaysAgoIso(30);
      const to = utcTodayIso();
      setCallDateFrom(from);
      setCallDateTo(to);
      setAppliedCallFrom(from);
      setAppliedCallTo(to);
      setAnalyticsDateFrom(from);
      setAnalyticsDateTo(to);
      setAppliedAnalyticsFrom(from);
      setAppliedAnalyticsTo(to);
      setRecentCalls([]);
      setCallsPagination(null);
      setAnalytics(null);
      setAdminStatus(null);
      setCommercialApprovalEvents([]);
      setShopLocations([]);
      setShopRoutingRules([]);
      setCommercialAccount(null);
    }
  }, [shopId]);

  const loadCalls = useCallback(
    async (page: number, from: string, to: string) => {
      if (!shopId) return;
      setCallsLoading(true);
      const qs = new URLSearchParams({
        callsPage: String(page),
        dateFrom: from,
        dateTo: to,
      });
      try {
        const response = await fetch(`/api/backend/admin/shops/${shopId}/calls?${qs.toString()}`);
        const body = (await response.json()) as CallsListResponse;
        if (!body.ok) {
          setError(body.error ?? 'unable_to_load_calls');
          setRecentCalls([]);
          setCallsPagination(null);
          return;
        }
        setError(null);
        const list = body.recentCalls ?? [];
        setRecentCalls(list);
        setCallsPagination(
          body.callsPagination ?? { page, pageSize: 20, total: list.length },
        );
        setActiveCall((prev) => {
          if (!prev) return null;
          const still = list.find((c) => c.providerCallId === prev.providerCallId && c.shopId === prev.shopId);
          return still ?? null;
        });
      } catch {
        setError('network_error');
        setRecentCalls([]);
        setCallsPagination(null);
      } finally {
        setCallsLoading(false);
      }
    },
    [shopId],
  );

  useEffect(() => {
    if (tab !== 'calls' || !shopId) return;
    void loadCalls(callsPage, appliedCallFrom, appliedCallTo);
  }, [tab, shopId, callsPage, appliedCallFrom, appliedCallTo, loadCalls]);

  const loadAnalytics = useCallback(async () => {
    if (!shopId) return;
    setAnalyticsLoading(true);
    const qs = new URLSearchParams({
      dateFrom: appliedAnalyticsFrom,
      dateTo: appliedAnalyticsTo,
    });
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}/analytics?${qs.toString()}`);
      const body = (await response.json()) as AnalyticsResponse;
      if (!body.ok) {
        setAnalytics({ ok: false, error: body.error ?? 'unable_to_load' });
        return;
      }
      setAnalytics(body);
    } catch {
      setAnalytics({ ok: false, error: 'network_error' });
    } finally {
      setAnalyticsLoading(false);
    }
  }, [shopId, appliedAnalyticsFrom, appliedAnalyticsTo]);

  useEffect(() => {
    if (tab !== 'analytics' || !shopId) return;
    void loadAnalytics();
  }, [tab, shopId, loadAnalytics]);

  useEffect(() => {
    const el = callDetailDialogRef.current;
    if (!el) return;
    if (callDetailOpen && activeCall) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [callDetailOpen, activeCall]);

  useEffect(() => {
    if (!activeCall) setCallDetailOpen(false);
  }, [activeCall]);

  useEffect(() => {
    if (tab !== 'calls') {
      setCallDetailOpen(false);
      setActiveCall(null);
    }
  }, [tab]);

  function applyCallFilters() {
    setCallsPage(1);
    setAppliedCallFrom(callDateFrom);
    setAppliedCallTo(callDateTo);
  }

  function applyAnalyticsFilters() {
    setAppliedAnalyticsFrom(analyticsDateFrom);
    setAppliedAnalyticsTo(analyticsDateTo);
  }

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopId || !shop) return;
    const formData = new FormData(event.currentTarget);
    setSavingProfile(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user_name: String(formData.get('user_name') ?? ''),
          user_phone: String(formData.get('user_phone') ?? ''),
          handoff_phone: String(formData.get('handoff_phone') ?? '') || null,
          address: String(formData.get('address') ?? '') || null,
          timezone: String(formData.get('timezone') ?? shop.timezone),
          cancel_policy: String(formData.get('cancel_policy') ?? shop.cancel_policy),
          promotions: String(formData.get('promotions') ?? '') || null,
          booking_url: String(formData.get('booking_url') ?? '') || null,
          services: parseJsonField(formData.get('services_json'), shop.services),
          hours: parseJsonField(formData.get('hours_json'), shop.hours),
        }),
      });
      const body = (await response.json()) as LoadShopResponse;
      if (!response.ok || !body.ok) {
        setError(body.error ?? 'save_failed');
        return;
      }
      await loadShop();
      setNotice('Business profile and policy saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'network_error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSaveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopId || !shop) return;
    const formData = new FormData(event.currentTarget);
    setSavingConfig(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}/config`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ai_voice: String(formData.get('ai_voice') ?? '') || null,
          ai_welcome_message: String(formData.get('ai_welcome_message') ?? '') || null,
          ai_custom_instructions: String(formData.get('ai_custom_instructions') ?? '') || null,
          allow_transfers: formData.get('allow_transfers') === 'on',
          allow_callbacks: formData.get('allow_callbacks') === 'on',
          send_reminder_sms: formData.get('send_reminder_sms') === 'on',
          send_review_request_sms: formData.get('send_review_request_sms') === 'on',
          send_missed_call_followup_sms: formData.get('send_missed_call_followup_sms') === 'on',
        }),
      });
      const body = (await response.json()) as LoadShopResponse;
      if (!response.ok || !body.ok) {
        setError(body.error ?? 'save_failed');
        return;
      }
      await loadShop();
      setNotice('AI and automation config saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'network_error');
    } finally {
      setSavingConfig(false);
    }
  }

  async function onSavePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopId || !shop) return;
    const formData = new FormData(event.currentTarget);
    setSavingPlan(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}/plan`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          plan: String(formData.get('plan') ?? shop.plan),
          active: formData.get('active') === 'on',
        }),
      });
      const body = (await response.json()) as LoadShopResponse;
      if (!response.ok || !body.ok) {
        setError(body.error ?? 'save_failed');
        return;
      }
      await loadShop();
      setNotice('Billing status updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'network_error');
    } finally {
      setSavingPlan(false);
    }
  }



  async function onApproveCommercialGoLive() {
    if (!shopId || !shop) return;
    setApprovingCommercial(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}/approve-commercial-go-live`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: 'Approved from admin shop detail.' }),
      });
      const body = (await response.json()) as LoadShopResponse & { alreadyApproved?: boolean };
      if (!response.ok || !body.ok) {
        setError(body.error ?? 'commercial_approval_failed');
        return;
      }
      await loadShop();
      setNotice(body.alreadyApproved ? 'Commercial go-live was already approved.' : 'Commercial go-live approved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'network_error');
    } finally {
      setApprovingCommercial(false);
    }
  }



  async function onCreateLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopId) return;
    const formData = new FormData(event.currentTarget);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}/locations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(formData.get('name') ?? ''),
          address: String(formData.get('address') ?? '') || null,
          timezone: String(formData.get('timezone') ?? shop?.timezone ?? 'America/Los_Angeles'),
          phoneNumber: String(formData.get('phoneNumber') ?? '') || null,
          telnyxNumber: String(formData.get('telnyxNumber') ?? '') || null,
          businessHours: parseJsonField(formData.get('businessHours'), {}),
          active: formData.get('active') === 'on',
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setError(body.error ?? 'location_save_failed');
        return;
      }
      event.currentTarget.reset();
      await loadShop();
      setNotice('Location saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    }
  }

  async function onCreateRoutingRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopId) return;
    const formData = new FormData(event.currentTarget);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}/routing-rules`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locationId: String(formData.get('locationId') ?? '') || null,
          ruleType: String(formData.get('ruleType') ?? ''),
          conditionJson: parseJsonField(formData.get('conditionJson'), {}),
          actionJson: parseJsonField(formData.get('actionJson'), {}),
          priority: Number(formData.get('priority') ?? 100),
          active: formData.get('active') === 'on',
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setError(body.error ?? 'routing_rule_save_failed');
        return;
      }
      event.currentTarget.reset();
      await loadShop();
      setNotice('Routing rule saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    }
  }

  async function onSaveCommercialAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopId) return;
    const formData = new FormData(event.currentTarget);
    const nullableNumber = (key: string) => {
      const raw = String(formData.get(key) ?? '').trim();
      return raw ? Number(raw) : null;
    };
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/admin/shops/${shopId}/commercial-account`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contractStatus: String(formData.get('contractStatus') ?? 'draft'),
          monthlyMinimumCents: nullableNumber('monthlyMinimumCents'),
          setupFeeCents: nullableNumber('setupFeeCents'),
          includedLocations: nullableNumber('includedLocations'),
          includedMinutes: nullableNumber('includedMinutes'),
          includedCapturedCallers: nullableNumber('includedCapturedCallers'),
          maxConcurrentLiveCalls: nullableNumber('maxConcurrentLiveCalls'),
          maxCallDurationSeconds: nullableNumber('maxCallDurationSeconds'),
          overageRateCents: nullableNumber('overageRateCents'),
          billingMethod: String(formData.get('billingMethod') ?? 'manual_invoice'),
          contractSignedAt: String(formData.get('contractSignedAt') ?? '') || null,
          approvedAt: String(formData.get('approvedAt') ?? '') || null,
          notes: String(formData.get('notes') ?? '') || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setError(body.error ?? 'commercial_account_save_failed');
        return;
      }
      await loadShop();
      setNotice('Commercial account saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    }
  }

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  return (
    <AdminLayout
      styles={[...adminShopDetailStyles, ...adminSidebarAddonStyles]}
      scripts={adminShopDetailScripts}
      scriptPrefix="admin-shop-detail-live"
      bodyClass="app-body"
    >
      <div className="app-shell">
        <AdminSidebar />
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>{shop ? shop.name : 'Business detail.'}</h1>
              <p>
                Manage profile, AI behavior, billing, call history with transcripts, and booking analytics for this
                salon.
              </p>
            </div>
            <div className="top-actions">
              <a className="btn" href="/admin/shops">
                Back to businesses
              </a>
              <a className="btn" href={`/admin/calls?shopId=${encodeURIComponent(shopId ?? '')}`}>
                Open in Calls
              </a>
              <button type="button" className="btn ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>

          {error ? <div className="note" style={{ marginBottom: 18 }}>{error}</div> : null}
          {notice ? <div className="note" style={{ marginBottom: 18 }}>{notice}</div> : null}

          {!shop ? (
            <div className="card">
              <p className="sub">Loading business…</p>
            </div>
          ) : (
            <>
              <div className="shop-tab-bar" role="tablist" aria-label="Business sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'overview'}
                  className={`shop-tab${tab === 'overview' ? ' active' : ''}`}
                  onClick={() => setTab('overview')}
                >
                  <TabIcon>
                    <IconOverview />
                  </TabIcon>
                  Business overview
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'info'}
                  className={`shop-tab${tab === 'info' ? ' active' : ''}`}
                  onClick={() => setTab('info')}
                >
                  <TabIcon>
                    <IconShop />
                  </TabIcon>
                  Business info
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'ai'}
                  className={`shop-tab${tab === 'ai' ? ' active' : ''}`}
                  onClick={() => setTab('ai')}
                >
                  <TabIcon>
                    <IconSliders />
                  </TabIcon>
                  Business AI config
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'billing'}
                  className={`shop-tab${tab === 'billing' ? ' active' : ''}`}
                  onClick={() => setTab('billing')}
                >
                  <TabIcon>
                    <IconBilling />
                  </TabIcon>
                  Business billing
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'locations'}
                  className={`shop-tab${tab === 'locations' ? ' active' : ''}`}
                  onClick={() => setTab('locations')}
                >
                  <TabIcon>
                    <IconShop />
                  </TabIcon>
                  Locations
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'routing'}
                  className={`shop-tab${tab === 'routing' ? ' active' : ''}`}
                  onClick={() => setTab('routing')}
                >
                  <TabIcon>
                    <IconSliders />
                  </TabIcon>
                  Routing rules
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'commercial'}
                  className={`shop-tab${tab === 'commercial' ? ' active' : ''}`}
                  onClick={() => setTab('commercial')}
                >
                  <TabIcon>
                    <IconBilling />
                  </TabIcon>
                  Commercial account
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'calls'}
                  className={`shop-tab${tab === 'calls' ? ' active' : ''}`}
                  onClick={() => setTab('calls')}
                >
                  <TabIcon>
                    <IconPhone />
                  </TabIcon>
                  Business calls
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'analytics'}
                  className={`shop-tab${tab === 'analytics' ? ' active' : ''}`}
                  onClick={() => setTab('analytics')}
                >
                  <TabIcon>
                    <IconOverview />
                  </TabIcon>
                  Business analytics
                </button>
              </div>

              <div className="shop-tab-panels">
                {tab === 'overview' && adminStatus ? (
                <section className="card admin-status-overview">
                  <div className="panel-head">
                    <div>
                      <h3>Status overview</h3>
                      <p className="sub">Billing, live answering, onboarding, and phone setup at a glance.</p>
                    </div>
                  </div>
                  <dl className="admin-status-dl">
                    <div className="admin-status-row">
                      <dt>Account</dt>
                      <dd>{adminStatus.accountStatus === 'active' ? 'Active' : 'Inactive'}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Plan</dt>
                      <dd>{shop.plan}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Trial</dt>
                      <dd>{adminTrialCardLabel(adminStatus)}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Trial started</dt>
                      <dd>{formatShortDateTime(adminStatus.trialStartedAt)}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Trial ends</dt>
                      <dd>{formatShortDateTime(adminStatus.trialEndsAt)}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Subscription</dt>
                      <dd>{adminSubscriptionLabel(adminStatus)}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Payment method</dt>
                      <dd>{adminPaymentMethodLabel(adminStatus)}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Live answering</dt>
                      <dd>{adminLiveAnsweringLabel(adminStatus)}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Can go live</dt>
                      <dd>{adminStatus.canGoLive ? 'Yes' : 'No'}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Block reason</dt>
                      <dd>{adminBlockReasonLabel(adminStatus)}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Commercial approval</dt>
                      <dd>
                        {adminStatus.commercialGoLiveApproved ? 'Approved' : shop.plan === 'enterprise' ? 'Required' : 'Not required'}
                      </dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Approved at</dt>
                      <dd>{formatShortDateTime(adminStatus.commercialGoLiveApprovedAt)}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Onboarding</dt>
                      <dd>{adminOnboardingLabel(adminStatus)}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Phone setup</dt>
                      <dd>{adminPhoneSetupLabel(adminStatus)}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>Business number</dt>
                      <dd>{adminStatus.businessPhone ?? '—'}</dd>
                    </div>
                    <div className="admin-status-row">
                      <dt>RingBooker / Telnyx number</dt>
                      <dd>{adminStatus.telnyxNumber ?? '—'}</dd>
                    </div>
                  </dl>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 12,
                      marginTop: 18,
                    }}
                  >
                    <section className="card soft" style={{ margin: 0, boxShadow: 'none' }}>
                      <div className="panel-head" style={{ marginBottom: 12 }}>
                        <div>
                          <h3>Go-live checklist</h3>
                          <p className="sub">Operational gates for Custom / Enterprise launch readiness.</p>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {adminStatus.goLiveChecklist.map((item) => {
                          const badgeStyle = checklistStatusStyle(item.status);
                          return (
                            <div
                              key={item.id}
                              style={{
                                border: '1px solid rgba(255,255,255,.08)',
                                borderRadius: 12,
                                padding: 12,
                                background: 'rgba(255,255,255,.03)',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                <strong style={{ fontSize: 13 }}>{item.label}</strong>
                                <span
                                  style={{
                                    ...badgeStyle,
                                    borderRadius: 999,
                                    padding: '2px 8px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {checklistStatusLabel(item.status)}
                                </span>
                              </div>
                              <p className="sub" style={{ margin: '6px 0 0' }}>
                                {item.detail}
                              </p>
                              {item.completedAt ? (
                                <p className="sub" style={{ margin: '6px 0 0', fontSize: 11 }}>
                                  Completed: {formatShortDateTime(item.completedAt)}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                    <section className="card soft" style={{ margin: 0, boxShadow: 'none' }}>
                      <div className="panel-head" style={{ marginBottom: 12 }}>
                        <div>
                          <h3>Go-live timeline</h3>
                          <p className="sub">Key operational events recorded for this shop.</p>
                        </div>
                      </div>
                      {adminStatus.goLiveTimeline.length ? (
                        <div style={{ display: 'grid', gap: 10 }}>
                          {adminStatus.goLiveTimeline.map((event) => (
                            <div key={`${event.id}-${event.occurredAt}`} style={{ display: 'grid', gap: 3 }}>
                              <strong style={{ fontSize: 13 }}>{event.label}</strong>
                              <span className="sub" style={{ fontSize: 11 }}>
                                {formatShortDateTime(event.occurredAt)}
                              </span>
                              <span className="sub">{event.detail}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="sub">No go-live events recorded yet.</p>
                      )}
                    </section>
                  </div>
                </section>
              ) : null}

                {tab === 'info' ? (
                  <>
                    <section className="grid grid-3" style={{ marginBottom: 18 }}>
                      <div className="stat-card">
                        <div className="stat-top">
                          <div className="stat-icon">
                            <svg viewBox="0 0 24 24">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" />
                            </svg>
                          </div>
                          <span className={`tag ${shop.allow_transfers ? 'green' : 'orange'}`}>
                            {shop.allow_transfers ? 'Transfers on' : 'Transfers off'}
                          </span>
                        </div>
                        <div className="stat-value">{shop.allow_callbacks ? 'Live' : 'Paused'}</div>
                        <div className="stat-meta">Callback workflow is {shop.allow_callbacks ? 'enabled' : 'disabled'}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-top">
                          <div className="stat-icon">
                            <svg viewBox="0 0 24 24">
                              <rect x={3} y={5} width={18} height={14} rx={2} />
                              <path d="M3 10h18" />
                            </svg>
                          </div>
                          <span className="tag purple">{shop.plan}</span>
                        </div>
                        <div className="stat-value">{shop.active ? 'Active' : 'Paused'}</div>
                        <div className="stat-meta">Plan and activation</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-top">
                          <div className="stat-icon">
                            <svg viewBox="0 0 24 24">
                              <path d="M3 12h4l2-5 4 10 2-5h6" />
                            </svg>
                          </div>
                          <span className="tag blue">{shop.ai_voice ?? 'Aoede'}</span>
                        </div>
                        <div className="stat-value">{shop.send_reminder_sms ? 'SMS on' : 'SMS off'}</div>
                        <div className="stat-meta">Automation toggles (see AI tab)</div>
                      </div>
                    </section>
                    <form className="shop-info-stack" onSubmit={onSaveProfile}>
                      <section className="card">
                        <div className="panel-head">
                          <div>
                            <h3>Business profile</h3>
                            <p className="sub">Identity, contact, location, and booking link used across the product.</p>
                          </div>
                        </div>
                        <div className="form-grid">
                          <div className="field">
                            <label>Business name</label>
                            <input value={shop.name} readOnly />
                          </div>
                          <div className="field">
                            <label>Timezone</label>
                            <input name="timezone" defaultValue={shop.timezone} />
                          </div>
                          <div className="field">
                            <label>Representative name</label>
                            <input name="user_name" defaultValue={shop.user_name ?? ''} />
                          </div>
                          <div className="field">
                            <label>Representative phone</label>
                            <input name="user_phone" defaultValue={shop.user_phone} />
                          </div>
                          <div className="field">
                            <label>Handoff phone</label>
                            <input name="handoff_phone" defaultValue={shop.handoff_phone ?? ''} />
                          </div>
                          <div className="field">
                            <label>Booking URL</label>
                            <input name="booking_url" defaultValue={shop.booking_url ?? ''} />
                          </div>
                          <div className="field" style={{ gridColumn: '1 / -1' }}>
                            <label>Address</label>
                            <textarea name="address" defaultValue={shop.address ?? ''} />
                          </div>
                        </div>
                      </section>
                      <section className="card">
                        <div className="panel-head">
                          <div>
                            <h3>Business policy</h3>
                            <p className="sub">Cancellation rules, promotions, services catalog, and hours (JSON).</p>
                          </div>
                        </div>
                        <div className="form-grid">
                          <div className="field" style={{ gridColumn: '1 / -1' }}>
                            <label>Cancel policy</label>
                            <textarea name="cancel_policy" defaultValue={shop.cancel_policy} />
                          </div>
                          <div className="field" style={{ gridColumn: '1 / -1' }}>
                            <label>Promotions</label>
                            <textarea name="promotions" defaultValue={shop.promotions ?? ''} />
                          </div>
                          <div className="field" style={{ gridColumn: '1 / -1' }}>
                            <label>Services JSON</label>
                            <textarea name="services_json" defaultValue={prettyJson(shop.services)} />
                          </div>
                          <div className="field" style={{ gridColumn: '1 / -1' }}>
                            <label>Hours JSON</label>
                            <textarea name="hours_json" defaultValue={prettyJson(shop.hours)} />
                          </div>
                        </div>
                      </section>
                      <div className="top-actions" style={{ justifyContent: 'flex-start' }}>
                        <button className="btn purple" type="submit" disabled={savingProfile}>
                          {savingProfile ? 'Saving…' : 'Save profile & policy'}
                        </button>
                      </div>
                    </form>
                  </>
                ) : null}

                {tab === 'ai' ? (
                  <form className="card shop-ai-layout" onSubmit={onSaveConfig}>
                    <div className="panel-head">
                      <div>
                        <h3>AI configuration</h3>
                        <p className="sub">Voice agent behavior, call handling, and outbound SMS automation.</p>
                      </div>
                    </div>
                    <section className="card soft shop-ai-hero" style={{ margin: 0, boxShadow: 'none' }}>
                      <div className="shop-ai-panel-head">
                        <h4>Voice & prompts</h4>
                        <p>Model voice id and what the assistant says on the line.</p>
                      </div>
                      <div className="form-grid">
                        <div className="field">
                          <label>AI voice</label>
                          <input name="ai_voice" defaultValue={shop.ai_voice ?? 'Aoede'} placeholder="e.g. Aoede" />
                        </div>
                        <div className="field" style={{ gridColumn: '1 / -1' }}>
                          <label>Welcome message</label>
                          <textarea
                            name="ai_welcome_message"
                            rows={4}
                            defaultValue={shop.ai_welcome_message ?? ''}
                            placeholder="Opening line when the call connects…"
                          />
                        </div>
                        <div className="field" style={{ gridColumn: '1 / -1' }}>
                          <label>Custom instructions</label>
                          <textarea
                            name="ai_custom_instructions"
                            rows={6}
                            defaultValue={shop.ai_custom_instructions ?? ''}
                            placeholder="Business-specific rules, tone, services to mention…"
                          />
                        </div>
                      </div>
                    </section>
                    <div className="shop-ai-cols">
                      <section className="shop-ai-panel">
                        <div className="shop-ai-panel-head">
                          <h4>Call handling</h4>
                          <p>Transfers and callback workflow for this business.</p>
                        </div>
                        <div className="shop-ai-toggle-grid">
                          <label className="checkbox">
                            <input name="allow_transfers" type="checkbox" defaultChecked={shop.allow_transfers} />
                            Allow live transfers to staff
                          </label>
                          <label className="checkbox">
                            <input name="allow_callbacks" type="checkbox" defaultChecked={shop.allow_callbacks} />
                            Allow scheduling return calls
                          </label>
                        </div>
                      </section>
                      <section className="shop-ai-panel">
                        <div className="shop-ai-panel-head">
                          <h4>SMS automation</h4>
                          <p>Outbound text jobs tied to bookings and missed calls.</p>
                        </div>
                        <div className="shop-ai-toggle-grid">
                          <label className="checkbox">
                            <input name="send_reminder_sms" type="checkbox" defaultChecked={shop.send_reminder_sms} />
                            Appointment reminder SMS
                          </label>
                          <label className="checkbox">
                            <input
                              name="send_review_request_sms"
                              type="checkbox"
                              defaultChecked={shop.send_review_request_sms}
                            />
                            Post-visit review request SMS
                          </label>
                          <label className="checkbox">
                            <input
                              name="send_missed_call_followup_sms"
                              type="checkbox"
                              defaultChecked={shop.send_missed_call_followup_sms}
                            />
                            Missed-call follow-up SMS
                          </label>
                        </div>
                      </section>
                    </div>
                    <div className="top-actions" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
                      <button className="btn purple" type="submit" disabled={savingConfig}>
                        {savingConfig ? 'Saving…' : 'Save AI configuration'}
                      </button>
                    </div>
                  </form>
                ) : null}

                {tab === 'billing' ? (
                  <>
                    <section className="card" style={{ marginBottom: 18, borderColor: adminStatus?.commercialGoLiveApproved ? '#bbf7d0' : '#fde68a' }}>
                        <div className="panel-head">
                          <div>
                            <h3>Commercial go-live approval</h3>
                            <p className="sub">
                              Enterprise / Custom shops require manual commercial approval before forwarding number provisioning, forwarding tests, manual confirmation, or live answering.
                            </p>
                          </div>
                        </div>
                        <dl className="admin-status-dl">
                          <div className="admin-status-row">
                            <dt>Status</dt>
                            <dd>
                              {shop.plan === 'enterprise'
                                ? adminStatus?.commercialGoLiveApproved
                                  ? 'Approved'
                                  : 'Pending approval'
                                : 'Not required for this plan'}
                            </dd>
                          </div>
                          <div className="admin-status-row">
                            <dt>Approved by</dt>
                            <dd>{adminStatus?.commercialGoLiveApprovedBy ?? '—'}</dd>
                          </div>
                          <div className="admin-status-row">
                            <dt>Note</dt>
                            <dd>{adminStatus?.commercialGoLiveApprovalNote ?? '—'}</dd>
                          </div>
                        </dl>
                        {commercialApprovalEvents.length ? (
                          <div style={{ marginTop: 18 }}>
                            <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Approval history</h4>
                            <div style={{ display: 'grid', gap: 10 }}>
                              {commercialApprovalEvents.map((event) => (
                                <div
                                  key={event.id}
                                  style={{
                                    border: '1px solid rgba(255,255,255,.08)',
                                    borderRadius: 12,
                                    padding: 12,
                                    background: 'rgba(255,255,255,.03)',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                    <strong style={{ fontSize: 13 }}>Approved</strong>
                                    <span className="sub" style={{ fontSize: 11 }}>
                                      {formatShortDateTime(event.createdAt)}
                                    </span>
                                  </div>
                                  <p className="sub" style={{ margin: '6px 0 0' }}>
                                    By {event.actorEmail}
                                  </p>
                                  {event.note ? (
                                    <p className="sub" style={{ margin: '6px 0 0' }}>
                                      {event.note}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {shop.plan === 'enterprise' && !adminStatus?.commercialGoLiveApproved ? (
                          <div className="top-actions" style={{ marginTop: 18, justifyContent: 'flex-start' }}>
                            <button className="btn purple" type="button" disabled={approvingCommercial} onClick={() => void onApproveCommercialGoLive()}>
                              {approvingCommercial ? 'Approving…' : 'Approve commercial go-live'}
                            </button>
                          </div>
                        ) : null}
                      </section>
                    <form className="card" onSubmit={onSavePlan}>
                    <div className="panel-head">
                      <div>
                        <h3>Billing and activation</h3>
                        <p className="sub">Plan tier and whether the business account is active.</p>
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>Plan</label>
                        <select name="plan" defaultValue={shop.plan}>
                          <option value="starter">starter</option>
                          <option value="professional">professional</option>
                          <option value="enterprise">enterprise</option>
                        </select>
                      </div>
                      <div className="field" style={{ alignSelf: 'end' }}>
                        <label>Activation</label>
                        <label className="checkbox">
                          <input name="active" type="checkbox" defaultChecked={shop.active} />
                          Business is active
                        </label>
                      </div>
                    </div>
                    <div className="top-actions" style={{ marginTop: 18, justifyContent: 'flex-start' }}>
                      <button className="btn purple" type="submit" disabled={savingPlan}>
                        {savingPlan ? 'Saving…' : 'Save billing state'}
                      </button>
                    </div>
                  </form>
                  </>
                ) : null}


                {tab === 'locations' ? (
                  <section className="card">
                    <div className="panel-head"><div><h3>Locations</h3><p className="sub">Enterprise location records for staged go-live, location-specific phone setup, and future routing.</p></div></div>
                    <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
                      {shopLocations.length ? shopLocations.map((location) => (
                        <div key={location.id} className="card soft" style={{ margin: 0, boxShadow: 'none' }}>
                          <strong>{location.name}</strong>
                          <p className="sub">{location.address || 'No address'} · {location.timezone} · {location.active ? 'Active' : 'Inactive'}</p>
                          <p className="sub">Phone: {location.phoneNumber || '—'} · Forwarding: {location.telnyxNumber || '—'}</p>
                        </div>
                      )) : <p className="sub">No locations configured yet.</p>}
                    </div>
                    <form className="form-grid" onSubmit={onCreateLocation}>
                      <div className="field"><label>Name</label><input name="name" required placeholder="Downtown location" /></div>
                      <div className="field"><label>Timezone</label><input name="timezone" defaultValue={shop.timezone} /></div>
                      <div className="field"><label>Business phone</label><input name="phoneNumber" placeholder="+1..." /></div>
                      <div className="field"><label>Forwarding number</label><input name="telnyxNumber" placeholder="+1..." /></div>
                      <div className="field" style={{ gridColumn: '1 / -1' }}><label>Address</label><input name="address" /></div>
                      <div className="field" style={{ gridColumn: '1 / -1' }}><label>Business hours JSON</label><textarea name="businessHours" defaultValue="{}" /></div>
                      <label className="checkbox"><input name="active" type="checkbox" defaultChecked /> Active</label>
                      <div className="top-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-start' }}><button className="btn purple" type="submit">Add location</button></div>
                    </form>
                  </section>
                ) : null}

                {tab === 'routing' ? (
                  <section className="card">
                    <div className="panel-head"><div><h3>Routing rules</h3><p className="sub">Active rules are available to runtime prompts for custom routing and escalation behavior.</p></div></div>
                    <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
                      {shopRoutingRules.length ? shopRoutingRules.map((rule) => (
                        <div key={rule.id} className="card soft" style={{ margin: 0, boxShadow: 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{rule.ruleType}</strong><span className={`tag ${rule.active ? 'green' : 'orange'}`}>{rule.active ? 'Active' : 'Inactive'} · priority {rule.priority}</span></div>
                          <p className="sub">Condition: {JSON.stringify(rule.conditionJson)}</p>
                          <p className="sub">Action: {JSON.stringify(rule.actionJson)}</p>
                        </div>
                      )) : <p className="sub">No routing rules configured yet.</p>}
                    </div>
                    <form className="form-grid" onSubmit={onCreateRoutingRule}>
                      <div className="field"><label>Rule type</label><input name="ruleType" required placeholder="language_route, complaint_escalation" /></div>
                      <div className="field"><label>Priority</label><input name="priority" type="number" defaultValue="100" /></div>
                      <div className="field" style={{ gridColumn: '1 / -1' }}><label>Location</label><select name="locationId"><option value="">No specific location</option>{shopLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
                      <div className="field" style={{ gridColumn: '1 / -1' }}><label>Condition JSON</label><textarea name="conditionJson" defaultValue={'{"language":"vi"}'} /></div>
                      <div className="field" style={{ gridColumn: '1 / -1' }}><label>Action JSON</label><textarea name="actionJson" defaultValue={'{"action":"escalate_to_owner"}'} /></div>
                      <label className="checkbox"><input name="active" type="checkbox" defaultChecked /> Active</label>
                      <div className="top-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-start' }}><button className="btn purple" type="submit">Add routing rule</button></div>
                    </form>
                  </section>
                ) : null}

                {tab === 'commercial' ? (
                  <form className="card" onSubmit={onSaveCommercialAccount}>
                    <div className="panel-head"><div><h3>Commercial account</h3><p className="sub">Internal Enterprise contract, invoice, included usage, and commercial terms.</p></div></div>
                    <div className="form-grid">
                      <div className="field"><label>Contract status</label><select name="contractStatus" defaultValue={commercialAccount?.contractStatus ?? 'draft'}>{['draft','sent','signed','active','paused','terminated'].map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
                      <div className="field"><label>Billing method</label><select name="billingMethod" defaultValue={commercialAccount?.billingMethod ?? 'manual_invoice'}>{['manual_invoice','paddle_custom','wire','ach','other'].map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
                      <div className="field"><label>Monthly minimum cents</label><input name="monthlyMinimumCents" type="number" defaultValue={commercialAccount?.monthlyMinimumCents ?? ''} /></div>
                      <div className="field"><label>Setup fee cents</label><input name="setupFeeCents" type="number" defaultValue={commercialAccount?.setupFeeCents ?? ''} /></div>
                      <div className="field"><label>Included locations</label><input name="includedLocations" type="number" defaultValue={commercialAccount?.includedLocations ?? ''} /></div>
                      <div className="field"><label>Included minutes</label><input name="includedMinutes" type="number" defaultValue={commercialAccount?.includedMinutes ?? ''} /></div>
                      <div className="field"><label>Included captured callers</label><input name="includedCapturedCallers" type="number" defaultValue={commercialAccount?.includedCapturedCallers ?? ''} /></div>
                      <div className="field"><label>Max concurrent live calls</label><input name="maxConcurrentLiveCalls" type="number" defaultValue={commercialAccount?.maxConcurrentLiveCalls ?? ''} /></div>
                      <div className="field"><label>Max call duration seconds</label><input name="maxCallDurationSeconds" type="number" defaultValue={commercialAccount?.maxCallDurationSeconds ?? ''} /></div>
                      <div className="field"><label>Overage rate cents</label><input name="overageRateCents" type="number" defaultValue={commercialAccount?.overageRateCents ?? ''} /></div>
                      <div className="field"><label>Contract signed at</label><input name="contractSignedAt" placeholder="2026-05-06T00:00:00.000Z" defaultValue={commercialAccount?.contractSignedAt ?? ''} /></div>
                      <div className="field"><label>Approved at</label><input name="approvedAt" placeholder="2026-05-06T00:00:00.000Z" defaultValue={commercialAccount?.approvedAt ?? ''} /></div>
                      <div className="field" style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea name="notes" defaultValue={commercialAccount?.notes ?? ''} /></div>
                    </div>
                    <div className="top-actions" style={{ marginTop: 18, justifyContent: 'flex-start' }}><button className="btn purple" type="submit">Save commercial account</button></div>
                  </form>
                ) : null}

                {tab === 'calls' ? (
                  <>
                    <section className="card soft" style={{ marginBottom: 18 }}>
                      <div className="panel-head">
                        <div>
                          <h3>Call date range (UTC)</h3>
                          <p className="sub">Filters by call start time. Then browse pages of 20 calls.</p>
                        </div>
                        <div className="top-actions" style={{ flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                            From
                            <input
                              className="btn ghost"
                              style={{ padding: '10px 14px', cursor: 'pointer', minWidth: 140 }}
                              type="date"
                              value={callDateFrom}
                              onChange={(e) => setCallDateFrom(e.target.value)}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                            To
                            <input
                              className="btn ghost"
                              style={{ padding: '10px 14px', cursor: 'pointer', minWidth: 140 }}
                              type="date"
                              value={callDateTo}
                              onChange={(e) => setCallDateTo(e.target.value)}
                            />
                          </label>
                          <button type="button" className="btn purple" style={{ alignSelf: 'flex-end' }} onClick={applyCallFilters}>
                            Apply
                          </button>
                        </div>
                      </div>
                    </section>

                    {callsLoading ? (
                      <p className="sub">Loading calls…</p>
                    ) : (
                      <div className="card">
                        <div className="panel-head">
                          <div>
                            <h3>Call logs</h3>
                            <p className="sub">Click a row to open transcript and metadata in a dialog.</p>
                          </div>
                        </div>
                        {callsPagination && callsPagination.total === 0 ? (
                          <div className="empty">No calls in this date range.</div>
                        ) : (
                          <>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="table">
                                <thead>
                                  <tr>
                                    <th>Caller</th>
                                    <th>Started</th>
                                    <th>Outcome</th>
                                    <th style={{ width: 100 }}> </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {recentCalls.length === 0 ? (
                                    <tr>
                                      <td colSpan={4}>
                                        <div className="sub" style={{ padding: '10px 0' }}>
                                          No rows on this page.
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    recentCalls.map((call) => {
                                      const isOpen =
                                        callDetailOpen &&
                                        activeCall?.providerCallId === call.providerCallId &&
                                        activeCall?.shopId === call.shopId;
                                      return (
                                        <tr
                                          key={`${call.shopId}:${call.providerCallId}`}
                                          style={{
                                            cursor: 'pointer',
                                            background: isOpen ? 'rgba(37,99,235,.1)' : undefined,
                                          }}
                                          onClick={() => {
                                            setActiveCall(call);
                                            setCallDetailOpen(true);
                                          }}
                                        >
                                          <td>{call.callerPhone ?? 'Unknown'}</td>
                                          <td>{formatDateTime(call.startedAt)}</td>
                                          <td>
                                            <span className={callOutcomeTagClass(call.outcome)}>
                                              {call.outcome ?? 'in_progress'}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="tag purple">
                                              Details
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                            {callsPagination && callsPagination.total > 0 ? (
                              <div
                                className="top-actions"
                                style={{ marginTop: 14, justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}
                              >
                                <p className="sub" style={{ margin: 0 }}>
                                  {callsPagination.total > callsPagination.pageSize ? (
                                    <>
                                      Page {callsPagination.page} of{' '}
                                      {Math.max(1, Math.ceil(callsPagination.total / callsPagination.pageSize))}
                                      <span style={{ opacity: 0.75 }}>
                                        {' '}
                                        · {callsPagination.total} calls · {callsPagination.pageSize} per page
                                      </span>
                                    </>
                                  ) : (
                                    <span style={{ opacity: 0.85 }}>
                                      {callsPagination.total} call{callsPagination.total === 1 ? '' : 's'}
                                    </span>
                                  )}
                                </p>
                                {callsPagination.total > callsPagination.pageSize ? (
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      type="button"
                                      className="btn ghost"
                                      disabled={callsPagination.page <= 1}
                                      onClick={() => setCallsPage((p) => Math.max(1, p - 1))}
                                    >
                                      Previous
                                    </button>
                                    <button
                                      type="button"
                                      className="btn ghost"
                                      disabled={callsPagination.page * callsPagination.pageSize >= callsPagination.total}
                                      onClick={() => setCallsPage((p) => p + 1)}
                                    >
                                      Next
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    )}

                    <dialog
                      ref={callDetailDialogRef}
                      className="rb-admin-modal"
                      onClose={() => {
                        setCallDetailOpen(false);
                        setActiveCall(null);
                      }}
                    >
                      {activeCall ? (
                        <>
                          <div className="rb-admin-modal-head">
                            <div>
                              <h3 style={{ margin: '0 0 6px' }}>Call detail</h3>
                              <p className="sub" style={{ margin: 0 }}>
                                {activeCall.callerPhone ?? 'Unknown'} · {formatDateTime(activeCall.startedAt)}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => callDetailDialogRef.current?.close()}
                            >
                              Close
                            </button>
                          </div>
                          <div className="rb-admin-modal-body">
                            <dl className="call-detail-dl">
                              <dt>Provider call id</dt>
                              <dd style={{ wordBreak: 'break-all' }}>{activeCall.providerCallId}</dd>
                              <dt>Outcome</dt>
                              <dd>{activeCall.outcome ?? 'in_progress'}</dd>
                              <dt>Transcript</dt>
                              <dd>
                                {activeCall.transcriptStatus === 'completed'
                                  ? 'Ready'
                                  : activeCall.transcriptStatus === 'failed'
                                    ? 'Failed'
                                    : 'Pending'}
                              </dd>
                              <dt>Room</dt>
                              <dd>{activeCall.roomName ?? '—'}</dd>
                              <dt>Request id</dt>
                              <dd style={{ wordBreak: 'break-all' }}>{activeCall.requestId ?? '—'}</dd>
                              <dt>Ended</dt>
                              <dd>{formatDateTime(activeCall.endedAt)}</dd>
                            </dl>
                            <p className="sub" style={{ margin: '0 0 8px' }}>
                              Transcript
                            </p>
                            <div className="call-detail-transcript">
                              {activeCall.transcriptText ? (
                                activeCall.transcriptText
                              ) : activeCall.transcriptStatus === 'completed' ? (
                                'Transcript marked ready but body is missing.'
                              ) : activeCall.transcriptStatus === 'failed' ? (
                                'Transcript generation failed.'
                              ) : (
                                'Transcript not available yet.'
                              )}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </dialog>
                  </>
                ) : null}

                {tab === 'analytics' ? (
                  <>
                    <section className="card soft" style={{ marginBottom: 18 }}>
                      <div className="panel-head">
                        <div>
                          <h3>Bookings period (UTC)</h3>
                          <p className="sub">Counts and recent rows use booking record `created_at` in this range.</p>
                        </div>
                        <div className="top-actions" style={{ flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                            From
                            <input
                              className="btn ghost"
                              style={{ padding: '10px 14px', cursor: 'pointer', minWidth: 140 }}
                              type="date"
                              value={analyticsDateFrom}
                              onChange={(e) => setAnalyticsDateFrom(e.target.value)}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                            To
                            <input
                              className="btn ghost"
                              style={{ padding: '10px 14px', cursor: 'pointer', minWidth: 140 }}
                              type="date"
                              value={analyticsDateTo}
                              onChange={(e) => setAnalyticsDateTo(e.target.value)}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn purple"
                            style={{ alignSelf: 'flex-end' }}
                            onClick={applyAnalyticsFilters}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </section>

                    {analyticsLoading ? (
                      <p className="sub">Loading analytics…</p>
                    ) : !analytics?.ok ? (
                      <div className="note">Unable to load analytics: {analytics?.error ?? 'unknown'}</div>
                    ) : (
                      <>
                        <section className="grid grid-3" style={{ marginBottom: 18 }}>
                          <div className="stat-card">
                            <div className="stat-top">
                              <span className="tag purple">Bookings</span>
                            </div>
                            <div className="stat-value">{analytics.bookingsInPeriod ?? 0}</div>
                            <div className="stat-meta">Records created in range</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-top">
                              <span className="tag green">Confirmed</span>
                            </div>
                            <div className="stat-value">{analytics.byStatus?.confirmed ?? 0}</div>
                            <div className="stat-meta">Status confirmed</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-top">
                              <span className="tag orange">Cancelled</span>
                            </div>
                            <div className="stat-value">{analytics.byStatus?.cancelled ?? 0}</div>
                            <div className="stat-meta">Status cancelled</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-top">
                              <span className="tag blue">Pending</span>
                            </div>
                            <div className="stat-value">{analytics.byStatus?.pending ?? 0}</div>
                            <div className="stat-meta">Awaiting confirmation</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-top">
                              <span className="tag blue">Completed</span>
                            </div>
                            <div className="stat-value">{analytics.byStatus?.completed ?? 0}</div>
                            <div className="stat-meta">Past appointment completed</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-top">
                              <span className="tag orange">No-show</span>
                            </div>
                            <div className="stat-value">{analytics.byStatus?.no_show ?? 0}</div>
                            <div className="stat-meta">Marked no_show</div>
                          </div>
                        </section>

                        <div className="card" style={{ marginBottom: 18 }}>
                          <div className="panel-head">
                            <div>
                              <h3>Reschedule / updates signal</h3>
                              <p className="sub">
                                Bookings where `updated_at` differs from `created_at` (includes reschedules and edits).{' '}
                                <strong>{analytics.bookingsUpdatedAfterCreate ?? 0}</strong> in this sample (same
                                period, up to 5000 rows).
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="card">
                          <div className="panel-head">
                            <div>
                              <h3>Recent bookings</h3>
                              <p className="sub">Newest by appointment time in this period.</p>
                            </div>
                          </div>
                          {(analytics.recentBookings ?? []).length === 0 ? (
                            <div className="empty">No booking rows in this period.</div>
                          ) : (
                            <div style={{ overflowX: 'auto' }}>
                              <table className="table">
                                <thead>
                                  <tr>
                                    <th>When (UTC)</th>
                                    <th>Service</th>
                                    <th>Customer</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(analytics.recentBookings ?? []).map((b) => (
                                    <tr key={b.id}>
                                      <td>{formatDateTime(b.datetimeUtc)}</td>
                                      <td>{b.service}</td>
                                      <td>{b.customerName ?? b.customerPhone}</td>
                                      <td>
                                        <span className="tag blue">{b.status}</span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            </>
          )}
        </main>
      </div>
    </AdminLayout>
  );
}
