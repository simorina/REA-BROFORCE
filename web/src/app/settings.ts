const VOICE_KEY = 'brolusconi.voice';
const SOUND_KEY = 'brolusconi.sound';

function load(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    return true;
  }
}

function save(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    // storage unavailable: the choice lasts for this session only
  }
}

export const loadVoiceSetting = (): boolean => load(VOICE_KEY);
export const saveVoiceSetting = (on: boolean): void => save(VOICE_KEY, on);
export const loadSoundSetting = (): boolean => load(SOUND_KEY);
export const saveSoundSetting = (on: boolean): void => save(SOUND_KEY, on);
