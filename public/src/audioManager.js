export function createAudioManager(toggleButton) {
  let audioContext = null;
  let muted = false;

  function getContext() {
    if (audioContext) return audioContext;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
    return audioContext;
  }
  function unlock() {
    const context = getContext();
    if (context?.state === 'suspended') context.resume().catch(() => {});
  }
  function tone(context, frequency, start, duration, waveform = 'sine', peak = 0.12, endFrequency = null) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(start); oscillator.stop(start + duration + 0.02);
  }
  function play(effect) {
    if (muted) return;
    const context = getContext();
    if (!context) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
    const now = context.currentTime;
    if (effect === 'attack') tone(context, 880, now, 0.16, 'sawtooth', 0.11, 145);
    if (effect === 'dash') {
      const length = Math.floor(context.sampleRate * 0.2);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) samples[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource(); source.buffer = buffer;
      const filter = context.createBiquadFilter(); filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500, now); filter.frequency.exponentialRampToValueAtTime(240, now + 0.18);
      const gain = context.createGain(); gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.025); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      source.connect(filter); filter.connect(gain); gain.connect(context.destination); source.start(now); source.stop(now + 0.21);
    }
    if (effect === 'shield') {
      tone(context, 330, now, 0.32, 'sine', 0.09, 390);
      tone(context, 495, now + 0.035, 0.28, 'triangle', 0.055, 440);
    }
    if (effect === 'pickup') {
      tone(context, 740, now, 0.24, 'sine', 0.12, 1120);
      tone(context, 1110, now + 0.09, 0.3, 'sine', 0.09, 1480);
    }
  }
  function updateButton() {
    if (!toggleButton) return;
    toggleButton.textContent = muted ? 'SFX: OFF' : 'SFX: ON';
    toggleButton.setAttribute('aria-label', muted ? 'Unmute sound effects' : 'Mute sound effects');
    toggleButton.setAttribute('aria-pressed', String(muted));
  }
  function toggleMute() {
    muted = !muted;
    if (!muted) unlock();
    updateButton();
  }
  toggleButton?.addEventListener('click', () => { unlock(); toggleMute(); });
  updateButton();

  return { play, unlock, toggleMute, isMuted: () => muted };
}
