import { getCar } from '@/constants/car-catalog';
import { getPaint, STOCK_PAINT } from '@/constants/paints';
import type { OwnedCar } from '@/data';

/** "Coupe", or "Coupe #2" when the user owns more than one copy. Copies are numbered oldest first. */
export function ownedCarName(car: OwnedCar, all: readonly OwnedCar[]): string {
  const copies = all.filter((c) => c.carId === car.carId).sort((a, b) => a.id - b.id);
  const name = getCar(car.carId).name;
  return copies.length > 1 ? `${name} #${copies.indexOf(car) + 1}` : name;
}

/** "Original paint" or "Gloss Sky". */
export function paintName(paintId: string): string {
  if (paintId === STOCK_PAINT) return 'Original paint';
  return getPaint(paintId)?.name ?? 'Original paint';
}
