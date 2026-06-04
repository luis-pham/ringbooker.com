import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildMetadata } from '@/lib/site';
import { TryDemoClient, type PreparedDemo } from './try-demo-client';

// Prepared demos are per-lead and short-lived — always render fresh, never cache/index.
export const dynamic = 'force-dynamic';

type RouteProps = { params: Promise<{ slug: string }> };

type LoadResult =
  | { status: 'ok'; demo: PreparedDemo }
  | { status: 'expired' }
  | { status: 'missing' };

// Per-vertical demo phone (same env the public /demo/<vertical> pages use), so the
// /try page shows the matching alternate call-in number. Falls back to the shared line.
const DEMO_PHONE_ENV_BY_VERTICAL: Record<string, string | undefined> = {
  'nail-salon': process.env.DEMO_PHONE_NAIL_SALON,
  'hair-salon': process.env.DEMO_PHONE_HAIR_SALON,
  'day-spa': process.env.DEMO_PHONE_DAY_SPA,
  'med-spa': process.env.DEMO_PHONE_MED_SPA,
  'beauty-clinic': process.env.DEMO_PHONE_BEAUTY_CLINIC,
};

function resolveDemoPhone(vertical: string): string | null {
  return DEMO_PHONE_ENV_BY_VERTICAL[vertical] ?? process.env.DEMO_PHONE_FALLBACK_VERTICAL ?? null;
}

async function loadPreparedDemo(slug: string): Promise<LoadResult> {
  const base = process.env.APP_BASE_URL?.replace(/\/+$/, '') ?? '';
  try {
    const res = await fetch(`${base}/api/backend/public/demo/prepared/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (res.status === 410) return { status: 'expired' };
    if (!res.ok) return { status: 'missing' };
    const json = (await res.json()) as { ok: boolean; demo?: PreparedDemo };
    if (!json.ok || !json.demo) return { status: 'missing' };
    return { status: 'ok', demo: json.demo };
  } catch {
    return { status: 'missing' };
  }
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadPreparedDemo(slug);
  const name = result.status === 'ok' ? result.demo.businessName : 'Your salon';
  return {
    ...buildMetadata({
      title: `${name} — Live AI Booking Demo | RingBooker`,
      description: `See how RingBooker answers calls and books appointments for ${name}.`,
      path: `/try/${slug}`,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function TryDemoPage({ params }: RouteProps) {
  const { slug } = await params;
  const result = await loadPreparedDemo(slug);

  if (result.status === 'missing') notFound();

  if (result.status === 'expired') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">This demo has expired</h1>
        <p className="mt-2 text-sm text-slate-600">
          The personalized demo link is no longer active. Reach out and we’ll send you a fresh one.
        </p>
        <a href="/demo" className="mt-6 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white">
          Explore live demos
        </a>
      </main>
    );
  }

  return <TryDemoClient demo={result.demo} demoPhoneE164={resolveDemoPhone(result.demo.vertical)} />;
}
