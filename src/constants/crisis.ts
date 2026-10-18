/**
 * Crisis resources (US). These are hard-coded on purpose so the screen works offline.
 *
 * TODO before release: confirm every number and URL below against the official sources
 * (988lifeline.org, crisistextline.org) and update `lastVerified`.
 */
export const CRISIS = {
  lastVerified: null as string | null,
  lifeline: {
    name: '988 Suicide & Crisis Lifeline',
    number: '988',
    callUrl: 'tel:988',
    textUrl: 'sms:988',
    chatUrl: 'https://988lifeline.org/chat/',
  },
  emergency: {
    number: '911',
    callUrl: 'tel:911',
  },
  crisisTextLine: {
    name: 'Crisis Text Line',
    keyword: 'HOME',
    shortcode: '741741',
    textUrl: 'sms:741741&body=HOME',
  },
  international: {
    name: 'Find a helpline',
    url: 'https://findahelpline.com',
  },
} as const;
