import { ColorPair } from '../types/ColorPair';
import { color_pairs } from '../constants/color_pairs';

export function getRandomColorPair(colorIndex: number): ColorPair {
  const colorPair = color_pairs[colorIndex];
  colorIndex = (colorIndex + 1) % color_pairs.length;
  return colorPair;
}
