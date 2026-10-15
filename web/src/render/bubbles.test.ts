import { describe, expect, it } from 'vitest';
import { bubbleFrame, stillBubble } from './bubbles';
import { TEST_EFFECTS } from './testFx';

describe('ReactionBubble', () => {
  const { '!': bang, rambro } = TEST_EFFECTS.bubbles;

  it('the "!" pops up to its rest frame, rests, then folds away', () => {
    expect(bubbleFrame(bang, 0)).toBe(0);
    expect(bubbleFrame(bang, bang.animatedRestFrame * 0.0334 + 0.2)).toBe(bang.animatedRestFrame);
    expect(bubbleFrame(bang, 5)).toBe(-1);
  });

  it("the scout's Rambro face is a still bubble: it tweens in from 5 below, holds, and rises 5 as it fades", () => {
    expect(rambro.animatedBubble).toBe(0);
    const life = 0.6;
    expect(stillBubble(rambro, 0, life)).toEqual({ offsetY: -5, alpha: 0 });
    expect(stillBubble(rambro, 0.3, life)).toEqual({ offsetY: 0, alpha: 1 });
    const out = stillBubble(rambro, life - rambro.tweenTime / 2, life)!;
    expect(out.offsetY).toBeCloseTo(2.5, 5);
    expect(out.alpha).toBeCloseTo(0.75, 5); // m = 0.5: 0.5 + 0.25
    expect(stillBubble(rambro, life, life)).toBeNull();
  });
});
