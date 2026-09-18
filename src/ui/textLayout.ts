import { Text, TextMetrics } from 'pixi.js';

/**
 * PixiJS anchors a Text on its full line box (ascent + descent). The Pixel face
 * carries a deep descent, so `anchor.y = 0.5` leaves the glyphs sitting well
 * above the middle of a button or a slot. Centre on the ink band instead: with
 * the top-left anchor the baseline lands at `y + ascent`, so the visible glyphs
 * straddle `y + ascent / 2`.
 */
export function centerTextVertically(text: Text, centerY: number) {
  const { ascent } = TextMetrics.measureFont(text.style.toFontString());
  text.anchor.y = 0;
  text.y = Math.round(centerY - ascent / 2);
}

/** Places a single-line label so it is centred both ways inside a box. */
export function centerTextInBox(text: Text, x: number, y: number, w: number, h: number) {
  text.anchor.x = 0.5;
  text.x = Math.round(x + w / 2);
  centerTextVertically(text, y + h / 2);
}
