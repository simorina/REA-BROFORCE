/** The installed voice for a language: the exact tag, else any voice of the language (it-CH -> it-IT). */
export function pickVoice<V extends { lang: string }>(voices: readonly V[], lang: string): V | undefined {
  const prefix = lang.split('-')[0].toLowerCase();
  return voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
}

/** Says the line with the browser's generic voice for the bro's language (no recording of the real person). */
export function speak(text: string, lang: string, enabled: boolean): void {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1.05;
  utterance.pitch = 0.9;
  const voice = pickVoice(window.speechSynthesis.getVoices(), lang);
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
