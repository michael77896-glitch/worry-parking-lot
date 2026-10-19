/** The six cars a worry can be parked as. Each has a picture in assets/cars/. */
export const CAR_KINDS = ['hatchback', 'sedan', 'suv', 'pickup', 'beetle', 'van'] as const;

export type CarKind = (typeof CAR_KINDS)[number];

export const CAR_LABELS: Record<CarKind, string> = {
  hatchback: 'Hatchback',
  sedan: 'Sedan',
  suv: 'SUV',
  pickup: 'Pickup',
  beetle: 'Beetle',
  van: 'Van',
};

export function isCarKind(value: unknown): value is CarKind {
  return typeof value === 'string' && (CAR_KINDS as readonly string[]).includes(value);
}

/** A car chosen at random, for "surprise me". */
export function randomCarKind(random: () => number = Math.random): CarKind {
  return CAR_KINDS[Math.min(CAR_KINDS.length - 1, Math.floor(random() * CAR_KINDS.length))];
}
