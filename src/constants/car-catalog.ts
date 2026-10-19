/**
 * The car catalog the screens use: the car data (src/constants/car-data.ts) plus each car's
 * picture. The database stores only a car's `id`.
 *
 * HOW TO GROW THIS LATER
 *  - A new car: add its picture to assets/cars/ (top-down, nose up, transparent background,
 *    trimmed, about 480 px tall), add an entry to CAR_DATA in car-data.ts, and add the picture to
 *    IMAGES below. No database change is needed. A car with `locked: false` joins the box drops
 *    for its rarity; the placeholders stay locked until their art exists.
 *  - Paint colors and finishes live in paints.ts, and mod parts in parts.ts. A car can also have
 *    ready-made paint pictures: put them in `PAINT_IMAGES`, and `getCarImage` uses them.
 */
import { CAR_DATA, droppableCars, type CarData, type StyleGroup } from './car-data';
import type { Rarity } from './rarity';

export type { StyleGroup };

/** How each style group is read out loud. */
export const STYLE_GROUPS: Record<StyleGroup, { spoken: string }> = {
  JDM: { spoken: 'J D M, Japanese domestic market' },
  Euro: { spoken: 'Euro, European' },
  American: { spoken: 'American' },
};

const COUPE = require('../../assets/cars/coupe.png');
const MUSCLE = require('../../assets/cars/muscle.png');
const REAR_ENGINE = require('../../assets/cars/rear-engine.png');

const IMAGES: Record<string, number> = {
  coupe: COUPE,
  'kei-truck': require('../../assets/cars/kei-truck.png'),
  'city-car': require('../../assets/cars/city-car.png'),
  'rear-engine': REAR_ENGINE,
  wagon: require('../../assets/cars/wagon.png'),
  muscle: MUSCLE,
  '4x4': require('../../assets/cars/4x4.png'),
  // Stand-in art for the locked placeholders. They show as silhouettes until they are released.
  'rare-placeholder': COUPE,
  'epic-placeholder': REAR_ENGINE,
  'legendary-placeholder': MUSCLE,
};

/** Ready-made paint pictures per car, by paint id. Empty: paints are drawn by recoloring the picture. */
const PAINT_IMAGES: Record<string, Record<string, number>> = {};

export type CarDefinition = CarData & {
  /** The car's own paint: a top-down picture with the nose up. */
  image: number;
};

export const CAR_CATALOG: readonly CarDefinition[] = CAR_DATA.map((car) => ({ ...car, image: IMAGES[car.id] }));

export type { Rarity };

/** Whether the car can be obtained at all. Placeholders are locked until their art is ready. */
export function isUnlocked(car: CarDefinition): boolean {
  return !car.locked;
}

/** Looks a car up by id. An id the catalog doesn't know falls back to the first car. */
export function getCar(id: string): CarDefinition {
  return CAR_CATALOG.find((car) => car.id === id) ?? CAR_CATALOG[0];
}

/** The car's picture in a ready-made paint if there is one, otherwise its own paint. */
export function getCarImage(car: CarDefinition, paintId?: string): number {
  return (paintId && PAINT_IMAGES[car.id]?.[paintId]) || car.image;
}

export { droppableCars };
