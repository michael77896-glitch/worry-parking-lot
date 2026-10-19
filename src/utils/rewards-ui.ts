import { getCar } from '@/constants/car-catalog';
import { getPaint } from '@/constants/paints';
import { getPart } from '@/constants/parts';
import { RARITY_COLOR, RARITY_LABEL, type Rarity } from '@/constants/rarity';
import type { Reward } from '@/data';

export type RewardLook = {
  name: string;
  /** A Golden Crate has no rarity of its own; it is shown in gold. */
  rarity: Rarity | 'golden';
  rarityLabel: string;
  color: string;
};

/** The name, rarity, and color to show for anything a box can hold. */
export function describeReward(reward: Reward): RewardLook {
  if (reward.kind === 'golden') {
    return { name: 'Golden Crate', rarity: 'golden', rarityLabel: 'Golden Crate', color: RARITY_COLOR.legendary };
  }
  const name =
    reward.kind === 'car'
      ? getCar(reward.carId).name
      : reward.kind === 'part'
        ? (getPart(reward.partId)?.name ?? 'Mod part')
        : (getPaint(reward.paintId)?.name ?? 'Paint');
  return { name, rarity: reward.rarity, rarityLabel: RARITY_LABEL[reward.rarity], color: RARITY_COLOR[reward.rarity] };
}
