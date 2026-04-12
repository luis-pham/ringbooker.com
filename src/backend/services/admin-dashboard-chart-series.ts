/** UTC bucket helpers for /admin dashboard charts. */

export type DashboardChartPeriod = 'today' | 'week' | 'month' | 'year';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function utcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfIsoWeekMonday(d: Date): Date {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  t.setUTCDate(t.getUTCDate() - diff);
  return t;
}

export type ChartRangeSpec = {
  period: DashboardChartPeriod;
  from: Date;
  to: Date;
  labels: string[];
  labelTitles: string[];
  bucketOf: (iso: string) => string | null;
};

/**
 * Builds ordered bucket labels and a classifier for timestamps (ISO strings, UTC).
 */
export function getChartRangeSpec(period: DashboardChartPeriod, now: Date): ChartRangeSpec {
  const to = now;
  if (period === 'today') {
    const from = startOfUtcDay(now);
    const labels: string[] = [];
    const labelTitles: string[] = [];
    for (let h = 0; h < 24; h += 1) {
      labels.push(pad2(h));
      labelTitles.push(`${pad2(h)}:00`);
    }
    const dayPrefix = utcDayKey(from);
    const bucketOf = (iso: string): string | null => {
      const t = new Date(iso);
      if (Number.isNaN(t.getTime())) return null;
      if (t < from || t > to) return null;
      if (utcDayKey(t) !== dayPrefix) return null;
      return pad2(t.getUTCHours());
    };
    return { period, from, to, labels, labelTitles, bucketOf };
  }

  if (period === 'week') {
    const from = startOfIsoWeekMonday(now);
    const labels: string[] = [];
    const labelTitles: string[] = [];
    const cursor = new Date(from.getTime());
    while (cursor <= to) {
      labels.push(utcDayKey(cursor));
      labelTitles.push(utcDayKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const bucketOf = (iso: string): string | null => {
      const t = new Date(iso);
      if (Number.isNaN(t.getTime())) return null;
      if (t < from || t > to) return null;
      return utcDayKey(t);
    };
    return { period, from, to, labels, labelTitles, bucketOf };
  }

  if (period === 'month') {
    const from = startOfUtcMonth(now);
    const labels: string[] = [];
    const labelTitles: string[] = [];
    const cursor = new Date(from.getTime());
    while (cursor <= to) {
      labels.push(utcDayKey(cursor));
      labelTitles.push(utcDayKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const bucketOf = (iso: string): string | null => {
      const t = new Date(iso);
      if (Number.isNaN(t.getTime())) return null;
      if (t < from || t > to) return null;
      return utcDayKey(t);
    };
    return { period, from, to, labels, labelTitles, bucketOf };
  }

  /* year */
  const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  const labels: string[] = [];
  const labelTitles: string[] = [];
  for (let m = 0; m <= now.getUTCMonth(); m += 1) {
    const key = `${now.getUTCFullYear()}-${pad2(m + 1)}`;
    labels.push(key);
    labelTitles.push(key);
  }
  const y = now.getUTCFullYear();
  const bucketOf = (iso: string): string | null => {
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return null;
    if (t < from || t > to) return null;
    if (t.getUTCFullYear() !== y) return null;
    return utcMonthKey(t);
  };
  return { period, from, to, labels, labelTitles, bucketOf };
}

export function aggregateIntoBuckets(
  labels: string[],
  timestamps: string[],
  bucketOf: (iso: string) => string | null,
): number[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, 0);
  for (const iso of timestamps) {
    const key = bucketOf(iso);
    if (!key || !counts.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return labels.map((label) => counts.get(label) ?? 0);
}
