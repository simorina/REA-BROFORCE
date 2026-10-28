import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../levels';
import { campaignBlurb } from './Menu';

describe('the menu', () => {
  it('counts the campaign\'s missions as they are', () => {
    expect(campaignBlurb(MISSIONS.length)).toContain(`${MISSIONS.length} missioni`);
    expect(campaignBlurb(MISSIONS.length)).toContain('Operazione Little Saint James');
  });
});
