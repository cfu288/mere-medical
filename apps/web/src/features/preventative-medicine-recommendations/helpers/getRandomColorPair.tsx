import { ColorPair } from 'apps/web/src/features/preventative-medicine-recommendations/types/ColorPair';
import { color_pairs } from 'apps/web/src/features/preventative-medicine-recommendations/constants/color_pairs';

export function getRandomColorPair(colorIndex: number): ColorPair {
  const colorPair = color_pairs[colorIndex];
  colorIndex = (colorIndex + 1) % color_pairs.length;
  return colorPair;
}
