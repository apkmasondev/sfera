export const MOTION = Object.freeze({
  focusDuration: 620,
  imageOpenDuration: 640,
  returnDuration: 560,
  overlayDuration: 380,
  closeBlendStart: 0.68,
  styleResponse: 9
});

export function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}
