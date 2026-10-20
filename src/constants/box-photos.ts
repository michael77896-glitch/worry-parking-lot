import type { BoxType } from './rewards';

/**
 * The box pictures used on the box-opening screen (trimmed, transparent, 560 px tall).
 * `seam` is how far down the picture the lid ends, as a fraction of its height: the lid blasts off
 * above that line. `color` is the box's own glow, used for the light rays, the leaking light, and
 * the sparks. (It is the box's color, not the reward's, so it never gives away what is inside.)
 */
export const BOX_PHOTOS: Record<BoxType, { image: number; aspect: number; seam: number; color: string }> = {
  glovebox: { image: require('../../assets/boxes/glovebox.png'), aspect: 742 / 560, seam: 0.55, color: '#6FA8F0' },
  toolbox: { image: require('../../assets/boxes/toolbox.png'), aspect: 597 / 560, seam: 0.5, color: '#B58CF5' },
  golden: { image: require('../../assets/boxes/golden-crate.png'), aspect: 639 / 560, seam: 0.5, color: '#F2C94C' },
};
