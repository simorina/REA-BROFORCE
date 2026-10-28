import { describe, expect, it } from 'vitest';
import { EPILOGUE, endMessage } from './EndScreen';

describe('the end screen', () => {
  it('names the bro who boarded the helicopter', () => {
    expect(endMessage('won', 'Vladimir Putin')).toBe("Vladimir Putin è salito sull'elicottero.");
    expect(endMessage('won', 'Silvio Brolusconi')).toBe("Silvio Brolusconi è salito sull'elicottero.");
    expect(endMessage('lost', 'Vladimir Putin')).toBe('Hai finito le vite.');
  });

  it('after the island, the campaign is over', () => {
    expect(endMessage('won', 'Donald Trump', true)).toBe("Donald Trump è salito sull'elicottero. Epstein è sconfitto: campagna completata!");
  });

  it("after the campaign, the lore's epilogue: the neuralyzer's flash, and Satan with the Black Book", () => {
    expect(EPILOGUE).toContain('neuralizzatore');
    expect(EPILOGUE).toContain('Libro Nero');
    expect(EPILOGUE).toContain('Satana');
  });
});
