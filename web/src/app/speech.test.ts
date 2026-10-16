import { describe, expect, it } from 'vitest';
import { pickVoice } from './speech';

describe('pickVoice', () => {
  it('prefers the exact language, then any voice of it, else none', () => {
    const voices = [{ lang: 'en-US' }, { lang: 'ru-UA' }, { lang: 'ru-RU' }, { lang: 'it-IT' }];
    expect(pickVoice(voices, 'ru-RU')).toBe(voices[2]);
    expect(pickVoice(voices, 'it-CH')).toBe(voices[3]);
    expect(pickVoice([{ lang: 'ru_RU' }], 'ru-RU')?.lang).toBe('ru_RU'); // Android spells it with an underscore
    expect(pickVoice([{ lang: 'en-US' }], 'ru-RU')).toBeUndefined();
  });
});
