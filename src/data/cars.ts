/**
 * The data layer only knows a car by its id, a short lowercase name like "coupe" or "kei-truck".
 * Everything else about a car (its name, style group, picture, whether it's locked) lives in the
 * catalog, src/constants/car-catalog.ts, so new cars never need a database change.
 */
export type CarId = string;

/** Used when a worry is parked without choosing a car. The screens always choose one. */
export const DEFAULT_CAR_ID: CarId = 'coupe';

/** Lowercase letters, digits, and single hyphens, e.g. "coupe", "kei-truck", "4x4". */
export function isCarId(value: unknown): value is CarId {
  return typeof value === 'string' && value.length <= 40 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}
