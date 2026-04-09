type Labels = Record<string, string | number | boolean | null | undefined>;

type CounterMetric = {
  type: 'counter';
  value: number;
};

type DurationMetric = {
  type: 'duration';
  count: number;
  sum: number;
  min: number;
  max: number;
};

type MetricValue = CounterMetric | DurationMetric;

const registry = new Map<string, MetricValue>();

function normalizeLabelValue(value: Labels[string]): string {
  if (value === undefined || value === null) return 'unknown';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function normalizeLabels(labels?: Labels): string {
  if (!labels) return '';
  const entries = Object.entries(labels).map(([key, value]) => [key, normalizeLabelValue(value)] as const);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}=${v}`).join(',');
}

function metricKey(name: string, labels?: Labels): string {
  const normalized = normalizeLabels(labels);
  return normalized ? `${name}|${normalized}` : name;
}

function ensureCounter(name: string, labels?: Labels): CounterMetric {
  const key = metricKey(name, labels);
  const existing = registry.get(key);
  if (existing && existing.type === 'counter') return existing;
  const created: CounterMetric = { type: 'counter', value: 0 };
  registry.set(key, created);
  return created;
}

function ensureDuration(name: string, labels?: Labels): DurationMetric {
  const key = metricKey(name, labels);
  const existing = registry.get(key);
  if (existing && existing.type === 'duration') return existing;
  const created: DurationMetric = { type: 'duration', count: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: 0 };
  registry.set(key, created);
  return created;
}

export function incrementMetric(name: string, labels?: Labels, value = 1): void {
  if (!Number.isFinite(value) || value <= 0) return;
  const metric = ensureCounter(name, labels);
  metric.value += value;
}

export function observeDurationMs(name: string, durationMs: number, labels?: Labels): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  const metric = ensureDuration(name, labels);
  metric.count += 1;
  metric.sum += durationMs;
  metric.min = Math.min(metric.min, durationMs);
  metric.max = Math.max(metric.max, durationMs);
}

export function getMetricsSnapshot(): {
  generatedAt: string;
  metrics: Array<
    | { name: string; labels: Record<string, string>; type: 'counter'; value: number }
    | {
        name: string;
        labels: Record<string, string>;
        type: 'duration';
        count: number;
        avg: number;
        min: number;
        max: number;
        sum: number;
      }
  >;
} {
  const metrics = [];
  for (const [key, value] of registry.entries()) {
    const [name, labelPart = ''] = key.split('|');
    const labels: Record<string, string> = {};
    if (labelPart) {
      for (const segment of labelPart.split(',')) {
        const [k, v] = segment.split('=');
        if (k && v) labels[k] = v;
      }
    }

    if (value.type === 'counter') {
      metrics.push({
        name,
        labels,
        type: 'counter' as const,
        value: value.value,
      });
    } else {
      metrics.push({
        name,
        labels,
        type: 'duration' as const,
        count: value.count,
        avg: value.count > 0 ? value.sum / value.count : 0,
        min: Number.isFinite(value.min) ? value.min : 0,
        max: value.max,
        sum: value.sum,
      });
    }
  }

  metrics.sort((a, b) => {
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return JSON.stringify(a.labels).localeCompare(JSON.stringify(b.labels));
  });
  return {
    generatedAt: new Date().toISOString(),
    metrics,
  };
}
