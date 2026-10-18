/** "Thursday 7:00 PM" style label in the device's locale and time zone. */
export function formatWhen(date: Date): string {
  return date.toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' });
}
