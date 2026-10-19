/** "Tue, Mar 10, 6:42 PM" style label for a moment in the past. */
export function formatDateTime(date: Date): string {
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** A Date whose local time is `minutes` after midnight. For time pickers and clock labels. */
export function dateFromMinutes(minutes: number): Date {
  return new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
}

/** "7:00 PM" for a minutes-after-midnight value. */
export function formatClock(minutes: number): string {
  return formatTime(dateFromMinutes(minutes));
}

/** "7:15 PM" */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "Thursday 7:00 PM" style label in the device's locale and time zone. */
export function formatWhen(date: Date): string {
  return date.toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' });
}
