'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ServiceItem = {
  name: string;
  duration_min: number;
  price: number;
};

type BusinessHours = Record<string, { closed: true } | { open: string; close: string }>;

type OnboardingStatusResponse = {
  ok: boolean;
  onboardingRequired?: boolean;
  shop?: {
    id: string;
    name: string;
    user_name?: string;
    user_phone?: string;
    timezone: string;
    cancel_policy: string;
    services: ServiceItem[];
    hours: BusinessHours;
  };
  error?: string;
};

function defaultBusinessHours(): BusinessHours {
  return {
    mon: { open: '09:00', close: '18:00' },
    tue: { open: '09:00', close: '18:00' },
    wed: { open: '09:00', close: '18:00' },
    thu: { open: '09:00', close: '18:00' },
    fri: { open: '09:00', close: '18:00' },
    sat: { open: '09:00', close: '16:00' },
    sun: { closed: true },
  };
}

export function UserOnboardingLive() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [cancelPolicy, setCancelPolicy] = useState('24-hour cancellation policy.');
  const [serviceName, setServiceName] = useState('Haircut');
  const [serviceDuration, setServiceDuration] = useState(45);
  const [servicePrice, setServicePrice] = useState(45);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch('/api/backend/user/onboarding-status')
      .then(async (response) => (await response.json()) as OnboardingStatusResponse)
      .then((body) => {
        if (!body.ok) {
          setStatus(body.error ?? 'unable_to_load');
          return;
        }
        if (!body.onboardingRequired) {
          router.replace('/user');
          return;
        }
        if (body.shop) {
          setName(body.shop.user_name ?? '');
          setPhone(body.shop.user_phone ?? '');
          setTimezone(body.shop.timezone || 'America/Los_Angeles');
          setCancelPolicy(body.shop.cancel_policy || '24-hour cancellation policy.');
          if (body.shop.services?.[0]) {
            setServiceName(body.shop.services[0].name);
            setServiceDuration(body.shop.services[0].duration_min);
            setServicePrice(body.shop.services[0].price);
          }
        }
      })
      .catch(() => setStatus('network_error'))
      .finally(() => setLoading(false));
  }, [router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    const response = await fetch('/api/backend/user/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_name: name,
        user_phone: phone,
        timezone,
        cancel_policy: cancelPolicy,
        services: [
          {
            name: serviceName,
            duration_min: serviceDuration,
            price: servicePrice,
          },
        ],
        hours: defaultBusinessHours(),
      }),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !body?.ok) {
      setStatus(body?.error ?? 'save_failed');
      setSaving(false);
      return;
    }
    setStatus('saved');
    router.replace('/user');
    router.refresh();
  }

  if (loading) return <p style={{ padding: 24 }}>Loading onboarding...</p>;

  return (
    <section style={{ maxWidth: 680, margin: '24px auto', padding: 16 }}>
      <h2 style={{ marginBottom: 8 }}>Welcome to RingBooker</h2>
      <p style={{ marginTop: 0, color: '#64748b', marginBottom: 16 }}>
        Complete this quick setup once. You can edit everything later in Settings.
      </p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          Your name
          <input required value={name} onChange={(event) => setName(event.target.value)} style={{ width: '100%', padding: 10, marginTop: 4 }} />
        </label>
        <label>
          Business phone
          <input required value={phone} onChange={(event) => setPhone(event.target.value)} style={{ width: '100%', padding: 10, marginTop: 4 }} />
        </label>
        <label>
          Timezone
          <input required value={timezone} onChange={(event) => setTimezone(event.target.value)} style={{ width: '100%', padding: 10, marginTop: 4 }} />
        </label>
        <label>
          Default cancel policy
          <textarea
            required
            value={cancelPolicy}
            onChange={(event) => setCancelPolicy(event.target.value)}
            style={{ width: '100%', minHeight: 80, padding: 10, marginTop: 4 }}
          />
        </label>
        <h3 style={{ margin: '6px 0 0' }}>First service</h3>
        <label>
          Service name
          <input required value={serviceName} onChange={(event) => setServiceName(event.target.value)} style={{ width: '100%', padding: 10, marginTop: 4 }} />
        </label>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <label>
            Duration (min)
            <input
              type="number"
              min={5}
              step={5}
              required
              value={serviceDuration}
              onChange={(event) => setServiceDuration(Number(event.target.value))}
              style={{ width: '100%', padding: 10, marginTop: 4 }}
            />
          </label>
          <label>
            Price
            <input
              type="number"
              min={0}
              step={1}
              required
              value={servicePrice}
              onChange={(event) => setServicePrice(Number(event.target.value))}
              style={{ width: '100%', padding: 10, marginTop: 4 }}
            />
          </label>
        </div>
        <button type="submit" disabled={saving} style={{ padding: 11 }}>
          {saving ? 'Saving...' : 'Finish setup and go to dashboard'}
        </button>
      </form>
      {status ? <p style={{ marginTop: 10 }}>{status}</p> : null}
    </section>
  );
}
