/**
 * Everything about the cars except their pictures, so the data layer and its tests can use it.
 * src/constants/car-catalog.ts adds the pictures. Read the header there for how to add cars.
 */
import type { Rarity } from './rarity';

export type StyleGroup = 'JDM' | 'Euro' | 'American';

export type CarData = {
  /** Stored on worries and owned cars. Lowercase letters, digits, single hyphens. Never change one. */
  id: string;
  name: string;
  style: StyleGroup;
  /** Starter cars come with the app; special cars are earned from boxes. */
  tier: 'starter' | 'special';
  /**
   * Locked cars can't be obtained yet. Placeholders for future cars stay locked until their art
   * exists; once unlocked, a car joins the box drops for its rarity.
   */
  locked: boolean;
  rarity: Rarity;
  /** Width divided by height of the trimmed picture. */
  aspect: number;
  /** How long the car is next to the longest one (0 to 1), so a kei truck parks smaller than a wagon. */
  length: number;
};

export const CAR_DATA: readonly CarData[] = [
  { id: 'coupe', name: 'Coupe', style: 'JDM', tier: 'starter', locked: false, rarity: 'common', aspect: 291 / 480, length: 0.96 },
  { id: 'kei-truck', name: 'Kei Truck', style: 'JDM', tier: 'starter', locked: false, rarity: 'common', aspect: 289 / 480, length: 0.82 },
  { id: 'city-car', name: 'City Car', style: 'Euro', tier: 'starter', locked: false, rarity: 'common', aspect: 291 / 480, length: 0.86 },
  { id: 'rear-engine', name: 'Rear Engine', style: 'Euro', tier: 'starter', locked: false, rarity: 'common', aspect: 287 / 480, length: 0.94 },
  { id: 'wagon', name: 'Wagon', style: 'Euro', tier: 'starter', locked: false, rarity: 'common', aspect: 262 / 480, length: 1 },
  { id: 'muscle', name: 'Muscle', style: 'American', tier: 'starter', locked: false, rarity: 'common', aspect: 296 / 480, length: 1 },
  { id: '4x4', name: '4x4', style: 'American', tier: 'starter', locked: false, rarity: 'common', aspect: 296 / 480, length: 0.96 },

  // Placeholders for future cars. Locked, so they never drop and show as silhouettes in the Garage.
  // To release one: replace its art, give it a real name, and set `locked: false`.
  { id: 'rare-placeholder', name: 'Rare Car', style: 'JDM', tier: 'special', locked: true, rarity: 'rare', aspect: 291 / 480, length: 0.96 },
  { id: 'epic-placeholder', name: 'Epic Car', style: 'Euro', tier: 'special', locked: true, rarity: 'epic', aspect: 287 / 480, length: 0.94 },
  { id: 'legendary-placeholder', name: 'Legendary Car', style: 'American', tier: 'special', locked: true, rarity: 'legendary', aspect: 296 / 480, length: 1 },
];

export const STARTER_CAR_IDS: readonly string[] = CAR_DATA.filter((c) => c.tier === 'starter').map((c) => c.id);

export function getCarData(id: string): CarData | undefined {
  return CAR_DATA.find((c) => c.id === id);
}

/** Cars that can come out of a box: not locked, optionally of one rarity. */
export function droppableCars(rarity?: Rarity): CarData[] {
  return CAR_DATA.filter((c) => !c.locked && (rarity === undefined || c.rarity === rarity));
}
