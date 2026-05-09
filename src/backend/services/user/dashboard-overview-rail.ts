import type { Shop } from '@/src/backend/domain/types';
import { parseSquareConnectionCredentials } from '@/src/backend/services/calendar/provider-connections';
import { parseVagaroCredentials } from '@/src/backend/services/calendar/vagaro';

export type DashboardOverviewRailCall = {
  requestId?: string;
  startedAt?: string;
  callerPhone?: string;
  outcome?: string;
  subtitle?: string | null;
};

export type DashboardOverviewRailChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  href: string;
};

export type DashboardOverviewRailHealthRow = {
  id: string;
  label: string;
  state: 'ok' | 'warn' | 'neutral';
  detail?: string;
  href?: string;
};

export type DashboardOverviewRail =
  | {
      variant: 'setup';
      title: string;
      subtitle?: string;
      checklist: DashboardOverviewRailChecklistItem[];
    }
  | {
      variant: 'live';
      title: string;
      subtitle?: string;
      health: DashboardOverviewRailHealthRow[];
      recentCalls: DashboardOverviewRailCall[];
      tip?: string;
    };

export function resolveCalendarBookingStatus(shop: Shop): { ready: boolean; detail: string } {
  const square = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
  const vagaro = parseVagaroCredentials(shop.google_cal_credentials_encrypted);
  const squareReady = Boolean(
    square?.access_token && square?.refresh_token && square?.location_id && square?.service_variation_id,
  );
  const vagaroReady = Boolean((vagaro?.accessToken || vagaro?.clientId) && vagaro?.region && vagaro?.businessId);
  const bookingUrlReady = Boolean(shop.booking_url?.trim());
  if (squareReady) return { ready: true, detail: 'Square Appointments configured' };
  if (vagaroReady) return { ready: true, detail: 'Vagaro connected' };
  if (bookingUrlReady) return { ready: true, detail: 'Booking link on file' };
  return { ready: false, detail: 'Connect Square, Vagaro, or add a booking link' };
}

type GoLiveOverviewInput = {
  liveCallsEnabled: boolean;
  forwardingSetupVerified: boolean;
  hasForwardingNumber: boolean;
  paymentMethodValid: boolean;
  commercialApprovalRequired?: boolean;
};

type UsageOverviewInput = {
  nearCapturedCallerLimit: boolean;
  overCapturedCallerLimit: boolean;
} | null;

export function buildDashboardOverviewRail(params: {
  shop: Shop;
  onboardingRequired: boolean;
  goLive: GoLiveOverviewInput | null;
  usage: UsageOverviewInput;
  recentCalls: DashboardOverviewRailCall[];
  totalCallCount: number;
}): DashboardOverviewRail {
  const { shop, onboardingRequired, goLive, usage, recentCalls, totalCallCount } = params;
  const calendar = resolveCalendarBookingStatus(shop);

  if (goLive?.commercialApprovalRequired) {
    return {
      variant: 'setup',
      title: 'Custom plan setup',
      subtitle: 'Implementation approval is required before live answering can be enabled.',
      checklist: [
        {
          id: 'approval',
          title: 'Awaiting RingBooker approval — contact support if you need an update',
          done: false,
          href: '/contact?topic=implementation',
        },
      ],
    };
  }

  if (onboardingRequired) {
    return {
      variant: 'setup',
      title: 'Finish business setup',
      subtitle: 'Complete the wizard so RingBooker knows your services, hours, and voice preferences.',
      checklist: [
        {
          id: 'wizard',
          title: 'Complete setup wizard',
          done: false,
          href: '/user/onboarding',
        },
      ],
    };
  }

  const live = goLive?.liveCallsEnabled === true;

  if (!live) {
    if (!goLive) {
      return {
        variant: 'setup',
        title: 'Account setup',
        subtitle: 'Finish billing connection so we can show your go-live steps.',
        checklist: [
          {
            id: 'billing',
            title: 'Open Billing to connect your subscription',
            done: false,
            href: '/user/billing',
          },
        ],
      };
    }

    const checklist: DashboardOverviewRailChecklistItem[] = [
      {
        id: 'payment',
        title: 'Add a valid payment method',
        done: goLive.paymentMethodValid,
        href: '/user/billing',
      },
      {
        id: 'forwarding_number',
        title: 'Provision or confirm your RingBooker forwarding number',
        done: goLive.hasForwardingNumber,
        href: '/user/settings#go-live-forwarding',
      },
      {
        id: 'forwarding_verify',
        title: 'Verify call forwarding (place a test call)',
        done: goLive.forwardingSetupVerified,
        href: '/user/settings#go-live-forwarding',
      },
      {
        id: 'live_enable',
        title: 'Enable live answering',
        done: goLive.liveCallsEnabled,
        href: '/user/settings#go-live-forwarding',
      },
    ];

    return {
      variant: 'setup',
      title: 'Go-live checklist',
      subtitle: 'Complete these steps so RingBooker can answer your business line.',
      checklist,
    };
  }

  if (!goLive) {
    return {
      variant: 'setup',
      title: 'Account setup',
      subtitle: 'Billing status is unavailable — open Billing to finish account connection.',
      checklist: [
        {
          id: 'billing',
          title: 'Open Billing',
          done: false,
          href: '/user/billing',
        },
      ],
    };
  }

  const health: DashboardOverviewRailHealthRow[] = [
    {
      id: 'live',
      label: 'Live answering',
      state: 'ok',
      detail: 'RingBooker can pick up forwarded calls.',
      href: '/user/settings#go-live-forwarding',
    },
    {
      id: 'forwarding',
      label: 'Call forwarding',
      state:
        goLive.forwardingSetupVerified && goLive.hasForwardingNumber
          ? 'ok'
          : goLive.hasForwardingNumber
            ? 'warn'
            : 'warn',
      detail:
        goLive.forwardingSetupVerified && goLive.hasForwardingNumber
          ? 'Verified'
          : goLive.hasForwardingNumber
            ? 'Not verified — run a forwarding test'
            : 'Forwarding number missing',
      href: '/user/settings#go-live-forwarding',
    },
    {
      id: 'calendar',
      label: 'Booking / calendar',
      state: calendar.ready ? 'ok' : 'neutral',
      detail: calendar.detail,
      href: '/user/settings#integrations',
    },
  ];

  if (usage?.overCapturedCallerLimit || usage?.nearCapturedCallerLimit) {
    health.push({
      id: 'usage',
      label: 'Monthly allowance',
      state: usage.overCapturedCallerLimit ? 'warn' : 'neutral',
      detail: usage.overCapturedCallerLimit
        ? 'Captured caller limit reached — upgrade or adjust plan'
        : 'Close to your captured caller limit',
      href: '/user/billing',
    });
  }

  let tip: string | undefined;
  if (recentCalls.length === 0 && totalCallCount === 0) {
    tip = 'No calls logged yet. Run a test call from the banner above, or place a call through your forwarding setup.';
  }

  return {
    variant: 'live',
    title: 'At a glance',
    subtitle: 'System status and recent calls.',
    health,
    recentCalls,
    tip,
  };
}
