/** Says the line with the browser's generic Italian voice (no recording of the real person). */
export function speak(text: string, enabled: boolean): void {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'it-IT';
  utterance.rate = 1.05;
  utterance.pitch = 0.9;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('it'));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
