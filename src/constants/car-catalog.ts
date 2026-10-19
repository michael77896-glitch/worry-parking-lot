/**
 * The car catalog: every car a worry can be parked as. The database stores only a car's `id`;
 * names, style groups, pictures, and lock state live here.
 *
 * HOW TO GROW THIS LATER
 *  - A new car: add a picture to assets/cars/ (top-down, nose up, transparent background, trimmed,
 *    about 480 px tall), then add an entry below. No database change is needed.
 *  - A locked or special car: add it with `locked: true` (and `tier: 'special'`). The Garage shows
 *    it as a silhouette, and the car picker leaves it out, until it is unlocked. Today the flag is
 *    fixed in this file. When unlocking becomes real, keep the unlocked ids on the phone and make
 *    `isUnlocked` read them; every screen already goes through `isUnlocked`.
 *  - Paint colors: give a car a `paints` map of paint id -> picture, and add a `paint` column to
 *    `worries` in a new migration. `getCarImage(car, paintId)` already returns the paint's picture.
 *  - Mods (spoilers, stickers, and so on) would be overlays drawn on top of a car. Add them as
 *    their own small catalog next to this one, and store the chosen mod ids on the worry.
 */

export type StyleGroup = 'JDM' | 'Euro' | 'American';

/** How each style group is read out loud, and what it means. */
export const STYLE_GROUPS: Record<StyleGroup, { spoken: string }> = {
  JDM: { spoken: 'J D M, Japanese domestic market' },
  Euro: { spoken: 'Euro, European' },
  American: { spoken: 'American' },
};

export type CarDefinition = {
  /** Stored on the worry. Lowercase letters, digits, and single hyphens. Never change one. */
  id: string;
  name: string;
  style: StyleGroup;
  /** Starter cars come with the app; special cars are earned later. */
  tier: 'starter' | 'special';
  /** Locked cars show as a silhouette in the Garage and can't be picked yet. */
  locked: boolean;
  /** The default paint. A top-down picture with the nose up. */
  image: number;
  /** Other paint jobs, by paint id. Empty for now. */
  paints?: Record<string, number>;
  /** Width divided by height of the trimmed picture. */
  aspect: number;
  /** How long the car is next to the longest one (0 to 1), so a kei truck parks smaller than a wagon. */
  length: number;
};

export const CAR_CATALOG: readonly CarDefinition[] = [
  {
    id: 'coupe',
    name: 'Coupe',
    style: 'JDM',
    tier: 'starter',
    locked: false,
    image: require('../../assets/cars/coupe.png'),
    aspect: 291 / 480,
    length: 0.96,
  },
  {
    id: 'kei-truck',
    name: 'Kei Truck',
    style: 'JDM',
    tier: 'starter',
    locked: false,
    image: require('../../assets/cars/kei-truck.png'),
    aspect: 289 / 480,
    length: 0.82,
  },
  {
    id: 'city-car',
    name: 'City Car',
    style: 'Euro',
    tier: 'starter',
    locked: false,
    image: require('../../assets/cars/city-car.png'),
    aspect: 291 / 480,
    length: 0.86,
  },
  {
    id: 'rear-engine',
    name: 'Rear Engine',
    style: 'Euro',
    tier: 'starter',
    locked: false,
    image: require('../../assets/cars/rear-engine.png'),
    aspect: 287 / 480,
    length: 0.94,
  },
  {
    id: 'wagon',
    name: 'Wagon',
    style: 'Euro',
    tier: 'starter',
    locked: false,
    image: require('../../assets/cars/wagon.png'),
    aspect: 262 / 480,
    length: 1,
  },
  {
    id: 'muscle',
    name: 'Muscle',
    style: 'American',
    tier: 'starter',
    locked: false,
    image: require('../../assets/cars/muscle.png'),
    aspect: 296 / 480,
    length: 1,
  },
  {
    id: '4x4',
    name: '4x4',
    style: 'American',
    tier: 'starter',
    locked: false,
    image: require('../../assets/cars/4x4.png'),
    aspect: 296 / 480,
    length: 0.96,
  },
];

/** The one place that decides whether a car can be used. */
export function isUnlocked(car: CarDefinition): boolean {
  return !car.locked;
}

export function unlockedCars(): CarDefinition[] {
  return CAR_CATALOG.filter(isUnlocked);
}

/** Looks a car up by id. An id the catalog doesn't know falls back to the first car. */
export function getCar(id: string): CarDefinition {
  return CAR_CATALOG.find((car) => car.id === id) ?? CAR_CATALOG[0];
}

/** The car's picture, in the given paint if it has one, otherwise the default paint. */
export function getCarImage(car: CarDefinition, paintId?: string): number {
  return (paintId && car.paints?.[paintId]) || car.image;
}

/** A random car from the unlocked ones, avoiding `excludeId` when there is another to choose. */
export function randomUnlockedCar(excludeId?: string, random: () => number = Math.random): CarDefinition {
  const pool = unlockedCars();
  const candidates = pool.length > 1 ? pool.filter((car) => car.id !== excludeId) : pool;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}
