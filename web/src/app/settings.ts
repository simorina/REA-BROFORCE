const VOICE_KEY = 'brolusconi.voice';

export function loadVoiceSetting(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveVoiceSetting(on: boolean): void {
  try {
    localStorage.setItem(VOICE_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable: the choice lasts for this session only
  }
}
