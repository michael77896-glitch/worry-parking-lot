/**
 * Mod parts. Pure data. Each car has five slots. The visuals are placeholders for now: a tile with
 * a symbol, tinted by rarity. When art exists, add an image to each part and draw it on the car.
 */
import type { Rarity } from './rarity';

export const SLOTS = ['rims', 'spoiler', 'underglow', 'plate', 'stickers'] as const;

export type Slot = (typeof SLOTS)[number];

export const SLOT_LABEL: Record<Slot, string> = {
  rims: 'Rims',
  spoiler: 'Spoiler',
  underglow: 'Underglow',
  plate: 'Plate',
  stickers: 'Stickers',
};

export type PartDef = {
  /** Stored on owned parts. Never change one. */
  id: string;
  slot: Slot;
  rarity: Rarity;
  name: string;
};

export const PARTS: readonly PartDef[] = [
  { id: 'rims-steel', slot: 'rims', rarity: 'common', name: 'Steel Rims' },
  { id: 'rims-alloy', slot: 'rims', rarity: 'rare', name: 'Alloy Rims' },
  { id: 'rims-deep-dish', slot: 'rims', rarity: 'epic', name: 'Deep-Dish Rims' },
  { id: 'rims-gold', slot: 'rims', rarity: 'legendary', name: 'Gilded Rims' },

  { id: 'spoiler-lip', slot: 'spoiler', rarity: 'common', name: 'Lip Spoiler' },
  { id: 'spoiler-ducktail', slot: 'spoiler', rarity: 'rare', name: 'Ducktail Spoiler' },
  { id: 'spoiler-gt-wing', slot: 'spoiler', rarity: 'epic', name: 'GT Wing' },
  { id: 'spoiler-carbon-wing', slot: 'spoiler', rarity: 'legendary', name: 'Carbon Wing' },

  { id: 'underglow-white', slot: 'underglow', rarity: 'common', name: 'Soft White Glow' },
  { id: 'underglow-teal', slot: 'underglow', rarity: 'rare', name: 'Teal Glow' },
  { id: 'underglow-violet', slot: 'underglow', rarity: 'epic', name: 'Violet Glow' },
  { id: 'underglow-aurora', slot: 'underglow', rarity: 'legendary', name: 'Aurora Glow' },

  { id: 'plate-plain', slot: 'plate', rarity: 'common', name: 'Plain Plate' },
  { id: 'plate-custom', slot: 'plate', rarity: 'rare', name: 'Custom Plate' },
  { id: 'plate-vanity', slot: 'plate', rarity: 'epic', name: 'Vanity Plate' },
  { id: 'plate-gold', slot: 'plate', rarity: 'legendary', name: 'Gold Plate' },

  { id: 'stickers-stripe', slot: 'stickers', rarity: 'common', name: 'Racing Stripe' },
  { id: 'stickers-stars', slot: 'stickers', rarity: 'rare', name: 'Star Decals' },
  { id: 'stickers-flames', slot: 'stickers', rarity: 'epic', name: 'Soft Flames' },
  { id: 'stickers-galaxy', slot: 'stickers', rarity: 'legendary', name: 'Galaxy Wrap' },
];

export function getPart(id: string): PartDef | undefined {
  return PARTS.find((p) => p.id === id);
}

export function partsInSlot(slot: Slot): PartDef[] {
  return PARTS.filter((p) => p.slot === slot);
}

/** What a part costs in the mod shop. Epic and Legendary parts are not sold: boxes only. */
export const PART_PRICES: Partial<Record<Rarity, number>> = { common: 60, rare: 150 };

export function partPrice(part: PartDef): number | null {
  return PART_PRICES[part.rarity] ?? null;
}
