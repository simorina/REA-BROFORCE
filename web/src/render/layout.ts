const MAX_WIDTH = 1200;
const ASPECT = 16 / 9;

/** Left edge of a speech bubble centred on centerX, kept inside the canvas. */
export function clampBubbleLeft(centerX: number, width: number, canvasWidth: number): number {
  return Math.min(Math.max(centerX - width / 2, 0), Math.max(0, canvasWidth - width));
}

/** CSS size of the 16:9 game canvas that fits the available window area (at most 1200 x 675). */
export function fitCanvas(availWidth: number, availHeight: number): { width: number; height: number } {
  const width = Math.floor(Math.min(MAX_WIDTH, availWidth, availHeight * ASPECT));
  return { width, height: Math.floor(width / ASPECT) };
}
