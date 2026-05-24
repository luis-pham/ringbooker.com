/** Shared outcome → tag class mapping for call lists (high-contrast badges). */
export function callOutcomeTagClass(outcome?: string | null): string {
  if (outcome === 'missed') return 'tag orange';
  if (outcome === 'error') return 'tag red';
  if (outcome === 'booked') return 'tag green';
  if (!outcome || outcome === 'in_progress') return 'tag slate';
  return 'tag blue';
}
