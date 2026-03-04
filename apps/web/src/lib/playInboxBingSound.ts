export function playInboxBingSound(): void {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  const gainNode = context.createGain();
  gainNode.connect(context.destination);

  // Two quick tones create a "bing" cue without shipping an audio asset.
  const firstTone = context.createOscillator();
  firstTone.type = "sine";
  firstTone.frequency.setValueAtTime(784, context.currentTime);
  firstTone.connect(gainNode);
  firstTone.start(context.currentTime);
  firstTone.stop(context.currentTime + 0.09);

  const secondTone = context.createOscillator();
  secondTone.type = "sine";
  secondTone.frequency.setValueAtTime(1046, context.currentTime + 0.1);
  secondTone.connect(gainNode);
  secondTone.start(context.currentTime + 0.1);
  secondTone.stop(context.currentTime + 0.24);

  gainNode.gain.setValueAtTime(0.0001, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.26);

  secondTone.onended = () => {
    void context.close();
  };
}
