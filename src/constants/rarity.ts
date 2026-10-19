/** Pure data, no imports, so the data layer and its tests can use it. */

export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

/** Gray, blue, purple, gold. Always shown next to the rarity's name, never as the only signal. */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#A3ABBA',
  rare: '#6FA8F0',
  epic: '#B58CF5',
  legendary: '#F2C94C',
};

export const RARITY_COLOR_NAME: Record<Rarity, string> = {
  common: 'gray',
  rare: 'blue',
  epic: 'purple',
  legendary: 'gold',
};

export function rarityRank(rarity: Rarity): number {
  return RARITIES.indexOf(rarity);
}

export function isAtLeast(rarity: Rarity, minimum: Rarity): boolean {
  return rarityRank(rarity) >= rarityRank(minimum);
}
