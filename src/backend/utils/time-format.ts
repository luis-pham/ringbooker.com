export function formatHour(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return time;
  }

  if (hours === 12 && minutes === 0) return 'noon';
  if (hours === 0 && minutes === 0) return 'midnight';

  const period = hours >= 12 ? 'PM' : 'AM';
  const hour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return minutes === 0 ? `${hour} ${period}` : `${hour}:${String(minutes).padStart(2, '0')} ${period}`;
}
